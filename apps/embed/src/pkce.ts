/**
 * OAuth2 + PKCE sign-in for <agent-chat> (ported from legacy embed/src/auth.ts,
 * kept on the legacy backend's `/api/auth/embed/token` proxy — no secrets ship
 * in the bundle). Split from the popup orchestration to stay under the LOC
 * ceiling and to keep the pure crypto/storage helpers unit-testable.
 */
export type TokenStorageMode = 'memory' | 'session' | 'local';

export interface AuthOptions {
  type: 'oauth2';
  /** Base issuer URL (e.g. local mock issuer in tests). */
  issuer: string;
  clientId: string;
  scopes?: string;
  redirectUri?: string;
  tokenStorage?: TokenStorageMode;
  /** Override the same-origin token-exchange proxy path. */
  exchangeUrl?: string;
}

export interface AuthSession {
  accessToken: string;
  idToken?: string;
  expiresAt: number;
  claims?: Record<string, unknown>;
}

export interface DiscoveryDoc {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

export interface StoredState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

export const STORAGE_KEY_TOKEN = 'agent-chat.token';
export const STORAGE_KEY_PENDING = 'agent-chat.pkce';
export const POSTMESSAGE_SOURCE = 'agent-chat-oauth';
export const PKCE_TTL_MS = 10 * 60 * 1000;

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomUrlSafe(byteLen: number): string {
  const arr = new Uint8Array(byteLen);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
}

export async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return new Uint8Array(digest);
}

export function decodeJwtClaims(
  jwt: string,
): Record<string, unknown> | undefined {
  const parts = jwt.split('.');
  if (parts.length < 2) return undefined;
  try {
    const payload = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '==='.slice((payload.length + 3) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Validate a callback payload: reject state mismatch and expired flows. */
export function validateCallback(
  data:
    | { source?: string; code?: string; state?: string; error?: string }
    | undefined,
  stored: StoredState | undefined,
  now = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  if (!data || data.source !== POSTMESSAGE_SOURCE) {
    return { ok: false, reason: 'Unrecognised callback source.' };
  }
  if (data.error) return { ok: false, reason: data.error };
  if (!stored || now - stored.createdAt > PKCE_TTL_MS) {
    return { ok: false, reason: 'Sign-in state expired. Please try again.' };
  }
  if (!data.code || data.state !== stored.state) {
    return { ok: false, reason: 'Invalid sign-in response (state mismatch).' };
  }
  return { ok: true };
}
