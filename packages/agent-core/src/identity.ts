/**
 * Signed anonymous session, ported from the legacy `_chat_anon` UX. An
 * anonymous id is minted clientlessly, HMAC-signed with a server-side secret
 * and carried in an httpOnly cookie; tampering yields a fresh principal.
 * An authenticated subject (trusted upstream header in local dev) upgrades
 * the same session without changing the thread id scheme.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Principal } from './seams';

export const ANON_COOKIE = '_chat_anon' as const;
export const ANON_SESSION_MS = 8 * 60 * 60 * 1000;

export interface IdentityConfig {
  /** 32+ byte secret from SESSION_SECRET. No default; boot fails without it. */
  secret: string;
  /** Trusted header carrying an authenticated subject, if configured. */
  subjectHeader?: string;
  /** Claim encoded for authenticated users (default tier from limiter). */
  userTier?: 'free' | 'pro';
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

/** Encode `{id, exp}` as `<id>.<exp>.<hmac>`; never includes the secret. */
export function signSession(
  id: string,
  secret: string,
  now = Date.now(),
  maxAgeMs = ANON_SESSION_MS,
) {
  const exp = now + maxAgeMs;
  const payload = `${id}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): string | undefined {
  if (!token) return undefined;
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  const [id, exp, signature] = parts as [string, string, string];
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const expiry = Number(exp);
  if (!Number.isSafeInteger(expiry) || expiry <= now) return undefined;
  const expected = Buffer.from(sign(`${id}.${exp}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;
  return id;
}

export function principalFromSession(
  token: string | undefined,
  config: IdentityConfig,
  now = Date.now(),
): { principal: Principal; renewedToken: string } {
  const existing = verifySession(token, config.secret, now);
  const id = existing ?? randomUUID();
  return {
    principal: { userId: `anon_${id}`, kind: 'anonymous', tier: 'anonymous' },
    renewedToken: signSession(id, config.secret, now),
  };
}

/** Upgrade the current anonymous session to an authenticated principal. */
export function upgradePrincipal(
  principal: Principal,
  subject: string,
  tier: 'free' | 'pro' = 'free',
): Principal {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(subject)) return principal;
  return { userId: `user_${subject}`, kind: 'user', tier };
}
