/** Shared HTTP helpers: signed anon session + tiered rate limiting. */
import {
  ANON_COOKIE,
  ANON_SESSION_MS,
  principalFromSession,
  upgradePrincipal,
} from '@agent-chat/agent-core';
import type { Principal } from '@agent-chat/agent-core';
import { getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { Services } from './services';
import type { ServerConfig } from './config';

export type AppEnv = { Variables: { principal: Principal } };

export function resolvePrincipal(
  c: Context<AppEnv>,
  config: ServerConfig,
): Principal {
  const { principal, renewedToken } = principalFromSession(
    getCookie(c, ANON_COOKIE),
    { secret: config.sessionSecret },
  );
  setCookie(c, ANON_COOKIE, renewedToken, {
    httpOnly: true,
    sameSite: 'lax',
    // Local development is HTTP on loopback; secure cookies would be dropped.
    secure: c.req.url.startsWith('https://'),
    path: '/',
    maxAge: ANON_SESSION_MS / 1000,
  });
  const trusted = config.trustUserHeader
    ? c.req.header(config.trustUserHeader)
    : undefined;
  const resolved = trusted
    ? upgradePrincipal(principal, trusted, 'free')
    : principal;
  c.set('principal', resolved);
  return resolved;
}

export async function checkRateLimit(
  c: Context<AppEnv>,
  services: Services,
  principal: Principal,
): Promise<Response | undefined> {
  const result = await services.limiter.consume(principal);
  c.header('x-ratelimit-limit', String(result.limit));
  c.header('x-ratelimit-remaining', String(result.remaining));
  if (result.allowed) return undefined;
  c.header('retry-after', String(Math.ceil(result.retryAfterMs / 1000)));
  return c.json(
    { error: 'rate_limited', retryAfterMs: result.retryAfterMs },
    429,
  );
}
