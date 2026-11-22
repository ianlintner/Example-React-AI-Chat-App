/**
 * Thin adapter binding the durable goal-run engine to the HTTP/Inngest shell.
 * The engine itself lives in agent-core and knows nothing about transports.
 */
import {
  approvalDecisionSchema,
  startRunRequestSchema,
  steerRequestSchema,
} from '@agent-chat/contract';
import {
  createLlmPlanner,
  createLlmStepExecutor,
  GoalRunEngine,
  MemoryGoalRunStore,
  PostgresGoalRunStore,
  type GoalRunEvent,
  type GoalRunRecord,
  type GoalRunStore,
  type StepExecutor,
} from '@agent-chat/agent-core';
import { readFileSync } from 'node:fs';
import type { Llm, StoreData } from '@agent-chat/agent-core';
import type { ServerConfig } from '../config';

export interface GoalRunService {
  store: GoalRunStore;
  engine: GoalRunEngine;
  start(input: {
    ownerId: string;
    threadId: string;
    goal: string;
    runId?: string;
    idempotencyKey?: string;
  }): Promise<GoalRunRecord>;
  advance(runId: string): Promise<GoalRunEvent[]>;
  get(runId: string, ownerId: string): Promise<GoalRunRecord | undefined>;
  approve(runId: string, approvalId: string, body: unknown): Promise<void>;
  deny(runId: string, approvalId: string, body: unknown): Promise<void>;
  steer(runId: string, body: unknown): Promise<void>;
  cancel(runId: string): Promise<void>;
  events: GoalRunEvent[];
}

export function createGoalRunService(options: {
  config: ServerConfig;
  llm: Llm;
  memoryStoreData?: StoreData;
  executor?: StepExecutor;
  planner?: import('@agent-chat/agent-core').PlanGenerator;
  newId?: (prefix: string) => string;
}): GoalRunService {
  const store: GoalRunStore = options.config.databaseUrl
    ? new PostgresGoalRunStore(options.config.databaseUrl)
    : new MemoryGoalRunStore(options.memoryStoreData!);

  const engine = new GoalRunEngine(store, {
    planner: options.planner ?? createLlmPlanner(options.llm),
    executor: options.executor ?? createLlmStepExecutor(options.llm),
    ...(options.newId ? { newId: options.newId } : {}),
  });

  const events: GoalRunEvent[] = [];
  let counter = 0;
  const nextId = options.newId ?? (() => `run_${++counter}`);

  return {
    store,
    engine,
    events,
    async start(input) {
      const parsed = startRunRequestSchema.parse({
        threadId: input.threadId,
        goal: input.goal,
        ...(input.idempotencyKey
          ? { idempotencyKey: input.idempotencyKey }
          : {}),
      });
      return engine.start({
        runId: input.runId ?? nextId('run'),
        threadId: parsed.threadId,
        ownerId: input.ownerId,
        goal: parsed.goal,
        idempotencyKey: parsed.idempotencyKey,
      });
    },
    async advance(runId) {
      const { events: emitted } = await engine.advance(runId);
      events.push(...emitted);
      return emitted;
    },
    get(runId, ownerId) {
      return store.getRun(runId, ownerId);
    },
    async approve(runId, approvalId, body) {
      const parsed = approvalDecisionSchema.parse(body);
      if (parsed.decision !== 'approve') throw new Error('decision_mismatch');
      await engine.approve(runId, approvalId);
    },
    async deny(runId, approvalId, body) {
      const parsed = approvalDecisionSchema.parse(body);
      if (parsed.decision !== 'deny') throw new Error('decision_mismatch');
      await engine.deny(runId, approvalId, parsed.reason);
    },
    async steer(runId, body) {
      const parsed = steerRequestSchema.parse(body);
      await engine.steer(runId, parsed.text);
    },
    cancel(runId) {
      return engine.cancel(runId);
    },
  };
}

/** Load and apply the goal-run DDL on boot when Postgres is configured. */
export async function bootstrapGoalRuns(store: GoalRunStore): Promise<void> {
  if (!(store instanceof PostgresGoalRunStore)) return;
  const sql = readFileSync(
    new URL('../../migrations/002_goal_runs.sql', import.meta.url),
    'utf8',
  );
  await store.bootstrap(sql);
}
