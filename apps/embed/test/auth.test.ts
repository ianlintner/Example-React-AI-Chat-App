import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthManager } from '../src/auth';
import { STORAGE_KEY_TOKEN } from '../src/pkce';

const opts = {
  type: 'oauth2' as const,
  issuer: 'http://localhost:4000',
  clientId: 'embed-client',
  exchangeUrl: 'http://localhost:8787/api/auth/embed/token',
};

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('AuthManager token exchange', () => {
  it('posts the PKCE code and returns a bounded session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'token-abc',
          id_token: 'h.e30.s',
          expires_in: 120,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const auth = new AuthManager('http://localhost:8787', opts);
    const session = await auth.exchangeCode('code-1', 'verifier', 'http://cb');
    expect(session.accessToken).toBe('token-abc');
    expect(session.expiresAt).toBeGreaterThan(Date.now());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(opts.exchangeUrl);
    const body = JSON.parse(String(init?.body)) as Record<string, string>;
    expect(body).toMatchObject({
      code: 'code-1',
      code_verifier: 'verifier',
      client_id: 'embed-client',
    });
  });

  it('fails closed when the proxy rejects the exchange', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error_description: 'invalid_grant' }), {
        status: 400,
      }),
    );
    const auth = new AuthManager('http://localhost:8787', opts);
    await expect(
      auth.exchangeCode('bad', 'verifier', 'http://cb'),
    ).rejects.toThrow('invalid_grant');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('does not persist tokens when memory storage is requested', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 't', expires_in: 60 }), {
        status: 200,
      }),
    );
    const auth = new AuthManager('http://localhost:8787', {
      ...opts,
      tokenStorage: 'memory',
    });
    await auth.exchangeCode('code', 'verifier', 'http://cb');
    expect(sessionStorage.getItem(STORAGE_KEY_TOKEN)).toBeNull();
  });
});
