/** Postgres store CAS/effect-ledger behaviour with a fake pg pool. */
import { describe, expect, it } from 'vitest';
import { PostgresGoalRunStore } from './postgres-store';
import type { GoalRunRecord } from './types';

type Row = { record: unknown; updated_at: string; run_id: string };

function fakePool(initial?: GoalRunRecord) {
  const rows = new Map<string, Row>();
  const effects = new Set<string>();
  if (initial) {
    rows.set(initial.runId, {
      run_id: initial.runId,
      record: structuredClone(initial),
      updated_at: initial.updatedAt,
    });
  }
  const queries: string[] = [];
  const pool = {
    async query(sql: string, params?: unknown[]) {
      queries.push(sql);
      if (/insert into goal_runs/.test(sql)) {
        const r = params![3] as GoalRunRecord;
        if (!rows.has(r.runId)) {
          rows.set(r.runId, {
            run_id: r.runId,
            record: structuredClone(r),
            updated_at: params![4] as string,
          });
        }
        return { rows: [], rowCount: 0 };
      }
      if (/select updated_at from goal_runs/.test(sql)) {
        const row = rows.get(params![0] as string);
        return {
          rows: row ? [{ updated_at: row.updated_at }] : [],
          rowCount: row ? 1 : 0,
        };
      }
      if (/update goal_runs set record/.test(sql)) {
        const id = params![1] as string;
        const row = rows.get(id);
        if (!row) return { rows: [], rowCount: 0 };
        row.record = JSON.parse(params![0] as string) as GoalRunRecord;
        row.updated_at = params![2] as string;
        return { rows: [], rowCount: 1 };
      }
      if (/insert into goal_run_effects/.test(sql)) {
        const key = params![0] as string;
        if (effects.has(key)) return { rows: [], rowCount: 0 };
        effects.add(key);
        return { rows: [], rowCount: 1 };
      }
      if (/select run_id, owner_id, record/.test(sql)) {
        const owner = params?.[1];
        const found = [...rows.values()].filter(
          r =>
            r.run_id === params![0] &&
            (!owner || (r.record as GoalRunRecord).ownerId === owner),
        );
        return { rows: found, rowCount: found.length };
      }
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      return {
        query: (sql: string, params?: unknown[]) => pool.query(sql, params),
        release() {},
      };
    },
  };
  return { pool, rows, effects, queries };
}

const record: GoalRunRecord = {
  runId: 'run_pg',
  ownerId: 'owner_1',
  threadId: 'thread_1',
  goal: 'g',
  status: 'running',
  checkpoints: [],
  stepsExecuted: 0,
  costUnits: 0,
  steerInstructions: [],
  canceled: false,
  sideEffects: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  idempotencyKey: 'start_key:with:colons',
};

describe('PostgresGoalRunStore', () => {
  it('compare-and-set accepts the record timestamp and writes it back', async () => {
    const { pool, rows } = fakePool(record);
    const store = Object.create(
      PostgresGoalRunStore.prototype,
    ) as PostgresGoalRunStore;
    (store as unknown as { pool: unknown }).pool = pool;
    await store.saveRun(
      {
        ...record,
        status: 'completed',
        updatedAt: '2026-01-01T00:00:01.000Z',
      },
      record.updatedAt,
    );
    expect(rows.get('run_pg')!.updated_at).toBe('2026-01-01T00:00:01.000Z');
    expect((rows.get('run_pg')!.record as GoalRunRecord).status).toBe(
      'completed',
    );
  });

  it('compare-and-set rejects a stale checkpoint', async () => {
    const { pool } = fakePool(record);
    const store = Object.create(
      PostgresGoalRunStore.prototype,
    ) as PostgresGoalRunStore;
    (store as unknown as { pool: unknown }).pool = pool;
    await expect(
      store.saveRun(
        {
          ...record,
          status: 'completed',
          updatedAt: '2026-01-01T00:00:01.000Z',
        },
        '2025-12-31T00:00:00.000Z',
      ),
    ).rejects.toThrow(/stale_checkpoint/);
  });

  it('does not put the caller start key in the effect ledger', async () => {
    const { pool, effects } = fakePool(record);
    const store = Object.create(
      PostgresGoalRunStore.prototype,
    ) as PostgresGoalRunStore;
    (store as unknown as { pool: unknown }).pool = pool;
    await store.saveRun(
      {
        ...record,
        sideEffects: ['start_key:with:colons', 'run_pg:step_0:1:effect_1'],
        updatedAt: '2026-01-01T00:00:01.000Z',
      },
      record.updatedAt,
    );
    expect([...effects]).toEqual(['run_pg:step_0:1:effect_1']);
  });
});
