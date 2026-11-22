import { describe, expect, it } from 'vitest';
import {
  decodeJwtClaims,
  PKCE_TTL_MS,
  randomUrlSafe,
  sha256,
  base64UrlEncode,
  validateCallback,
  type StoredState,
} from '../src/pkce';

const stored = (overrides: Partial<StoredState> = {}): StoredState => ({
  state: 'state-abc',
  codeVerifier: 'verifier-xyz',
  redirectUri: 'http://localhost:5199/embed/callback.html',
  createdAt: Date.now(),
  ...overrides,
});

describe('PKCE helpers', () => {
  it('generates URL-safe random values with sufficient entropy', () => {
    const a = randomUrlSafe(32);
    const b = randomUrlSafe(32);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(40);
  });

  it('derives a S256 challenge from a verifier', async () => {
    const verifier = randomUrlSafe(64);
    const challenge = base64UrlEncode(await sha256(verifier));
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).not.toBe(verifier);
    // Deterministic: same input → same challenge.
    expect(base64UrlEncode(await sha256(verifier))).toBe(challenge);
  });

  it('decodes JWT claims and rejects malformed tokens', () => {
    const payload = btoa(JSON.stringify({ sub: 'user-1', exp: 9999999999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeJwtClaims(`header.${payload}.sig`)?.sub).toBe('user-1');
    expect(decodeJwtClaims('not-a-jwt')).toBeUndefined();
  });
});

describe('validateCallback', () => {
  it('accepts a valid code + state from the expected source', () => {
    expect(
      validateCallback(
        { source: 'agent-chat-oauth', code: 'code-1', state: 'state-abc' },
        stored(),
      ),
    ).toEqual({ ok: true });
  });

  it('rejects wrong source, provider errors and state mismatch', () => {
    expect(
      validateCallback({ source: 'other', code: 'c', state: 'state-abc' }, stored()).ok,
    ).toBe(false);
    expect(
      validateCallback(
        { source: 'agent-chat-oauth', error: 'access_denied' },
        stored(),
      ).ok,
    ).toBe(false);
    expect(
      validateCallback(
        { source: 'agent-chat-oauth', code: 'c', state: 'wrong' },
        stored(),
      ).ok,
    ).toBe(false);
  });

  it('rejects expired and missing state', () => {
    const stale = stored({ createdAt: Date.now() - PKCE_TTL_MS - 1000 });
    expect(
      validateCallback(
        { source: 'agent-chat-oauth', code: 'c', state: 'state-abc' },
        stale,
      ).ok,
    ).toBe(false);
    expect(
      validateCallback(
        { source: 'agent-chat-oauth', code: 'c', state: 'state-abc' },
        undefined,
      ).ok,
    ).toBe(false);
  });
});
