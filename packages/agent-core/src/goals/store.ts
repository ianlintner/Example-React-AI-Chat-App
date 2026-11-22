/**
 * Persistence seam for goal runs. Kept separate from `ThreadStore` (card 4)
 * so the chat path stays unchanged; both are backed by the same store
 * implementations (MemoryStore / PostgresStore).
 */
import type { GoalRunRecord } from './types';

export interface GoalRunStore {
  createRun(record: GoalRunRecord): Promise<void>;
  getRun(runId: string, ownerId?: string): Promise<GoalRunRecord | undefined>;
  /**
   * Atomic compare-and-set on `updatedAt`. Rejects stale writers so a
   * concurrent cancel/steer cannot be overwritten by a long-running step.
   */
  saveRun(record: GoalRunRecord, expectedUpdatedAt?: string): Promise<void>;
  /** Atomic at-most-once claim; false means another writer owns the key. */
  claimEffect(key: string, runId: string): Promise<boolean>;
  listRuns(ownerId: string): Promise<GoalRunRecord[]>;
}

/** Thrown when a CAS write loses to a newer checkpoint. */
export class StaleCheckpointError extends Error {
  constructor() {
    super('stale_checkpoint');
    this.name = 'StaleCheckpointError';
  }
}
