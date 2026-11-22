/** PKCE popup orchestration. Pure helpers live in ./pkce. */
import {
  decodeJwtClaims,
  PKCE_TTL_MS,
  randomUrlSafe,
  sha256,
  base64UrlEncode,
  STORAGE_KEY_PENDING,
  STORAGE_KEY_TOKEN,
  POSTMESSAGE_SOURCE,
  validateCallback,
  type AuthOptions,
  type AuthSession,
  type DiscoveryDoc,
  type StoredState,
} from './pkce';

type Listener = (session: AuthSession | null) => void;

export class AuthManager {
  private readonly opts: Required<
    Pick<AuthOptions, 'scopes' | 'tokenStorage'>
  > &
    AuthOptions;
  private session: AuthSession | null;
  private listeners = new Set<Listener>();
  private popup: Window | null = null;
  private discovery: Promise<DiscoveryDoc> | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(
    private readonly apiUrl: string,
    opts: AuthOptions,
  ) {
    this.opts = {
      scopes: 'openid profile email',
      tokenStorage: 'session',
      ...opts,
    };
    this.session = this.loadSession();
  }

  onChange(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  isAuthenticated(): boolean {
    return !!this.session && Date.now() < this.session.expiresAt;
  }

  getSession(): AuthSession | null {
    return this.isAuthenticated() ? this.session : null;
  }

  signOut(): void {
    this.setSession(null);
  }

  async signIn(
    openPopup: (url: string) => Window | null,
  ): Promise<AuthSession> {
    const discovery = await this.getDiscovery();
    const state = randomUrlSafe(16);
    const verifier = randomUrlSafe(64);
    const challenge = base64UrlEncode(await sha256(verifier));
    const redirectUri =
      this.opts.redirectUri || `${this.apiUrl}/embed/callback.html`;
    const pending: StoredState = {
      state,
      codeVerifier: verifier,
      redirectUri,
      createdAt: Date.now(),
    };
    // Pending PKCE state always lives in sessionStorage: the popup callback
    // shares the host tab's session, and 'local' tokens must not widen the
    // state's exposure. Memory mode has no durable pending store either.
    sessionStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(pending));

    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.opts.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', this.opts.scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return new Promise<AuthSession>((resolve, reject) => {
      this.popup = openPopup(url.toString());
      if (!this.popup) {
        reject(new Error('Popup blocked. Allow popups and try again.'));
        return;
      }
      let handlingResponse = false;
      let cleanup: () => void = () => {};
      const cleanupAndClose = () => {
        clearInterval(watcher);
        if (this.messageHandler) {
          window.removeEventListener('message', this.messageHandler);
          this.messageHandler = null;
        }
      };
      const watcher = setInterval(() => {
        if (!handlingResponse && this.popup?.closed) {
          cleanupAndClose();
          reject(new Error('Sign-in window was closed.'));
        }
      }, 500);
      cleanup = cleanupAndClose;
      this.cleanup = cleanupAndClose;

      this.messageHandler = async (event: MessageEvent) => {
        if (
          event.origin !== window.location.origin &&
          event.origin !== this.apiUrl
        )
          return;
        // Only the window we opened may deliver the callback payload.
        if (this.popup && event.source !== this.popup) return;
        const data = event.data as
          | { source?: string; code?: string; state?: string; error?: string }
          | undefined;
        if (!data || data.source !== POSTMESSAGE_SOURCE) return;
        handlingResponse = true;
        clearInterval(watcher);
        const stored = this.readPending();
        sessionStorage.removeItem(STORAGE_KEY_PENDING);
        const verdict = validateCallback(data, stored ?? undefined);
        if (!verdict.ok) {
          cleanup();
          reject(new Error(verdict.reason));
          return;
        }
        try {
          const session = await this.exchangeCode(
            data.code!,
            stored!.codeVerifier,
            stored!.redirectUri,
          );
          cleanup();
          this.setSession(session);
          resolve(session);
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      window.addEventListener('message', this.messageHandler);
    });
  }

  private cleanup: (() => void) | null = null;

  dispose(): void {
    this.cleanup?.();
  }

  private setSession(session: AuthSession | null): void {
    this.session = session;
    const store = this.store();
    if (!session || this.opts.tokenStorage === 'memory') {
      store.removeItem(STORAGE_KEY_TOKEN);
    } else {
      store.setItem(STORAGE_KEY_TOKEN, JSON.stringify(session));
    }
    for (const listener of this.listeners) listener(session);
  }

  private loadSession(): AuthSession | null {
    if (this.opts.tokenStorage === 'memory') return null;
    const raw = this.store().getItem(STORAGE_KEY_TOKEN);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (!parsed.accessToken || Date.now() >= parsed.expiresAt) {
        this.store().removeItem(STORAGE_KEY_TOKEN);
        return null;
      }
      return parsed;
    } catch {
      this.store().removeItem(STORAGE_KEY_TOKEN);
      return null;
    }
  }

  private store(): Storage {
    return this.opts.tokenStorage === 'local' ? localStorage : sessionStorage;
  }

  private readPending(): StoredState | null {
    const raw = sessionStorage.getItem(STORAGE_KEY_PENDING);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StoredState;
      return Date.now() - parsed.createdAt > PKCE_TTL_MS ? null : parsed;
    } catch {
      return null;
    }
  }

  private async getDiscovery(): Promise<DiscoveryDoc> {
    if (!this.discovery) {
      const url = `${this.opts.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
      this.discovery = fetch(url, {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      }).then(async response => {
        if (!response.ok) {
          throw new Error(`OIDC discovery failed: HTTP ${response.status}`);
        }
        return (await response.json()) as DiscoveryDoc;
      });
    }
    return this.discovery;
  }

  /** Exchange through the same-origin proxy; no client secret in the bundle. */
  async exchangeCode(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<AuthSession> {
    const url = this.opts.exchangeUrl || `${this.apiUrl}/api/auth/embed/token`;
    const response = await fetch(url, {
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
    const json = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      id_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !json.access_token) {
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
}
