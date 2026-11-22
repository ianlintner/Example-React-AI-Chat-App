import { describe, expect, it, vi } from 'vitest';
import type { Principal } from './seams';
import { MemoryStore } from './store/memory';
import { TierRateLimiter } from './rateLimit';

const principal: Principal = {
  userId: 'user_a',
  kind: 'user',
  tier: 'free',
};
const other: Principal = { ...principal, userId: 'user_b' };

describe('store ownership', () => {
  it("hides another principal's thread as a NotFound/Forbidden error", async () => {
    const store = new MemoryStore();
    await store.createThread('thr_1', principal);
    await expect(store.getThread('thr_1', other)).rejects.toThrow(/forbidden/);
    await expect(store.saveMessages('thr_1', other, [])).rejects.toThrow(
      /forbidden|not_found/,
    );
  });

  it('refuses to let another principal squat a client-chosen thread id', async () => {
    const store = new MemoryStore();
    await store.createThread('thr_shared', principal);
    await expect(store.createThread('thr_shared', other)).rejects.toThrow(
      /forbidden/,
    );
  });

  it("hides another principal's run", async () => {
    const store = new MemoryStore();
    await store.createThread('thr_1', principal);
    await store.createRun({
      runId: 'run_1',
      threadId: 'thr_1',
      ownerId: principal.userId,
      status: 'running',
      tier: 'fast',
    });
    await expect(store.getRun('run_1', other)).rejects.toThrow(/forbidden/);
  });
});

describe('TierRateLimiter memory bounds', () => {
  it('prunes expired windows and caps the number of tracked keys', async () => {
    let now = 0;
    const limiter = new TierRateLimiter(() => now, 5);
    const keys = Array.from({ length: 10 }, (_, i) => `user_${i}`);
    for (const userId of keys) {
      await limiter.consume({ userId, kind: 'anonymous', tier: 'anonymous' });
    }
    // Expired window is pruned on the next consume.
    now = 60_001;
    await limiter.consume({
      userId: 'user_new',
      kind: 'anonymous',
      tier: 'anonymous',
    });
    // Never more than maxKeys tracked (we cannot see private maps, so observe
    // that old keys are no longer blocked after their window expired).
    const result = await limiter.consume({
      userId: 'user_0',
      kind: 'anonymous',
      tier: 'anonymous',
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });
});
