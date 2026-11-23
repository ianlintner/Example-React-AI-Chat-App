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

export interface StartRunInput {
  ownerId: string;
  threadId: string;
  goal: string;
  runId?: string;
  idempotencyKey?: string;
}

export interface GoalRunService {
  store: GoalRunStore;
  engine: GoalRunEngine;
  start(input: StartRunInput): Promise<GoalRunRecord>;
  advance(runId: string, ownerId?: string): Promise<GoalRunEvent[]>;
  get(runId: string, ownerId?: string): Promise<GoalRunRecord | undefined>;
  approve(
    runId: string,
    approvalId: string,
    body: unknown,
    ownerId?: string,
  ): Promise<void>;
  deny(
    runId: string,
    approvalId: string,
    body: unknown,
    ownerId?: string,
  ): Promise<void>;
  steer(runId: string, body: unknown, ownerId?: string): Promise<void>;
  cancel(runId: string, ownerId?: string): Promise<void>;
}

export interface GoalRunServiceOptions {
  config: ServerConfig;
  llm: Llm;
  memoryStoreData?: StoreData;
  executor?: StepExecutor;
  planner?: import('@agent-chat/agent-core').PlanGenerator;
  newId?: (prefix: string) => string;
  /** Called after a run is started, for the Inngest `run/start` event. */
  onStart?: (record: GoalRunRecord, input: StartRunInput) => Promise<void>;
  /** Called after a human decision, for the Inngest `run/decision` event. */
  onDecision?: (input: {
    runId: string;
    approvalId: string;
    decision: 'approve' | 'deny';
    ownerId: string;
  }) => Promise<void>;
}

export function createGoalRunService(
  options: GoalRunServiceOptions,
): GoalRunService {
  const store: GoalRunStore = options.config.databaseUrl
    ? new PostgresGoalRunStore(options.config.databaseUrl)
    : new MemoryGoalRunStore(options.memoryStoreData!);

  const engine = new GoalRunEngine(store, {
    planner: options.planner ?? createLlmPlanner(options.llm),
    executor: options.executor ?? createLlmStepExecutor(options.llm),
    ...(options.newId ? { newId: options.newId } : {}),
  });

  const newId = options.newId ?? (() => crypto.randomUUID());

  /** Resolve a caller key to the same run after an agent-server restart. */
  async function findByIdempotencyKey(ownerId: string, key: string) {
    const runs = await store.listRuns(ownerId);
    return runs.find(record => record.idempotencyKey === key);
  }

  /** 404 on a run the caller does not own (never a 409 leak). */
  async function requireOwner(runId: string, ownerId?: string) {
    const record = await store.getRun(runId, ownerId);
    if (!record) throw new RunNotFoundError();
    return record;
  }

  return {
    store,
    engine,
    async start(input) {
      const parsed = startRunRequestSchema.parse({
        threadId: input.threadId,
        goal: input.goal,
        ...(input.idempotencyKey
          ? { idempotencyKey: input.idempotencyKey }
          : {}),
      });
      let runId = input.runId;
      if (!runId && parsed.idempotencyKey) {
        runId = (
          await findByIdempotencyKey(input.ownerId, parsed.idempotencyKey)
        )?.runId;
      }
      const record = await engine.start({
        runId: runId ?? newId('run'),
        threadId: parsed.threadId,
        ownerId: input.ownerId,
        goal: parsed.goal,
        idempotencyKey: parsed.idempotencyKey,
      });
      if (options.onStart) await options.onStart(record, input);
      return record;
    },
    async advance(runId, ownerId) {
      const result = await engine.advance(runId, ownerId);
      return result.events;
    },
    get(runId, ownerId) {
      return store.getRun(runId, ownerId);
    },
    async approve(runId, approvalId, body, ownerId) {
      const parsed = approvalDecisionSchema.parse(body);
      if (parsed.decision !== 'approve') throw new Error('decision_mismatch');
      const run = await requireOwner(runId, ownerId);
      await engine.approve(runId, approvalId, ownerId);
      await options.onDecision?.({
        runId,
        approvalId,
        decision: 'approve',
        ownerId: run.ownerId,
      });
    },
    async deny(runId, approvalId, body, ownerId) {
      const parsed = approvalDecisionSchema.parse(body);
      if (parsed.decision !== 'deny') throw new Error('decision_mismatch');
      const run = await requireOwner(runId, ownerId);
      await engine.deny(runId, approvalId, parsed.reason, ownerId);
      await options.onDecision?.({
        runId,
        approvalId,
        decision: 'deny',
        ownerId: run.ownerId,
      });
    },
    async steer(runId, body, ownerId) {
      const parsed = steerRequestSchema.parse(body);
      await requireOwner(runId, ownerId);
      await engine.steer(runId, parsed.text, ownerId);
    },
    async cancel(runId, ownerId) {
      await requireOwner(runId, ownerId);
      await engine.cancel(runId, ownerId);
    },
  };
}

/** Unknown/foreign run: routes translate this to 404. */
export class RunNotFoundError extends Error {
  constructor() {
    super('run_not_found');
    this.name = 'RunNotFoundError';
  }
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
