import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Minimal in-memory stand-in for the Redis commands the buffer uses. */
const state = {
  lists: new Map<string, string[]>(),
  ttls: new Map<string, number>(),
};
vi.mock('ioredis', () => ({
  default: class {
    async rpush(key: string, value: string) {
      state.lists.set(key, [...(state.lists.get(key) ?? []), value]);
    }
    async expire(key: string, ttl: number) {
      state.ttls.set(key, ttl);
    }
    async lrange(key: string, start: number, stop: number) {
      const list = state.lists.get(key) ?? [];
      return list.slice(start, stop === -1 ? undefined : stop + 1);
    }
    async ttl(key: string) {
      return state.ttls.get(key) ?? -2;
    }
    async quit() {}
  },
}));

import { createRedisBuffer } from './store/redis';

describe('createRedisBuffer', () => {
  beforeEach(() => {
    state.lists.clear();
    state.ttls.clear();
  });

  it('replays chunks and stops at the finish sentinel', async () => {
    const buffer = createRedisBuffer('redis://localhost:6379');
    await buffer.append('run_1', { type: 'text-delta', id: '1', delta: 'a' });
    const replay = buffer.replay('run_1', 0);
    // Start reading before finish: replay must poll until the sentinel.
    const first = await replay[Symbol.asyncIterator]().next();
    expect((first.value as { delta: string }).delta).toBe('a');
    await buffer.finish('run_1');
    const rest: unknown[] = [];
    for await (const chunk of replay) rest.push(chunk);
    expect(rest).toHaveLength(0);
    expect(await buffer.count('run_1')).toBe(1);
    await buffer.close();
  });

  it('stops when the key TTL expires without a sentinel', async () => {
    const buffer = createRedisBuffer('redis://localhost:6379', 0);
    await buffer.append('run_2', { type: 'text-delta', id: '1', delta: 'x' });
    state.ttls.set('agent:stream:run_2', -1);
    const chunks: unknown[] = [];
    for await (const chunk of buffer.replay('run_2', 0)) chunks.push(chunk);
    expect(chunks).toHaveLength(1);
    await buffer.close();
  });
});
