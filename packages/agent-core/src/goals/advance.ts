/** Bounded advance loop for a durable goal run. */
import type { Step } from '@agent-chat/contract';
import type { GoalRunRecord, GoalRunEvent } from './types';
import {
  EFFECT_COMMITTED,
  activeStop,
  checkControl,
  checkpoint,
  finish,
  loadRun,
  persist,
  refresh,
  replan,
  stopped,
  type AdvanceContext,
  type AdvanceResult,
} from './advance-helpers';

/** Drive the state machine until completion, a human gate or a stop. */
export async function advanceRun(
  ctx: AdvanceContext,
  runId: string,
  ownerId?: string,
): Promise<AdvanceResult> {
  const events: GoalRunEvent[] = [];
  const pendingStepEvents: Step[] = [];
  let record = await loadRun(ctx, runId, ownerId);
  const initialStop = activeStop(record);
  if (initialStop) return stopped(record, events, initialStop);
  if (!record.plan) {
    const initial = await replan(ctx, record, events);
    if ('stopped' in initial) return stopped(record, events, initial.stopped);
    record.plan = initial.plan;
  }
  let plan = record.plan;
  events.push({ type: 'plan', plan });

  let guard = 0;
  while (guard++ < ctx.budget.maxSteps) {
    // A concurrent cancel/steer/decision made during a previous step MUST
    // be observed before another side effect is attempted.
    record = await refresh(ctx, record, ownerId, events, pendingStepEvents);
    const stop = activeStop(record);
    if (stop) return stopped(record, events, stop);
    if (record.plan) plan = record.plan;
    if (record.stepsExecuted >= ctx.budget.maxSteps) {
      return finish(ctx, record, events, 'failed', 'step_budget_exceeded');
    }

    const step = plan.steps.find(s => s.status === 'pending');
    if (!step) {
      if (plan.steps.every(s => s.status === 'succeeded')) {
        return finish(ctx, record, events, 'completed');
      }
      const next = await replan(ctx, record, events);
      if ('stopped' in next) return stopped(record, events, next.stopped);
      plan = next.plan;
      record.plan = plan;
      continue;
    }

    const attempt =
      record.checkpoints.filter(c => c.stepId === step.stepId).length + 1;
    const idempotencyKey = `${runId}:${step.stepId}:${attempt}`;
    const pendingEffect = record.pendingEffect;
    const commit =
      pendingEffect?.stepId === step.stepId &&
      pendingEffect.attempt === attempt &&
      pendingEffect.idempotencyKey === idempotencyKey;
    const effectKey = commit
      ? `${idempotencyKey}:${pendingEffect!.key}`
      : undefined;

    // A crash after the tool committed but before the checkpoint is saved
    // leaves the key in the ledger. Never replay that step's effect: the
    // card requires at-most-once side effects, so a lost effect (reported as
    // committed) is preferred over repeating a consequential action.
    if (commit && effectKey && record.sideEffects.includes(effectKey)) {
      record.approval = undefined;
      record.pendingEffect = undefined;
      record.status = 'running';
      checkpoint(record, step, pendingStepEvents, {
        stepId: step.stepId,
        status: 'succeeded',
        attempt,
        // The predicate did not actually run on this replay path; mark it
        // explicitly unverified instead of claiming success.
        predicatePassed: undefined,
        summary: EFFECT_COMMITTED,
        at: ctx.now(),
      });
      await persist(ctx, record, events, pendingStepEvents);
      continue;
    }

    // Register the effect key BEFORE the commit-phase executor call.
    if (commit && effectKey) {
      record.sideEffects.push(effectKey);
      record.status = 'running';
      await persist(ctx, record, events, pendingStepEvents);
    }
    step.status = 'running';
    await persist(ctx, record, events, pendingStepEvents);

    let result;
    try {
      result = await ctx.execute({
        run: record,
        step,
        attempt,
        idempotencyKey,
        steerInstructions: record.steerInstructions,
        phase: commit ? 'commit' : 'propose',
      });
    } catch {
      // Re-read before writing the failure: a cancel during the step wins.
      const latest = await loadRun(ctx, runId, ownerId);
      if (latest.canceled || latest.status === 'canceled') {
        return stopped(latest, events, 'canceled');
      }
      step.status = 'failed';
      checkpoint(record, step, pendingStepEvents, {
        stepId: step.stepId,
        status: 'failed',
        attempt,
        error: 'step_execution_failed',
        at: ctx.now(),
      });
      await persist(ctx, record, events, pendingStepEvents);
      const next = await replan(ctx, record, events);
      if ('stopped' in next) return stopped(record, events, next.stopped);
      plan = next.plan;
      record.plan = plan;
      continue;
    }

    // A cancel or steer that landed while the step was running must win:
    // do not persist the stale in-memory status over the decision.
    const control = await checkControl(ctx, runId, ownerId);
    if (control.canceled || control.status === 'canceled') {
      return stopped(control, events, 'canceled');
    }
    // Guidance injected mid-step must reach the next plan.
    record.steerInstructions = [...control.steerInstructions];

    // A consequential effect needs a human gate before it may execute.
    if (result.effect && !commit) {
      const approvalId = ctx.newId('appr');
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
      await persist(ctx, record, events, pendingStepEvents);
      events.push({ type: 'approval-request', approval: record.approval });
      return {
        outcome: 'approval-required',
        approval: record.approval,
        events,
      };
    }

    if (commit) {
      record.approval = undefined;
      record.pendingEffect = undefined;
      record.status = 'running';
      await persist(ctx, record, events, pendingStepEvents);
    }

    record.costUnits += result.costUnits ?? 0;
    record.stepsExecuted += 1;
    if (record.costUnits > ctx.budget.maxCostUnits) {
      return finish(ctx, record, events, 'failed', 'cost_budget_exceeded');
    }

    step.status = result.predicatePassed ? 'succeeded' : 'failed';
    checkpoint(record, step, pendingStepEvents, {
      stepId: step.stepId,
      status: step.status,
      attempt,
      predicatePassed: result.predicatePassed,
      summary: result.summary,
      at: ctx.now(),
    });
    await persist(ctx, record, events, pendingStepEvents);

    if (!result.predicatePassed) {
      const next = await replan(ctx, record, events);
      if ('stopped' in next) return stopped(record, events, next.stopped);
      plan = next.plan;
      record.plan = plan;
    }
  }
  return finish(ctx, record, events, 'failed', 'step_budget_exceeded');
}
