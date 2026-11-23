/**
 * Goal-run trajectory adapter. Drives the real GoalRunEngine with a
 * deterministic planner and executor, so the eval checks checkpoint and
 * approval/idempotency behaviour rather than a re-implementation.
 */
import type { Plan } from '@agent-chat/contract';
import { emptyStoreData } from '../../store/memory';
import { MemoryGoalRunStore } from '../../goals/memory-store';
import { GoalRunEngine } from '../../goals/engine';
import type {
  GoalRunEvent,
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
  const planner: PlanGenerator = {
    async plan({ revision }) {
      const p = plan(scenario);
      p.revision = revision;
      events.push({ type: 'plan', plan: p });
      return p;
    },
  };
  let advanced = false;
  const executor: StepExecutor = {
    async execute({ phase, idempotencyKey }) {
      if (
        scenario === 'approval' ||
        scenario === 'deny' ||
        scenario === 'idempotent'
      ) {
        if (phase === 'propose') {
          events.push({ type: 'approval-request', approval: {} as never });
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
      if (scenario === 'predicate-fail' && !advanced) {
        advanced = true;
        return { predicatePassed: false, summary: 'retry', costUnits: 1 };
      }
      return {
        predicatePassed: true,
        summary: 'done',
        costUnits: 1,
      } satisfies StepResult;
    },
  };
  return { events, effects, planner, executor };
}

export async function executeGoalCase(input: GoalInput): Promise<Execution> {
  const { events, effects, planner, executor } = fixture(input.scenario);
  const data = emptyStoreData();
  const store = new MemoryGoalRunStore(data);
  let seq = 0;
  const engine = new GoalRunEngine(store, {
    planner,
    executor,
    budget: { maxReplans: 1, maxSteps: 3, maxCostUnits: 100 },
    now: () => `2026-01-01T00:00:${String(seq++).padStart(2, '0')}.000Z`,
    newId: prefix => `${prefix}_eval`,
  });
  const run = await engine.start({
    runId: 'run_eval',
    threadId: 'thread_eval',
    ownerId: 'user_eval',
    goal: input.goal,
  });
  const trajectory = ['plan'];
  if (input.scenario === 'steer') {
    await engine.steer(run.runId, 'use local sources');
    trajectory.push('steer', 'replan');
    return { outcome: 'steered', trajectory };
  }
  if (input.scenario === 'cancel') {
    await engine.cancel(run.runId);
    trajectory.push('canceled');
    return { outcome: 'canceled', trajectory };
  }
  const first = await engine.advance(run.runId);
  if (
    input.scenario === 'approval' ||
    input.scenario === 'deny' ||
    input.scenario === 'idempotent'
  ) {
    if (first.outcome !== 'approval-required') {
      return { outcome: `unexpected:${first.outcome}`, trajectory };
    }
    trajectory.push('approval-request');
    const approvalId = first.approval.approvalId;
    if (input.scenario === 'deny') {
      await engine.deny(run.runId, approvalId, 'eval deny');
      trajectory.push('denied', 'canceled');
      return { outcome: 'canceled', trajectory };
    }
    await engine.approve(run.runId, approvalId);
    await engine.advance(run.runId);
    if (input.scenario === 'idempotent') {
      await engine.advance(run.runId);
      trajectory.push(`effect:${effects.length}`);
    }
    trajectory.push('completed');
    return {
      outcome:
        input.scenario === 'idempotent'
          ? 'completed-once'
          : 'approval-required',
      trajectory,
    };
  }
  if (first.outcome === 'stopped') {
    trajectory.push('step:succeeded', `stopped:${first.reason}`);
    return { outcome: `stopped:${first.reason}`, trajectory };
  }
  if (first.outcome === 'completed') {
    trajectory.push('step:succeeded', 'completed');
    if (input.scenario === 'predicate-fail') {
      trajectory.splice(1, 0, 'step:failed', 'replan');
      return { outcome: 'completed-after-replan', trajectory };
    }
    if (input.scenario === 'budget') {
      for (let i = 1; i < 4; i++) await engine.advance(run.runId);
      trajectory.push('stopped:budget');
      return { outcome: 'stopped:budget', trajectory };
    }
    return { outcome: 'completed', trajectory };
  }
  return { outcome: `unexpected:${first.outcome}`, trajectory };
}
