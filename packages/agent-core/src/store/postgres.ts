/**
 * Postgres persistence for threads, messages and runs. The replay buffer is
 * delegated to Redis (see redis.ts) so streams remain resumable across
 * process restarts. Schema: apps/agent/migrations/001_init.sql.
 */
import type { AgentUIMessage, AgentUIMessageChunk } from '@agent-chat/contract';
import pg from 'pg';
import type { Principal } from '../seams';
import type { ChunkBuffer } from './redis';
import { ForbiddenError } from './types';
import type { RunInfo, RunStatus, ThreadInfo, ThreadStore } from './types';

const { Pool } = pg;

export class PostgresStore implements ThreadStore {
  private readonly pool: pg.Pool;

  constructor(
    connectionString: string,
    private readonly buffer: ChunkBuffer,
  ) {
    this.pool = new Pool({ connectionString, max: 5 });
  }

  private own(ownerId: string, principal: Principal) {
    if (ownerId !== principal.userId) throw new ForbiddenError();
  }

  /** Applies idempotent DDL. Called once on boot in local development. */
  async bootstrap(sql: string) {
    await this.pool.query(sql);
  }

  async createThread(
    threadId: string,
    principal: Principal,
    title = 'New thread',
  ) {
    const now = new Date().toISOString();
    await this.pool.query(
      `insert into threads (thread_id, owner_id, title, created_at, updated_at)
       values ($1, $2, $3, $4, $5)
       on conflict (thread_id) do nothing`,
      [threadId, principal.userId, title, now, now],
    );
    return this.getThread(threadId, principal) as Promise<ThreadInfo>;
  }

  async getThread(threadId: string, principal: Principal) {
    const { rows } = await this.pool.query<{
      thread_id: string;
      owner_id: string;
      title: string;
      created_at: string;
      updated_at: string;
    }>('select * from threads where thread_id = $1', [threadId]);
    const row = rows[0];
    if (!row) return undefined;
    this.own(row.owner_id, principal);
    return {
      threadId: row.thread_id,
      ownerId: row.owner_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listThreads(principal: Principal) {
    const { rows } = await this.pool.query<{
      thread_id: string;
      owner_id: string;
      title: string;
      created_at: string;
      updated_at: string;
    }>('select * from threads where owner_id = $1 order by updated_at desc', [
      principal.userId,
    ]);
    return rows.map(row => ({
      threadId: row.thread_id,
      ownerId: row.owner_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async loadThread(
    threadId: string,
    principal: Principal,
  ): Promise<AgentUIMessage[]> {
    await this.getThread(threadId, principal);
    const { rows } = await this.pool.query<{ messages: unknown }>(
      'select messages from thread_messages where thread_id = $1',
      [threadId],
    );
    return (rows[0]?.messages ?? []) as AgentUIMessage[];
  }

  async saveMessages(
    threadId: string,
    principal: Principal,
    messages: AgentUIMessage[],
  ) {
    await this.getThread(threadId, principal);
    const now = new Date().toISOString();
    await this.pool.query(
      `insert into thread_messages (thread_id, messages, updated_at) values ($1, $2, $3)
       on conflict (thread_id) do update set messages = excluded.messages, updated_at = excluded.updated_at`,
      [threadId, JSON.stringify(messages), now],
    );
    await this.pool.query(
      'update threads set updated_at = $1 where thread_id = $2',
      [now, threadId],
    );
  }

  async createRun(run: Omit<RunInfo, 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    await this.pool.query(
      `insert into runs (run_id, thread_id, owner_id, status, tier, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $6)`,
      [run.runId, run.threadId, run.ownerId, run.status, run.tier, now],
    );
    return { ...run, createdAt: now, updatedAt: now };
  }

  async getRun(runId: string, principal: Principal) {
    const { rows } = await this.pool.query<{
      run_id: string;
      thread_id: string;
      owner_id: string;
      status: RunStatus;
      tier: string;
    }>('select * from runs where run_id = $1', [runId]);
    const row = rows[0];
    if (!row) return undefined;
    this.own(row.owner_id, principal);
    return {
      runId: row.run_id,
      threadId: row.thread_id,
      ownerId: row.owner_id,
      status: row.status,
      tier: row.tier as RunInfo['tier'],
      createdAt: '',
      updatedAt: '',
    };
  }

  async setRunStatus(runId: string, status: RunStatus) {
    await this.pool.query(
      'update runs set status = $1, updated_at = now() where run_id = $2',
      [status, runId],
    );
  }

  async appendChunk(runId: string, chunk: AgentUIMessageChunk) {
    await this.buffer.append(runId, chunk);
  }

  async finishRun(runId: string) {
    await this.buffer.finish(runId);
  }

  replay(runId: string, fromIndex: number) {
    return this.buffer.replay(runId, fromIndex);
  }

  async chunkCount(runId: string) {
    return this.buffer.count(runId);
  }

  async close() {
    await this.pool.end();
    await this.buffer.close();
  }
}
