/**
 * Postgres persistence for durable goal runs. The full checkpoint is stored
 * as JSONB (it is a contract-validated, versioned record) and side-effect
 * keys live in a separate immutable ledger with a primary-key constraint.
 */
import pg from 'pg';
import type { GoalRunStore } from './store';
import type { GoalRunRecord } from './types';

const { Pool } = pg;

type Row = {
  run_id: string;
  owner_id: string;
  record: GoalRunRecord;
  updated_at: Date | string;
};

export class PostgresGoalRunStore implements GoalRunStore {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 3 });
  }

  /** Applies idempotent DDL. Called once on boot in local development. */
  async bootstrap(sql: string) {
    await this.pool.query(sql);
  }

  async createRun(record: GoalRunRecord) {
    await this.pool.query(
      `insert into goal_runs (run_id, owner_id, thread_id, record)
       values ($1, $2, $3, $4) on conflict (run_id) do nothing`,
      [record.runId, record.ownerId, record.threadId, JSON.stringify(record)],
    );
  }

  async getRun(runId: string, ownerId?: string) {
    const { rows } = await this.pool.query<Row>(
      'select run_id, owner_id, record, updated_at from goal_runs where run_id = $1',
      [runId],
    );
    const row = rows[0];
    if (!row || (ownerId && row.owner_id !== ownerId)) return undefined;
    return row.record;
  }

  async saveRun(record: GoalRunRecord, expectedUpdatedAt?: string) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (expectedUpdatedAt) {
        const { rows } = await client.query<{ updated_at: Date | string }>(
          'select updated_at from goal_runs where run_id = $1 for update',
          [record.runId],
        );
        if (!rows[0]) throw new Error('run_not_found');
        const actual = new Date(rows[0].updated_at).toISOString();
        if (actual !== expectedUpdatedAt) throw new Error('stale_checkpoint');
      }
      await client.query(
        `update goal_runs set record = $1, updated_at = now() where run_id = $2`,
        [JSON.stringify(record), record.runId],
      );
      // Insert effect keys idempotently; the ledger is the at-most-once guard.
      for (const key of record.sideEffects) {
        await client.query(
          `insert into goal_run_effects (effect_key, run_id) values ($1, $2)
           on conflict (effect_key) do nothing`,
          [key, record.runId],
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async listRuns(ownerId: string) {
    const { rows } = await this.pool.query<Row>(
      'select run_id, owner_id, record, updated_at from goal_runs where owner_id = $1 order by updated_at desc',
      [ownerId],
    );
    return rows.map(row => row.record);
  }

  async claimEffect(key: string, runId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `insert into goal_run_effects (effect_key, run_id) values ($1, $2)
       on conflict (effect_key) do nothing`,
      [key, runId],
    );
    return (rowCount ?? 0) > 0;
  }

  async close() {
    await this.pool.end();
  }
}
