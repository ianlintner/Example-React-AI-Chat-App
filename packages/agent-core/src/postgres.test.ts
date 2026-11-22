import { beforeEach, describe, expect, it, vi } from 'vitest';

const queries: Array<{ sql: string; params: unknown[] }> = [];
const rows: { threads?: unknown[]; runs?: unknown[]; messages?: unknown[] } =
  {};
vi.mock('pg', () => ({
  default: {
    Pool: class {
      async query(sql: string, params: unknown[] = []) {
        queries.push({ sql, params });
        const normalized = sql.replace(/\s+/g, ' ').trim();
        if (normalized.startsWith('select * from threads')) {
          return { rows: rows.threads ?? [] };
        }
        if (normalized.startsWith('select * from runs')) {
          return { rows: rows.runs ?? [] };
        }
        if (normalized.startsWith('select messages')) {
          return { rows: rows.messages ?? [] };
        }
        return { rows: [] };
      }
      async end() {}
    },
  },
}));

import { PostgresStore } from './store/postgres';

const principal = {
  userId: 'user_a',
  kind: 'user' as const,
  tier: 'free' as const,
};
const other = { ...principal, userId: 'user_b' };
const buffer = {
  append: vi.fn(async () => {}),
  finish: vi.fn(async () => {}),
  replay: async function* () {},
  count: async () => 0,
  close: async () => {},
};

describe('PostgresStore', () => {
  beforeEach(() => {
    queries.length = 0;
    rows.threads = undefined;
    rows.runs = undefined;
    rows.messages = undefined;
  });

  it('maps a foreign thread to a forbidden error, never leaking rows', async () => {
    const store = new PostgresStore('postgres://localhost/test', buffer);
    rows.threads = [
      {
        thread_id: 'thr_1',
        owner_id: 'user_b',
        title: 'secret',
        created_at: '',
        updated_at: '',
      },
    ];
    await expect(store.getThread('thr_1', principal)).rejects.toThrow(
      /forbidden/,
    );
    await expect(store.loadThread('thr_1', principal)).rejects.toThrow(
      /forbidden/,
    );
    await store.close();
  });

  it('maps a foreign run to a forbidden error', async () => {
    const store = new PostgresStore('postgres://localhost/test', buffer);
    rows.runs = [
      {
        run_id: 'run_1',
        thread_id: 'thr_1',
        owner_id: 'user_b',
        status: 'running',
        tier: 'fast',
      },
    ];
    await expect(store.getRun('run_1', principal)).rejects.toThrow(/forbidden/);
    expect((await store.getRun('run_1', other))?.runId).toBe('run_1');
    await store.close();
  });

  it('updates run status through the shared seam', async () => {
    const store = new PostgresStore('postgres://localhost/test', buffer);
    await store.setRunStatus('run_1', 'failed');
    expect(queries.some(q => q.sql.includes('update runs set status'))).toBe(
      true,
    );
    await store.close();
  });
});
