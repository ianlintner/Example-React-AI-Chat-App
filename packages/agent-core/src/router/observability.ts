/**
 * Shadow-log and metric seams. The HTTP shell owns Postgres and prom-client;
 * agent-core only names the operations, so it stays free of HTTP/node deps.
 */
import type { RouteDecision, Tier } from '@agent-chat/contract';
import type { RouterMode } from './config';

export interface RouteLogRow {
  decisionId: string;
  threadId: string;
  runId: string;
  ownerId: string;
  mode: RouterMode;
  source: RouteDecision['source'];
  skill: string;
  tier: Tier;
  needsResearch: boolean;
  needsPlan: boolean;
  confidence: number;
  margin: number;
  /** The decision that would have been used for dispatch in shadow mode. */
  proposed: RouteDecision;
  /** The decision actually dispatched (legacy when shadow, typed when live). */
  baseline: RouteDecision;
  /** Keyword-rule comparison retained for telemetry only. */
  comparison: RouteDecision;
  agreement: boolean;
  latencyMs: number;
}

export interface RouteSink {
  log(row: RouteLogRow): Promise<void>;
  close?(): Promise<void>;
}

export interface RouteMetrics {
  decisions(
    labels: {
      source: RouteDecision['source'];
      mode: RouterMode;
      skill: string;
      tier: Tier;
    },
    latencyMs: number,
    margin: number,
  ): void;
  agreement(agreed: boolean): void;
  fallback(reason: string): void;
  errors(reason: string): void;
}

/** No-op implementations used by `off` mode and tests. */
export const noopSink: RouteSink = {
  async log() {},
};
export const noopMetrics: RouteMetrics = {
  decisions() {},
  agreement() {},
  fallback() {},
  errors() {},
};
