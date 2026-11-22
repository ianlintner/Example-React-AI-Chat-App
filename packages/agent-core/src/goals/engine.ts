/**
 * Goal-run state machine. Every transition loads the persisted record,
 * applies one decision and saves it — so a process dying mid-run simply
 * resumes from the last checkpoint. No side effect is attempted before its
 * idempotency key has been committed to the record.
 */
import type { ApprovalRequest, Plan } from '@agent-chat/contract';
import type { Step } from '@agent-chat/contract';
import type { GoalRunStore } from './store';
import { ApprovalRequiredError, RunStoppedError } from './errors';
import {
  DEFAULT_BUDGET,
  type EngineOptions,
  type GoalBudget,
  type GoalRunEvent,
  type GoalRunRecord,
  type GoalRunStatus,
  type StepCheckpoint,
  type StepResult,
} from './types';

const EFFECT_COMMITTED = 'effect_already_committed';

export class GoalRunEngine {
  private readonly budget: GoalBudget;
  private readonly now: () => string;
  private readonly newId: (prefix: string) => string;
  private pendingStepEvents: Step[] = [];

  constructor(
    private readonly store: GoalRunStore,
    private readonly options: EngineOptions,
  ) {
    this.budget = { ...DEFAULT_BUDGET, ...options.budget };
    this.now = options.now ?? (() => new Date().toISOString());
    this.newId =
      options.newId ?? ((p: string) => `${p}_${crypto.randomUUID()}`);
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
    if (existing) return existing;

    const at = this.now();
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
    record.updatedAt = this.now();
    await this.store.saveRun(record);
    return record;
  }

  /**
   * Run steps until the goal succeeds, a human gate is reached, the run stops
   * or a budget is exhausted. One bounded unit of work per invocation; the
   * Inngest function calls `advance` again after approval/steer resumes it.
   */
  async advance(runId: string): Promise<{
    record: GoalRunRecord;
    events: GoalRunEvent[];
  }> {
    const events: GoalRunEvent[] = [];
    const record = await this.load(runId);
    this.assertActive(record);
    if (!record.plan) {
      record.plan = await this.replan(record, events);
    }
    events.push({ type: 'plan', plan: record.plan });

    let guard = 0;
    while (guard++ < this.budget.maxSteps) {
      this.assertActive(record);
      const step = record.plan.steps.find(s => s.status === 'pending');
      if (!step) {
        if (record.plan.steps.every(s => s.status === 'succeeded')) {
          return await this.finish(record, events, 'completed');
        }
        record.plan = await this.replan(record, events);
        continue;
      }

      const attempt =
        record.checkpoints.filter(c => c.stepId === step.stepId).length + 1;
      const idempotencyKey = `${runId}:${step.stepId}:${attempt}`;
      const pending = record.pendingEffect;
      const commit =
        pending?.stepId === step.stepId &&
        pending.attempt === attempt &&
        pending.idempotencyKey === idempotencyKey;
      const effectKey = commit
        ? `${idempotencyKey}:${pending!.key}`
        : undefined;

      // A crash after the tool committed but before the checkpoint is saved
      // leaves the key in the ledger. Never replay that step's effect: the
      // card requires at-most-once side effects, so a lost effect (reported
      // as committed) is preferred over repeating a consequential action.
      // The executor's `commit` phase is responsible for checking the key
      // with the tool itself for true at-most-once semantics.
      if (commit && effectKey && record.sideEffects.includes(effectKey)) {
        record.approval = undefined;
        record.pendingEffect = undefined;
        record.status = 'running';
        this.checkpoint(record, step, {
          stepId: step.stepId,
          status: 'succeeded',
          attempt,
          predicatePassed: true,
          summary: EFFECT_COMMITTED,
          at: this.now(),
        });
        await this.persist(record, events);
        continue;
      }

      // Register the effect key BEFORE the commit-phase executor call.
      if (commit && effectKey) {
        record.sideEffects.push(effectKey);
        record.status = 'running';
        await this.persist(record, events);
      }
      step.status = 'running';
      await this.persist(record, events);

      let result: StepResult;
      try {
        result = await this.options.executor.execute({
          run: record,
          step,
          attempt,
          idempotencyKey,
          steerInstructions: record.steerInstructions,
          phase: commit ? 'commit' : 'propose',
        });
      } catch {
        step.status = 'failed';
        this.checkpoint(record, step, {
          stepId: step.stepId,
          status: 'failed',
          attempt,
          error: 'step_execution_failed',
          at: this.now(),
        });
        await this.persist(record, events);
        record.plan = await this.replan(record, events);
        continue;
      }

      // A consequential effect needs a human gate before it may execute.
      if (result.effect && !commit) {
        const approvalId = this.newId('appr');
        record.approval = {
          approvalId,
          toolName: result.effect.toolName,
          runId,
          risk: result.effect.risk,
          summary: result.effect.summary,
          payload: result.effect.payload,
          status: 'pending',
        };
        record.pendingEffect = {
          stepId: step.stepId,
          attempt,
          idempotencyKey,
          ...result.effect,
        };
        record.status = 'awaiting-approval';
        step.status = 'awaiting-approval';
        await this.persist(record, events);
        events.push({ type: 'approval-request', approval: record.approval });
        throw new ApprovalRequiredError(record.approval);
      }

      // Commit phase completed: clear the gate so a later crash cannot
      // re-enter the approval flow for the same step.
      if (commit) {
        record.approval = undefined;
        record.pendingEffect = undefined;
        record.status = 'running';
        await this.persist(record, events);
      }

      record.costUnits += result.costUnits ?? 0;
      record.stepsExecuted += 1;
      if (record.costUnits > this.budget.maxCostUnits) {
        return await this.finish(
          record,
          events,
          'failed',
          'cost_budget_exceeded',
        );
      }

      step.status = result.predicatePassed ? 'succeeded' : 'failed';
      this.checkpoint(record, step, {
        stepId: step.stepId,
        status: step.status,
        attempt,
        predicatePassed: result.predicatePassed,
        summary: result.summary,
        at: this.now(),
      });
      await this.persist(record, events);

      if (!result.predicatePassed) {
        record.plan = await this.replan(record, events);
      }
    }
    return await this.finish(record, events, 'failed', 'step_budget_exceeded');
  }

