/**
 * Persistence seam for goal runs. Kept separate from `ThreadStore` (card 4)
 * so the chat path stays unchanged; both are backed by the same store
 * implementations (MemoryStore / PostgresStore).
 */
import type { GoalRunRecord } from './types';

export interface GoalRunStore {
  createRun(record: GoalRunRecord): Promise<void>;
  getRun(runId: string, ownerId?: string): Promise<GoalRunRecord | undefined>;
  /** Atomic compare-and-set on `updatedAt`; rejects stale writers. */
  saveRun(record: GoalRunRecord, expectedUpdatedAt?: string): Promise<void>;
  /** Atomic at-most-once claim; false means another writer owns the key. */
  claimEffect(key: string, runId: string): Promise<boolean>;
  listRuns(ownerId: string): Promise<GoalRunRecord[]>;
}
