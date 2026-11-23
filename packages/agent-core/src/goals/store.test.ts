/** At-most-once effect claims and compare-and-set on goal-run records. */
import { describe, expect, it } from 'vitest';
import { emptyStoreData } from '../store/memory';
import { MemoryGoalRunStore } from './index';
import type { GoalRunRecord } from './types';

describe('goal run store concurrency guards', () => {
  it('claims an effect key atomically', async () => {
    const store = new MemoryGoalRunStore(emptyStoreData());
    expect(await store.claimEffect('key_1', 'run_1')).toBe(true);
    expect(await store.claimEffect('key_1', 'run_1')).toBe(false);
    expect(await store.claimEffect('key_2', 'run_1')).toBe(true);
  });

  it('rejects a stale checkpoint', async () => {
    const store = new MemoryGoalRunStore(emptyStoreData());
    const record: GoalRunRecord = {
      runId: 'run_cas',
      ownerId: 'owner_1',
      threadId: 'thread_cas',
      goal: 'g',
      status: 'running',
      canceled: false,
      checkpoints: [],
      sideEffects: [],
      steerInstructions: [],
      stepsExecuted: 0,
      costUnits: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await store.createRun(record);
    await store.saveRun(
      {
        ...record,
        status: 'completed',
        updatedAt: '2026-01-01T00:00:01.000Z',
      },
      record.updatedAt,
    );
    await expect(
      store.saveRun({ ...record, status: 'running' }, record.updatedAt),
    ).rejects.toThrow(/stale_checkpoint/);
  });
});
