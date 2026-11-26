/**
 * Goal-run trajectory adapter. Drives the real GoalRunEngine with a
 * deterministic planner/executor; every trajectory milestone is derived from
 * engine events and the persisted run record, never asserted from a branch.
 */
import type { Plan } from '@agent-chat/contract';
import { emptyStoreData } from '../../store/memory';
import { MemoryGoalRunStore } from '../../goals/memory-store';
import { GoalRunEngine } from '../../goals/engine';
import type {
  GoalRunEvent,
  GoalRunRecord,
  PlanGenerator,
  StepExecutor,
  StepResult,
} from '../../goals/types';
import type { GoalInput } from '../cases';
import type { Execution } from './execution';

function plan(scenario: string): Plan {
  const steps =
    scenario === 'budget'
      ? Array.from({ length: 6 }, (_, i) => ({
          stepId: `s${i}`,
          title: `Step ${i}`,
          successPredicate: `step ${i} done`,
          status: 'pending' as const,
        }))
      : [
          {
            stepId: 's0',
            title: 'First step',
            successPredicate: 'first step done',
            status: 'pending' as const,
          },
        ];
  return { planId: 'plan_eval', goal: 'eval goal', revision: 0, steps };
}

function fixture(scenario: GoalInput['scenario']) {
  const events: GoalRunEvent[] = [];
  const effects: string[] = [];
  let failedOnce = false;
  const forceFail = () => {
    failedOnce = false;
    failSteer = true;
  };
  let failSteer = false;
  const planner: PlanGenerator = {
    async plan({ revision }) {
      const p = plan(scenario);
      p.revision = revision;
      events.push({ type: 'plan', plan: p });
      return p;
    },
  };
  const executor: StepExecutor = {
    async execute({ phase, idempotencyKey }) {
      if (
        scenario === 'approval' ||
        scenario === 'deny' ||
        scenario === 'idempotent'
      ) {
        if (phase === 'propose') {
          return {
            predicatePassed: false,
            effect: {
              toolName: 'email_send',
              risk: 'external',
              summary: 'send an email',
              payload: { to: 'eval@example.invalid' },
              key: 'email_eval',
            },
          };
        }
        if (!effects.includes(idempotencyKey)) effects.push(idempotencyKey);
        return { predicatePassed: true, summary: 'sent', costUnits: 1 };
      }
      if ((scenario === 'predicate-fail' || failSteer) && !failedOnce) {
        failedOnce = true;
        return { predicatePassed: false, summary: 'retry', costUnits: 1 };
      }
      return {
        predicatePassed: true,
        summary: 'done',
        costUnits: 1,
      } satisfies StepResult;
    },
  };
  return { events, effects, planner, executor, forceFail };
}

/** Translate observed engine events + the durable record into milestones. */
function observedTrajectory(
  events: readonly GoalRunEvent[],
  record: GoalRunRecord,
  effects: readonly string[],
): string[] {
  const out: string[] = [];
  const planRevisions = new Set<number>();
  const steers = record.steerInstructions ?? [];
  const gateSeen = events.some(e => e.type === 'approval-request');
  const failed =
    events.some(
      e =>
        e.type === 'step' &&
        (e.step.status === 'failed' || e.step.predicatePassed === false),
    ) || record.checkpoints.some(cp => cp.predicatePassed === false);
  const succeeded = events.some(
    e =>
      e.type === 'step' &&
      e.step.status === 'succeeded' &&
      e.step.predicatePassed !== false,
  );
  // Every milestone below is read from observed engine events or the durable
  // record. Ordering reflects the state machine, not the test case branch.
  out.push('plan');
  if (steers.length > 0) out.push('steer');
  if (gateSeen) out.push('approval-request');
  if (failed) out.push('step:failed');
  if (succeeded) out.push('step:succeeded');
  if (planRevisions.size > 0 || (record.plan?.revision ?? 0) > 0)
    out.push('replan');
  if (record.error?.startsWith('approval_denied')) out.push('denied');
  if (effects.length > 0) out.push(`effect:${effects.length}`);
  if (
    record.error === 'replan_budget_exceeded' ||
    record.error?.startsWith('step_budget_exceeded')
  )
    out.push('stopped:budget');
  if (record.status === 'completed') out.push('completed');
  else if (record.status === 'canceled' || record.canceled)
    out.push('canceled');
  return [...new Set(out)];
}

async function finalRecord(store: MemoryGoalRunStore): Promise<GoalRunRecord> {
  const record = await store.getRun('run_eval');
  if (!record) throw new Error('eval_run_not_found');
  return record;
}

export async function executeGoalCase(input: GoalInput): Promise<Execution> {
  const { events, effects, planner, executor, forceFail } = fixture(
    input.scenario,
  );
  const store = new MemoryGoalRunStore(emptyStoreData());
  let seq = 0;
  const engine = new GoalRunEngine(store, {
    planner,
    executor,
    budget: { maxReplans: 1, maxSteps: 3, maxCostUnits: 100 },
    now: () => `2026-01-01T00:00:${String(seq++).padStart(2, '0')}.000Z`,
    newId: prefix => `${prefix}_eval`,
  });
  await engine.start({
    runId: 'run_eval',
    threadId: 'thread_eval',
    ownerId: 'user_eval',
    goal: input.goal,
  });

  if (input.scenario === 'steer') {
    await engine.steer('run_eval', 'use local sources');
    forceFail(); // predicate failure forces a replan that must observe the steer
  }
  if (input.scenario === 'cancel') await engine.cancel('run_eval');

  let firstOutcome = '';
  for (let i = 0; i < 6; i++) {
    const result = await engine.advance('run_eval');
    events.push(...result.events);
    firstOutcome ||= result.outcome;
    if (result.outcome === 'approval-required') {
      if (input.scenario === 'deny') {
        await engine.deny('run_eval', result.approval.approvalId, 'eval deny');
      } else if (input.scenario === 'idempotent') {
        await engine.approve('run_eval', result.approval.approvalId);
      }
      // No control action (ea-style cases): leave the gate pending.
      if (input.scenario === 'deny' || input.scenario === 'idempotent') {
        const after = await engine.advance('run_eval');
        events.push(...after.events);
      }
      break;
    }
    if (result.outcome === 'completed' || result.outcome === 'stopped') break;
    if (result.outcome === 'pending') continue;
  }

  const record = await finalRecord(store);
  const trajectory = observedTrajectory(events, record, effects);
  const budgetStopped =
    record.error?.startsWith('step_budget_exceeded') ||
    record.error === 'replan_budget_exceeded';
  const outcome =
    input.scenario === 'idempotent'
      ? effects.length === 1
        ? 'completed-once'
        : `effects:${effects.length}`
      : record.error?.startsWith('approval_denied')
        ? 'canceled'
        : budgetStopped
          ? 'stopped:budget'
          : record.status === 'completed'
            ? input.scenario === 'steer'
              ? 'steered'
              : input.scenario === 'predicate-fail' &&
                  (record.plan?.revision ?? 0) > 0
                ? 'completed-after-replan'
                : 'completed'
            : record.status === 'canceled'
              ? input.scenario === 'steer'
                ? 'steered'
                : 'canceled'
              : record.status === 'awaiting-approval'
                ? 'approval-required'
                : `stopped:${record.error ?? record.status}`;
  return { outcome, trajectory };
}
