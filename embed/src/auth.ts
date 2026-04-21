/**
 * OAuth2 + PKCE sign-in flow for the embeddable chat widget.
 *
 * Flow:
 *   1. Widget → fetch discovery doc from `<issuer>/.well-known/openid-configuration`.
 *   2. Widget → generate PKCE verifier + challenge and a random `state`.
 *   3. Widget → open popup to `authorization_endpoint` with PKCE params.
 *   4. User signs in on the auth server; auth server redirects popup to
 *      `<apiUrl>/embed/callback.html?code=…&state=…`.
 *   5. callback.html → `postMessage({code, state}, origin)` back to opener,
 *      then closes itself.
 *   6. Widget verifies `state`, POSTs `{code, code_verifier, ...}` to
 *      `<apiUrl>/api/auth/embed/token` (same-origin proxy, bypasses the
 *      roauth2 CORS gap + strips refresh_token server-side).
 *   7. Widget stores access_token per `tokenStorage` and emits `onChange`.
 *
 * We never ship a client secret. The registered roauth2 client accepts
 * PKCE-only token exchanges; the proxy forwards without any secret too.
 */

export type TokenStorageMode = 'memory' | 'session' | 'local';

export interface AuthOptions {
  type: 'oauth2';
  /** Base issuer URL, e.g. `https://roauth2.cat-herding.net`. */
  issuer: string;
  /** OAuth2 public client id registered with the issuer. */
  clientId: string;
  /** Space-separated OAuth2 scopes. Default: `openid profile email`. */
  scopes?: string;
  /**
   * Full redirect_uri. Must be one of the client's registered URIs. If
   * omitted, defaults to `<widget.apiUrl>/embed/callback.html`.
   */
  redirectUri?: string;
  /**
   * Where to persist the access_token.
   *   - `memory`  — in-memory only (safest, requires sign-in every page load)
   *   - `session` — sessionStorage (default, survives same-tab nav/reload)
   *   - `local`   — localStorage (cross-tab, biggest XSS surface)
   */
  tokenStorage?: TokenStorageMode;
  /**
   * Override the same-origin token-exchange proxy path. Defaults to
   * `<widget.apiUrl>/api/auth/embed/token`.
   */
  exchangeUrl?: string;
}

export interface AuthSession {
  accessToken: string;
  idToken?: string;
  expiresAt: number;
  claims?: Record<string, unknown>;
}

export type AuthListener = (session: AuthSession | null) => void;

