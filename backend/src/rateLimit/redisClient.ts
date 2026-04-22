import { createClient, RedisClientType } from 'redis';
import { logger } from '../logger';

/**
 * Shared Redis client for rate-limit stores. Lazily connects on first
 * use. If the connection fails we stay disconnected; callers should
 * treat `getRateLimitRedis()` returning null as "fall back to the
 * express-rate-limit in-memory store" rather than an error — the app
 * must still serve traffic when Redis is down.
 */

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;
let disabled = false;

function buildUrl(): string {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD || '';
  const authSegment = password ? `:${encodeURIComponent(password)}@` : '';
  return `redis://${authSegment}${host}:${port}`;
}

export async function getRateLimitRedis(): Promise<RedisClientType | null> {
  if (disabled) {
    return null;
  }
  if (client?.isOpen) {
    return client;
  }
  if (connecting) {
    return connecting;
  }
  connecting = (async () => {
    try {
      const c = createClient({ url: buildUrl() }) as RedisClientType;
      c.on('error', err => {
        logger.error({ err }, 'Rate-limit Redis error');
      });
      await c.connect();
      client = c;
      logger.info('Rate-limit Redis connected');
      return c;
    } catch (err) {
      logger.warn(
        { err },
        'Rate-limit Redis unavailable; falling back to in-memory store',
      );
      disabled = true;
      return null;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

/**
 * Hook for tests / graceful shutdown.
 */
export async function closeRateLimitRedis(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
  disabled = false;
}