  /** Human approved: clear the gate and continue execution. */
  async approve(runId: string, approvalId: string): Promise<void> {
    const record = await this.load(runId);
    if (!record.approval || record.approval.approvalId !== approvalId) {
      throw new Error('approval_not_found');
    }
    if (record.approval.status !== 'pending') {
      throw new Error('approval_already_decided');
    }
    record.approval.status = 'approved';
    record.status = 'running';
    for (const step of record.plan?.steps ?? []) {
      if (step.status === 'awaiting-approval') step.status = 'pending';
    }
    await this.store.saveRun(record);
  }

  /** Human denied: the consequential tool is never called and the run stops. */
  async deny(
    runId: string,
    approvalId: string,
    reason?: string,
  ): Promise<void> {
    const record = await this.load(runId);
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
    await this.store.saveRun(record);
  }

  /** Inject guidance; the next plan/step must reflect it. */
  async steer(runId: string, text: string): Promise<void> {
    const record = await this.load(runId);
    if (record.status === 'completed' || record.status === 'failed') {
      throw new RunStoppedError('failed', 'run_is_terminal');
    }
    record.steerInstructions.push(text);
    record.updatedAt = this.now();
    await this.store.saveRun(record);
  }

  /** Cancel mid-run; subsequent advance() calls are no-ops. */
  async cancel(runId: string): Promise<void> {
    const record = await this.load(runId);
    record.canceled = true;
    record.status = 'canceled';
    record.updatedAt = this.now();
    await this.store.saveRun(record);
  }

  // ---- internals -------------------------------------------------------

  private async load(runId: string): Promise<GoalRunRecord> {
    const record = await this.store.getRun(runId);
    if (!record) throw new Error('run_not_found');
    return record;
  }

  private assertActive(record: GoalRunRecord) {
    if (record.canceled || record.status === 'canceled') {
      throw new RunStoppedError('canceled', 'run_canceled');
    }
    if (record.status === 'completed' || record.status === 'failed') {
      throw new RunStoppedError('failed', 'run_is_terminal');
    }
    if (record.status === 'awaiting-approval') {
      throw new ApprovalRequiredError(
        record.approval ?? ({} as ApprovalRequest),
      );
    }
  }

  private checkpoint(
    record: GoalRunRecord,
    step: Plan['steps'][number],
    checkpoint: StepCheckpoint,
  ) {
    record.checkpoints.push(checkpoint);
    this.pendingStepEvents.push({
      stepId: step.stepId,
      planId: record.plan?.planId,
      status: checkpoint.status,
      attempt: checkpoint.attempt,
      startedAt: checkpoint.at,
      endedAt: checkpoint.at,
      summary: checkpoint.summary,
      predicatePassed: checkpoint.predicatePassed,
      error: checkpoint.error,
    });
  }

  private async persist(record: GoalRunRecord, events: GoalRunEvent[]) {
    record.updatedAt = this.now();
    await this.store.saveRun(record);
    for (const step of this.pendingStepEvents.splice(0)) {
      events.push({ type: 'step', step });
    }
  }

  private async replan(
    record: GoalRunRecord,
    events: GoalRunEvent[],
  ): Promise<Plan> {
    const revision = (record.plan?.revision ?? -1) + 1;
    if (revision > this.budget.maxReplans) {
      throw new RunStoppedError('replan-budget', 'replan_budget_exceeded');
    }
    const plan = await this.options.planner.plan({
      goal: record.goal,
      revision,
      steerInstructions: record.steerInstructions,
      priorCheckpoints: record.checkpoints,
    });
    record.status = 'running';
    record.updatedAt = this.now();
    await this.store.saveRun(record);
    events.push({ type: 'plan', plan });
    return plan;
  }

  private async finish(
    record: GoalRunRecord,
    events: GoalRunEvent[],
    status: 'completed' | 'failed',
    error?: string,
  ) {
    record.status = status;
    if (error) record.error = error;
    record.updatedAt = this.now();
    events.push({ type: 'status', status, error });
    await this.store.saveRun(record);
    return { record, events };
  }
}
