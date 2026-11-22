/**
 * Goal-run state machine facade. Every transition loads the persisted record,
 * applies one decision and saves it — so a process dying mid-run simply
 * resumes from the last checkpoint. No side effect is attempted before its
 * idempotency key has been committed to the record.
 *
 * Control mutations (cancel/steer/approval) are always re-read from the store
 * before a step starts; a long-running step cannot clobber a decision made
 * while it was executing.
 */
import type { GoalRunStore } from './store';
import { RunStoppedError } from './errors';
import {
  DEFAULT_BUDGET,
  type EngineOptions,
  type GoalBudget,
  type GoalRunRecord,
} from './types';
import { advanceRun } from './advance';
import {
  loadRun,
  persist,
  type AdvanceContext,
  type AdvanceResult,
} from './advance-helpers';

export type { AdvanceResult } from './advance-helpers';

export class GoalRunEngine {
  readonly context: AdvanceContext;
  private readonly budget: GoalBudget;

  constructor(
    private readonly store: GoalRunStore,
    private readonly options: EngineOptions,
  ) {
    this.budget = { ...DEFAULT_BUDGET, ...options.budget };
    const now = options.now ?? (() => new Date().toISOString());
    const newId =
      options.newId ?? ((p: string) => `${p}_${crypto.randomUUID()}`);
    this.context = {
      store,
      budget: this.budget,
      now,
      newId,
      plan: input => options.planner.plan(input),
      execute: input => options.executor.execute(input),
    };
  }

  /** Create a fresh run and generate its initial plan (idempotent on retry). */
  async start(input: {
    runId: string;
    threadId: string;
    ownerId: string;
    goal: string;
    idempotencyKey?: string;
  }): Promise<GoalRunRecord> {
    const existing = await this.store.getRun(input.runId);
    if (existing) {
      if (existing.ownerId !== input.ownerId)
        throw new Error('run_id_conflict');
      // A retry with the same caller key resolves to the same run; a
      // different key for the same id is a caller bug, never a silent alias.
      if (
        input.idempotencyKey &&
        existing.idempotencyKey &&
        existing.idempotencyKey !== input.idempotencyKey
      ) {
        throw new Error('run_id_conflict');
      }
      return existing;
    }

    const at = this.context.now();
    const record: GoalRunRecord = {
      runId: input.runId,
      threadId: input.threadId,
      ownerId: input.ownerId,
      goal: input.goal,
      status: 'planning',
      checkpoints: [],
      stepsExecuted: 0,
      costUnits: 0,
      steerInstructions: [],
      canceled: false,
      sideEffects: input.idempotencyKey ? [input.idempotencyKey] : [],
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      createdAt: at,
      updatedAt: at,
    };
    await this.store.createRun(record);

    const plan = await this.options.planner.plan({
      goal: input.goal,
      revision: 0,
      steerInstructions: [],
      priorCheckpoints: [],
    });
    record.plan = plan;
    record.status = 'running';
    record.updatedAt = this.context.now();
    await this.store.saveRun(record);
    return record;
  }

  /** Run one bounded unit of work from the last durable checkpoint. */
  advance(runId: string, ownerId?: string): Promise<AdvanceResult> {
    return advanceRun(this.context, runId, ownerId);
  }

  /** Human approved: clear the gate and continue execution. */
  async approve(
    runId: string,
    approvalId: string,
    ownerId?: string,
  ): Promise<void> {
    const record = await loadRun(this.context, runId, ownerId);
    if (!record.approval || record.approval.approvalId !== approvalId) {
      throw new Error('approval_not_found');
    }
    if (record.approval.status !== 'pending') {
      throw new Error('approval_already_decided');
    }
    if (record.canceled || record.status === 'canceled') {
      throw new Error('run_canceled');
    }
    record.approval.status = 'approved';
    record.status = 'running';
    for (const step of record.plan?.steps ?? []) {
      if (step.status === 'awaiting-approval') step.status = 'pending';
    }
    await persist(this.context, record, [], []);
  }

  /** Human denied: the consequential tool is never called and the run stops. */
  async deny(
    runId: string,
    approvalId: string,
    reason?: string,
    ownerId?: string,
  ): Promise<void> {
    const record = await loadRun(this.context, runId, ownerId);
    if (!record.approval || record.approval.approvalId !== approvalId) {
      throw new Error('approval_not_found');
    }
    if (record.approval.status !== 'pending') {
      throw new Error('approval_already_decided');
    }
    record.approval.status = 'denied';
    record.pendingEffect = undefined;
    for (const step of record.plan?.steps ?? []) {
      if (step.status === 'awaiting-approval') step.status = 'skipped';
    }
    record.status = 'canceled';
    record.error = reason ? `approval_denied: ${reason}` : 'approval_denied';
    await persist(this.context, record, [], []);
  }

  /** Inject guidance; the next plan/step must reflect it. */
  async steer(runId: string, text: string, ownerId?: string): Promise<void> {
    const record = await loadRun(this.context, runId, ownerId);
    if (record.status === 'completed' || record.status === 'failed') {
      throw new RunStoppedError('failed', 'run_is_terminal');
    }
    if (record.canceled || record.status === 'canceled') {
      throw new RunStoppedError('canceled', 'run_canceled');
    }
    record.steerInstructions.push(text);
    await persist(this.context, record, [], []);
  }

  /** Cancel mid-run; subsequent advance() calls are no-ops. */
  async cancel(runId: string, ownerId?: string): Promise<void> {
    const record = await loadRun(this.context, runId, ownerId);
    if (record.status === 'completed' || record.status === 'failed') {
      throw new RunStoppedError('failed', 'run_is_terminal');
    }
    record.canceled = true;
    record.status = 'canceled';
    await persist(this.context, record, [], []);
  }
}
