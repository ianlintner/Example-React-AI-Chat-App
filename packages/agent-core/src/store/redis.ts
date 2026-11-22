/** Redis list-backed replay buffer for resumable streams. */
import type { AgentUIMessageChunk } from '@agent-chat/contract';
import Redis from 'ioredis';

const KEY_PREFIX = 'agent:stream:';

export interface ChunkBuffer {
  append(runId: string, chunk: AgentUIMessageChunk): Promise<void>;
  /** Marks a run complete so replay loops terminate without waiting for TTL. */
  finish(runId: string): Promise<void>;
  replay(runId: string, fromIndex: number): AsyncIterable<AgentUIMessageChunk>;
  count(runId: string): Promise<number>;
  close(): Promise<void>;
}

const SENTINEL = '{"type":"__run_complete__"}';

export function createRedisBuffer(url: string, ttlSeconds = 3600): ChunkBuffer {
  const redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  return {
    async append(runId, chunk) {
      const key = KEY_PREFIX + runId;
      await redis.rpush(key, JSON.stringify(chunk));
      await redis.expire(key, ttlSeconds);
    },
    async finish(runId) {
      const key = KEY_PREFIX + runId;
      await redis.rpush(key, SENTINEL);
      await redis.expire(key, ttlSeconds);
    },
    async *replay(runId, fromIndex) {
      const key = KEY_PREFIX + runId;
      // Poll from the cursor: the run can still be appending while we replay.
      let cursor = Math.max(0, fromIndex);
      for (;;) {
        const values = await redis.lrange(key, cursor, -1);
        if (values.length === 0) {
          const remainingTtl = await redis.ttl(key);
          if (remainingTtl <= 0) return;
          await new Promise(resolve => setTimeout(resolve, 25));
          continue;
        }
        for (const value of values) {
          cursor++;
          if (value === SENTINEL) return;
          yield JSON.parse(value) as AgentUIMessageChunk;
        }
      }
    },
    async count(runId) {
      const values = await redis.lrange(KEY_PREFIX + runId, 0, -1);
      return values.filter(value => value !== SENTINEL).length;
    },
    async close() {
      await redis.quit();
    },
  };
}
