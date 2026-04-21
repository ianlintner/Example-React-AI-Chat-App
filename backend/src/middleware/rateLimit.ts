import rateLimit, { Options } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request } from 'express';
import { logger } from '../logger';
import { getRateLimitRedis } from '../rateLimit/redisClient';
import { metricsEmit } from '../metrics/prometheus';

/**
 * Tiered rate limits.
 *
 * Anonymous users get a stricter quota — they cost us (free-tier) LLM
 * calls but cannot be held accountable for abuse. Authenticated users
 * get a permissive quota because we can trace misuse back to an
 * account.
 *
 * Layered buckets:
 *   - per-minute   — smoothes bursts
 *   - per-day      — caps total cost per visitor
 *   - global ceiling — DoS protection across the entire service
 *
 * Redis is used when available (see `rateLimit/redisClient`). When
 * Redis is unreachable we fall back to the per-process in-memory
 * store and log the degradation — per-pod counts will diverge under
 * multi-replica deployments until Redis is back.
 */

const TIER_LIMITS = {
  anonymous: {
    apiPerMinute: 60,
    chatPerMinute: 5,
    chatPerDay: 50,
  },
  authenticated: {
    apiPerMinute: 300,
    chatPerMinute: 30,
    chatPerDay: 1000,
  },
} as const;

// Absolute DoS ceiling across all callers on this pod, keyed by IP.
const GLOBAL_IP_PER_SECOND = 50;

const ONE_SECOND = 1_000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;
const FIFTEEN_MINUTES = 15 * ONE_MINUTE;
const FIVE_MINUTES = 5 * ONE_MINUTE;

function tierOf(req: Request): keyof typeof TIER_LIMITS {
  return req.tier === 'authenticated' ? 'authenticated' : 'anonymous';
}

function identityKey(req: Request): string {
  return req.userId ?? req.ip ?? 'unknown';
}

/**
 * Build a RedisStore that routes commands through the shared lazy
 * client. Returns undefined when Redis is not configured — the
 * RedisStore constructor eagerly loads LUA scripts via sendCommand, so
 * we only construct it when `REDIS_URL` or `REDIS_HOST` is set.
 * Express-rate-limit then uses its default in-memory store, which is
 * fine for local dev and single-replica deployments.
 */
function redisStore(prefix: string): Options['store'] | undefined {
  const redisConfigured = Boolean(
    process.env.REDIS_URL || process.env.REDIS_HOST,
  );
  if (!redisConfigured) {
    return undefined;
  }
  try {
    return new RedisStore({
      prefix,
      sendCommand: async (...args: string[]) => {
        const client = await getRateLimitRedis();
        if (!client) {
          throw new Error('rate-limit redis unavailable');
        }
        return client.sendCommand(args) as Promise<
          string | number | (string | number)[]
        >;
      },
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to construct RedisStore; using memory store');
    return undefined;
  }
}

/**
 * General API rate limiter — applied globally to all routes. Keyed on
 * the resolved identity (authenticated user id or anon_<uuid>).
 */
export const apiRateLimiter = rateLimit({
  windowMs: ONE_MINUTE,
  max: req => TIER_LIMITS[tierOf(req)].apiPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore('rl:api-min:'),
  keyGenerator: identityKey,
  handler: (req, res) => {
    logger.warn(
      { identifier: identityKey(req), tier: tierOf(req) },
      'API rate limit exceeded',
    );
    metricsEmit.tier.rateLimitHit('http', tierOf(req), 'api');
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the per-minute API rate limit.',
      tier: tierOf(req),
      retryAfter: res.getHeader('Retry-After'),
    });
  },
  skip: req =>
    req.path === '/health' ||
    req.path === '/healthz' ||
    req.path === '/api/health',
});

/**
 * Short-window chat limiter. Layered with `chatDailyLimiter` on the
 * `/api/chat` routes.
 */
export const chatRateLimiter = rateLimit({
  windowMs: ONE_MINUTE,
  max: req => TIER_LIMITS[tierOf(req)].chatPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore('rl:chat-min:'),
  keyGenerator: identityKey,
  handler: (req, res) => {
    logger.warn(
      { identifier: identityKey(req), tier: tierOf(req) },
      'Chat per-minute rate limit exceeded',
    );
    metricsEmit.tier.rateLimitHit('http', tierOf(req), 'minute');
    res.status(429).json({
      error: 'Chat rate limit exceeded',
      message: 'Please wait a moment before sending another message.',
      tier: tierOf(req),
      limit: TIER_LIMITS[tierOf(req)].chatPerMinute,
      window: '1 minute',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

/**
 * Daily chat quota — prevents runaway LLM spend from a single visitor.
 */
export const chatDailyLimiter = rateLimit({
  windowMs: ONE_DAY,
  max: req => TIER_LIMITS[tierOf(req)].chatPerDay,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore('rl:chat-day:'),
  keyGenerator: identityKey,
  handler: (req, res) => {
    logger.warn(
      { identifier: identityKey(req), tier: tierOf(req) },
      'Chat daily quota exceeded',
    );
    metricsEmit.tier.rateLimitHit('http', tierOf(req), 'day');
    res.status(429).json({
      error: 'Daily chat quota exceeded',
      message:
        tierOf(req) === 'anonymous'
          ? 'Daily guest quota reached. Sign in for a higher limit.'
          : 'Daily chat quota reached. Try again tomorrow.',
      tier: tierOf(req),
      limit: TIER_LIMITS[tierOf(req)].chatPerDay,
      window: '24 hours',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

/**
 * Absolute per-pod DoS ceiling on IP. Blunt instrument sitting above
 * the tiered limits; scoped narrowly to protect the pod from a single
 * aggressive client.
 */
export const globalIpCeilingLimiter = rateLimit({
  windowMs: ONE_SECOND,
  max: GLOBAL_IP_PER_SECOND,
  standardHeaders: false,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore('rl:ip-sec:'),
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, 'Global IP ceiling hit');
    metricsEmit.tier.rateLimitHit('http', tierOf(req), 'global');
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests from this IP. Slow down.',
    });
  },
  skip: req =>
    req.path === '/health' ||
    req.path === '/healthz' ||
    req.path === '/api/health',
});

/**
 * Stricter limiter for authentication endpoints. Keyed on IP because
 * the caller has no verified identity yet.
 */
export const authRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore('rl:auth:'),
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, 'Auth rate limit exceeded');
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again later.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

/**
 * WebSocket HTTP-handshake rate limiter. Anonymous sockets only —
 * authenticated sockets are identity-keyed and protected via the
 * per-user chat limits above.
 */
export const socketConnectionLimiter = rateLimit({
  windowMs: FIVE_MINUTES,
  max: 20,
  standardHeaders: false,
  legacyHeaders: false,
  passOnStoreError: true,
  store: redisStore('rl:socket:'),
  handler: (req, res) => {
    logger.warn(
      { ip: req.ip, userId: req.userId },
      'Socket connection rate limit exceeded',
    );
    metricsEmit.tier.rateLimitHit('socket-http', tierOf(req), 'connection');
    res.status(429).json({
      error: 'Too many connection attempts',
      message: 'Please wait before trying to connect again.',
    });
  },
  skip: req => req.tier === 'authenticated',
});

export { TIER_LIMITS };