interface DiscoveryDoc {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

interface StoredState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

const STORAGE_KEY_TOKEN = 'cat-herding-chat.token';
const STORAGE_KEY_PENDING = 'cat-herding-chat.pkce';
const POSTMESSAGE_SOURCE = 'cat-herding-chat-oauth';

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomUrlSafe(byteLen: number): string {
  const arr = new Uint8Array(byteLen);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

function decodeJwtClaims(jwt: string): Record<string, unknown> | undefined {
  const parts = jwt.split('.');
  if (parts.length < 2) return undefined;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '==='.slice((payload.length + 3) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export class AuthManager {
  private opts: Required<Pick<AuthOptions, 'scopes' | 'tokenStorage'>> &
    AuthOptions;
  private apiUrl: string;
  private discoveryPromise: Promise<DiscoveryDoc> | null = null;
  private session: AuthSession | null = null;
  private listeners = new Set<AuthListener>();
  private popup: Window | null = null;
  private messageHandler: ((e: MessageEvent) => void) | null = null;

  constructor(apiUrl: string, opts: AuthOptions) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.opts = {
      scopes: 'openid profile email',
      tokenStorage: 'session',
      ...opts,
    };
    this.session = this.loadPersistedSession();
  }

  onChange(cb: AuthListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  isAuthenticated(): boolean {
    return !!this.session && Date.now() < this.session.expiresAt;
  }

  getSession(): AuthSession | null {
    return this.isAuthenticated() ? this.session : null;
  }

  async signIn(): Promise<AuthSession> {
    const disc = await this.getDiscovery();
    const state = randomUrlSafe(16);
    const codeVerifier = randomUrlSafe(64);
    const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
    const redirectUri =
      this.opts.redirectUri || `${this.apiUrl}/embed/callback.html`;

    const pending: StoredState = {
      state,
      codeVerifier,
      redirectUri,
      createdAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(pending));

    const url = new URL(disc.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.opts.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', this.opts.scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return new Promise<AuthSession>((resolve, reject) => {
      this.popup = this.openPopup(url.toString());
      if (!this.popup) {
        reject(new Error('Popup blocked. Allow popups and try again.'));
        return;
      }

      let popupWatcher: ReturnType<typeof setInterval> | null = null;
      // Signals that the popup has delivered its postMessage — flips to
      // true once we start handling a valid response. Prevents the
      // popup-closed watcher from racing with the async token exchange
      // when the callback window self-closes mid-exchange.
      let handlingResponse = false;

      const stopWatcher = (): void => {
        if (popupWatcher) {
          clearInterval(popupWatcher);
          popupWatcher = null;
        }
      };

      const cleanup = (): void => {
        if (this.messageHandler) {
          window.removeEventListener('message', this.messageHandler);
          this.messageHandler = null;
        }
        stopWatcher();
      };

      this.messageHandler = async (evt: MessageEvent) => {
        if (evt.origin !== window.location.origin && evt.origin !== this.apiUrl)
          return;
        const data = evt.data as
          | {
              source?: string;
              code?: string;
              state?: string;
              error?: string;
              error_description?: string;
            }
          | undefined;
        if (!data || data.source !== POSTMESSAGE_SOURCE) return;

        // Stop the popup-closed watcher immediately on any recognized
        // response — the popup is about to self-close and we don't want
        // its natural closure to reject this promise while the token
        // exchange is still in flight.
        handlingResponse = true;
        stopWatcher();

        const stored = this.readPending();
        if (!stored) {
          cleanup();
          reject(new Error('Sign-in state expired. Please try again.'));
          return;
        }

        if (data.error) {
          cleanup();
          sessionStorage.removeItem(STORAGE_KEY_PENDING);
          reject(
            new Error(
              data.error_description || data.error || 'Authorization failed',
            ),
          );
          return;
        }

        if (!data.code || data.state !== stored.state) {
          cleanup();
          sessionStorage.removeItem(STORAGE_KEY_PENDING);
          reject(new Error('Invalid sign-in response (state mismatch).'));
          return;
        }

        sessionStorage.removeItem(STORAGE_KEY_PENDING);
        try {
          const session = await this.exchangeCode(
            data.code,
            stored.codeVerifier,
            stored.redirectUri,
          );
          cleanup();
          this.setSession(session);
          resolve(session);
        } catch (err) {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };

      window.addEventListener('message', this.messageHandler);

      popupWatcher = setInterval(() => {
        if (handlingResponse) return;
        if (this.popup && this.popup.closed) {
          cleanup();
          reject(new Error('Sign-in window was closed.'));
        }
      }, 500);
    });
  }

  signOut(): void {
    this.setSession(null);
  }

  private setSession(session: AuthSession | null): void {
    this.session = session;
    this.persistSession(session);
    for (const listener of this.listeners) listener(session);
  }

  private async exchangeCode(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<AuthSession> {
    const exchangeUrl =
      this.opts.exchangeUrl || `${this.apiUrl}/api/auth/embed/token`;

    const resp = await fetch(exchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        client_id: this.opts.clientId,
      }),
    });

    const json = (await resp.json().catch(() => ({}))) as {
      access_token?: string;
      id_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!resp.ok || !json.access_token) {
      throw new Error(
        json.error_description || json.error || 'Token exchange failed',
      );
    }

    return {
      accessToken: json.access_token,
      idToken: json.id_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
      claims: json.id_token ? decodeJwtClaims(json.id_token) : undefined,
    };
  }

  private async getDiscovery(): Promise<DiscoveryDoc> {
    if (!this.discoveryPromise) {
      const url =
        this.opts.issuer.replace(/\/$/, '') +
        '/.well-known/openid-configuration';
      this.discoveryPromise = fetch(url, {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      }).then(async r => {
        if (!r.ok) throw new Error(`OIDC discovery failed: HTTP ${r.status}`);
        return (await r.json()) as DiscoveryDoc;
      });
    }
    return this.discoveryPromise;
  }

  private openPopup(url: string): Window | null {
    const w = 520;
    const h = 680;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    const features = [
      `width=${w}`,
      `height=${h}`,
      `left=${left}`,
      `top=${top}`,
      'resizable=yes',
      'scrollbars=yes',
      'status=no',
      'menubar=no',
      'toolbar=no',
    ].join(',');
    return window.open(url, 'cat-herding-chat-oauth', features);
  }

  private readPending(): StoredState | null {
    const raw = sessionStorage.getItem(STORAGE_KEY_PENDING);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StoredState;
      // Expire pending requests after 10 minutes.
      if (Date.now() - parsed.createdAt > 10 * 60 * 1000) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private persistSession(session: AuthSession | null): void {
    if (this.opts.tokenStorage === 'memory') return;
    const store =
      this.opts.tokenStorage === 'local' ? localStorage : sessionStorage;
    if (!session) {
      store.removeItem(STORAGE_KEY_TOKEN);
      return;
    }
    store.setItem(STORAGE_KEY_TOKEN, JSON.stringify(session));
  }

  private loadPersistedSession(): AuthSession | null {
    if (this.opts.tokenStorage === 'memory') return null;
    const store =
      this.opts.tokenStorage === 'local' ? localStorage : sessionStorage;
    const raw = store.getItem(STORAGE_KEY_TOKEN);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (!parsed.accessToken || Date.now() >= parsed.expiresAt) {
        store.removeItem(STORAGE_KEY_TOKEN);
        return null;
      }
      return parsed;
    } catch {
      store.removeItem(STORAGE_KEY_TOKEN);
      return null;
    }
  }
}
