/** Shared context and helpers for goal-run advance/control transitions. */
import type { ApprovalRequest, Plan, Step } from '@agent-chat/contract';
import type { GoalRunStore } from './store';
import type {
  GoalBudget,
  GoalRunEvent,
  GoalRunRecord,
  GoalRunStatus,
  StepCheckpoint,
} from './types';

const EFFECT_COMMITTED = 'effect_already_committed';

export type AdvanceResult =
  | {
      outcome: 'approval-required';
      approval: ApprovalRequest;
      events: GoalRunEvent[];
    }
  | {
      outcome: 'stopped';
      reason: 'canceled' | 'budget' | 'replan-budget' | 'failed';
      record: GoalRunRecord;
      events: GoalRunEvent[];
    }
  | { outcome: 'completed'; record: GoalRunRecord; events: GoalRunEvent[] }
  | { outcome: 'pending'; record: GoalRunRecord; events: GoalRunEvent[] };

export type StopReason = Extract<
  AdvanceResult,
  { outcome: 'stopped' }
>['reason'];

/** Dependencies injected by GoalRunEngine into the advance state machine. */
export interface AdvanceContext {
  store: GoalRunStore;
  budget: GoalBudget;
  now(): string;
  newId(prefix: string): string;
  plan(input: {
    goal: string;
    revision: number;
    steerInstructions: readonly string[];
    priorCheckpoints: readonly StepCheckpoint[];
  }): Promise<Plan>;
  execute(input: {
    run: GoalRunRecord;
    step: Plan['steps'][number];
    attempt: number;
    idempotencyKey: string;
    steerInstructions: readonly string[];
    phase: 'propose' | 'commit';
  }): Promise<import('./types').StepResult>;
}

export async function loadRun(
  ctx: AdvanceContext,
  runId: string,
  ownerId?: string,
): Promise<GoalRunRecord> {
  const record = await ctx.store.getRun(runId, ownerId);
  if (!record) throw new Error('run_not_found');
  return record;
}

export function activeStop(record: GoalRunRecord): StopReason | undefined {
  if (record.canceled || record.status === 'canceled') return 'canceled';
  if (record.status === 'completed' || record.status === 'failed')
    return 'failed';
  if (record.status === 'awaiting-approval') return 'budget';
  return undefined;
}

export function checkpoint(
  record: GoalRunRecord,
  step: Plan['steps'][number],
  pending: Step[],
  cp: StepCheckpoint,
) {
  record.checkpoints.push(cp);
  pending.push({
    stepId: step.stepId,
    planId: record.plan?.planId,
    status: cp.status,
    attempt: cp.attempt,
    startedAt: cp.at,
    endedAt: cp.at,
    summary: cp.summary,
    predicatePassed: cp.predicatePassed,
    error: cp.error,
  });
}

export async function persist(
  ctx: AdvanceContext,
  record: GoalRunRecord,
  events: GoalRunEvent[],
  pending: Step[],
) {
  record.updatedAt = ctx.now();
  await ctx.store.saveRun(record);
  for (const step of pending.splice(0)) {
    events.push({ type: 'step', step });
  }
}

export async function finish(
  ctx: AdvanceContext,
  record: GoalRunRecord,
  events: GoalRunEvent[],
  status: 'completed' | 'failed',
  error?: string,
): Promise<AdvanceResult> {
  record.status = status;
  if (error) record.error = error;
  record.updatedAt = ctx.now();
  events.push({ type: 'status', status, error });
  await ctx.store.saveRun(record);
  return status === 'completed'
    ? { outcome: 'completed', record, events }
    : { outcome: 'stopped', reason: 'budget', record, events };
}

export function stopped(
  record: GoalRunRecord,
  events: GoalRunEvent[],
  reason: StopReason,
): AdvanceResult {
  events.push({
    type: 'status',
    status: record.status as GoalRunStatus,
    error: record.error,
  });
  return { outcome: 'stopped', reason, record, events };
}

/**
 * A long-running step can be superseded by cancel/steer/approval decisions.
 * Merge authoritative control fields from the store before the next step;
 * progress fields stay local to the loop.
 */
export async function refresh(
  ctx: AdvanceContext,
  record: GoalRunRecord,
  ownerId: string | undefined,
  events: GoalRunEvent[],
  pending: Step[],
): Promise<GoalRunRecord> {
  const latest = await loadRun(ctx, record.runId, ownerId);
  if (
    latest.canceled ||
    latest.status === 'canceled' ||
    latest.approval?.status === 'denied'
  ) {
    return latest;
  }
  const steerAdded = latest.steerInstructions.slice(
    record.steerInstructions.length,
  );
  record.canceled = latest.canceled;
  if (latest.status === 'awaiting-approval' || latest.status === 'running') {
    record.status = latest.status;
  }
  record.approval = latest.approval;
  record.steerInstructions = [...latest.steerInstructions];
  if (latest.pendingEffect?.key !== record.pendingEffect?.key) {
    record.pendingEffect = latest.pendingEffect;
  }
  for (const text of steerAdded) events.push({ type: 'steer', text });
  await persist(ctx, record, events, pending);
  return record;
}

/** Re-read control state after a long-running step without writing back. */
export async function checkControl(
  ctx: AdvanceContext,
  runId: string,
  ownerId: string | undefined,
): Promise<GoalRunRecord> {
  return loadRun(ctx, runId, ownerId);
}

export async function replan(
  ctx: AdvanceContext,
  record: GoalRunRecord,
  events: GoalRunEvent[],
): Promise<{ plan: Plan } | { stopped: 'replan-budget' }> {
  const revision = (record.plan?.revision ?? -1) + 1;
  if (revision > ctx.budget.maxReplans) {
    // Persist the terminal state: a rejected budget must not leave the run
    // stuck in `running` forever.
    record.status = 'failed';
    record.error = 'replan_budget_exceeded';
    record.updatedAt = ctx.now();
    await ctx.store.saveRun(record);
    events.push({
      type: 'status',
      status: 'failed',
      error: 'replan_budget_exceeded',
    });
    return { stopped: 'replan-budget' };
  }
  const plan = await ctx.plan({
    goal: record.goal,
    revision,
    steerInstructions: record.steerInstructions,
    priorCheckpoints: record.checkpoints,
  });
  record.status = 'running';
  record.updatedAt = ctx.now();
  await ctx.store.saveRun(record);
  events.push({ type: 'plan', plan });
  return { plan };
}

export { EFFECT_COMMITTED };
