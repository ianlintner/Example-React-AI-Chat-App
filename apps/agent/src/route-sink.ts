/** Postgres-backed sink for shadow routing decisions. */
import pg from 'pg';
import type { RouteLogRow, RouteSink } from '@agent-chat/agent-core';

const { Pool } = pg;

export class PostgresRouteSink implements RouteSink {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 2 });
  }

  async log(row: RouteLogRow): Promise<void> {
    await this.pool.query(
      `insert into route_decisions (
         decision_id, thread_id, run_id, owner_id, mode, source, skill, tier,
         needs_research, needs_plan, confidence, margin, proposed, baseline,
         comparison, agreement, latency_ms
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17)`,
      [
        row.decisionId,
        row.threadId,
        row.runId,
        row.ownerId,
        row.mode,
        row.source,
        row.skill,
        row.tier,
        row.needsResearch,
        row.needsPlan,
        row.confidence,
        row.margin,
        JSON.stringify(row.proposed),
        JSON.stringify(row.baseline),
        JSON.stringify(row.comparison),
        row.agreement,
        row.latencyMs,
      ],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
