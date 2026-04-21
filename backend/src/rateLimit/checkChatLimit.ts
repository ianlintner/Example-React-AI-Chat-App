import type { Tier } from '../middleware/identity';
import { TIER_LIMITS } from '../middleware/rateLimit';
import { logger } from '../logger';
import { getRateLimitRedis } from './redisClient';

/**
 * Shared tiered chat rate-limit check for code paths that sit outside
 * Express (Socket.IO in particular). The HTTP routes use
 * `express-rate-limit`; this helper applies the same per-minute and
 * per-day buckets so a caller can't bypass the quota by switching
 * transports.
 *
 * Storage is Redis when available (so the count is shared across pods)
 * and a per-process in-memory counter when Redis is unreachable — same
 * fail-open posture as the express-rate-limit store (availability wins
 * over strict enforcement).
 */

const MINUTE_SEC = 60;
const DAY_SEC = 24 * 60 * 60;

export type ChatLimitBucket = 'minute' | 'day';

export type ChatLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      bucket: ChatLimitBucket;
      limit: number;
      retryAfterSec: number;
    };

interface MemBucket {
  count: number;
  expiresAtMs: number;
}

const memStore = new Map<string, MemBucket>();

function memIncr(key: string, ttlSec: number, nowMs: number): MemBucket {
  const existing = memStore.get(key);
  if (!existing || existing.expiresAtMs <= nowMs) {
    const fresh: MemBucket = {
      count: 1,
      expiresAtMs: nowMs + ttlSec * 1000,
    };
    memStore.set(key, fresh);
    return fresh;
  }
  existing.count += 1;
  return existing;
}

async function redisIncr(
  client: Awaited<ReturnType<typeof getRateLimitRedis>>,
  key: string,
  ttlSec: number,
): Promise<{ count: number; ttlSec: number }> {
  if (!client) {
    throw new Error('redis client missing');
  }
  const incrRaw = await client.sendCommand(['INCR', key]);
  const count = Number(incrRaw);
  if (count === 1) {
    await client.sendCommand(['EXPIRE', key, String(ttlSec)]);
  }
  const ttlRaw = await client.sendCommand(['TTL', key]);
  const ttl = Number(ttlRaw);
  return { count, ttlSec: ttl < 0 ? ttlSec : ttl };
}

export async function checkChatRateLimit(
  identity: string,
  tier: Tier,
): Promise<ChatLimitResult> {
  const limits = TIER_LIMITS[tier];
  const minuteKey = `rl:socket-chat-min:${identity}`;
  const dayKey = `rl:socket-chat-day:${identity}`;

  let minuteCount = 0;
  let dayCount = 0;
  let minuteTtl = MINUTE_SEC;
  let dayTtl = DAY_SEC;

  try {
    const client = await getRateLimitRedis();
    if (client) {
      const min = await redisIncr(client, minuteKey, MINUTE_SEC);
      const day = await redisIncr(client, dayKey, DAY_SEC);
      minuteCount = min.count;
      minuteTtl = min.ttlSec;
      dayCount = day.count;
      dayTtl = day.ttlSec;
    } else {
      const now = Date.now();
      const min = memIncr(minuteKey, MINUTE_SEC, now);
      const day = memIncr(dayKey, DAY_SEC, now);
      minuteCount = min.count;
      minuteTtl = Math.max(0, Math.ceil((min.expiresAtMs - now) / 1000));
      dayCount = day.count;
      dayTtl = Math.max(0, Math.ceil((day.expiresAtMs - now) / 1000));
    }
  } catch (err) {
    // Fail open — a rate-limit-store outage must not break chat.
    logger.warn(
      { err, identity, tier },
      'Socket chat rate-limit check failed; allowing request',
    );
    return { allowed: true };
  }

  if (minuteCount > limits.chatPerMinute) {
    return {
      allowed: false,
      bucket: 'minute',
      limit: limits.chatPerMinute,
      retryAfterSec: minuteTtl,
    };
  }
  if (dayCount > limits.chatPerDay) {
    return {
      allowed: false,
      bucket: 'day',
      limit: limits.chatPerDay,
      retryAfterSec: dayTtl,
    };
  }
  return { allowed: true };
}

/**
 * Test-only reset. Exported for unit tests so the in-memory counter
 * does not leak across cases.
 */
export function __resetChatLimitMemStore(): void {
  memStore.clear();
}
