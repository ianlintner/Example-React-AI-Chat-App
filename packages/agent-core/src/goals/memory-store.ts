/** In-process GoalRunStore sharing MemoryStore's StoreData. */
import type { GoalRunStore } from './store';
import type { GoalRunRecord } from './types';
import type { StoreData } from '../store/types';

export class MemoryGoalRunStore implements GoalRunStore {
  private readonly data: Map<string, GoalRunRecord>;
  private readonly effects: Set<string>;

  constructor(storeData: StoreData) {
    storeData.goalRuns ??= new Map();
    this.data = storeData.goalRuns;
    storeData.goalRunEffects ??= new Set();
    this.effects = storeData.goalRunEffects;
  }

  async createRun(record: GoalRunRecord) {
    if (this.data.has(record.runId)) return;
    this.data.set(record.runId, structuredClone(record));
  }

  async getRun(runId: string, ownerId?: string) {
    const record = this.data.get(runId);
    if (!record) return undefined;
    if (ownerId && record.ownerId !== ownerId) return undefined;
    return structuredClone(record);
  }

  async saveRun(record: GoalRunRecord, expectedUpdatedAt?: string) {
    const current = this.data.get(record.runId);
    if (expectedUpdatedAt && current?.updatedAt !== expectedUpdatedAt) {
      throw new Error('stale_checkpoint');
    }
    this.data.set(record.runId, structuredClone(record));
  }

  async claimEffect(key: string, runId: string) {
    if (this.effects.has(key)) return false;
    this.effects.add(key);
    return true;
  }

  async listRuns(ownerId: string) {
    return [...this.data.values()]
      .filter(record => record.ownerId === ownerId)
      .map(record => structuredClone(record));
  }
}
