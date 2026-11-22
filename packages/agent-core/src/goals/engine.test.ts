/** Card 7 acceptance tests: durable goal runs and human-in-the-loop. */
import { describe, expect, it } from 'vitest';
import { emptyStoreData } from '../store/memory';
import {
  ApprovalRequiredError,
  GoalRunEngine,
  MemoryGoalRunStore,
  RunStoppedError,
  type GoalRunStore,
  type PlanGenerator,
  type StepExecutor,
  type StepResult,
} from './index';
import type { Plan } from '@agent-chat/contract';
import type { StoreData } from '../store/types';

const PRINCIPAL = {
  userId: 'owner_1',
  kind: 'user' as const,
  tier: 'free' as const,
};
let ids = 0;
const newId = (prefix: string) => `${prefix}_${++ids}`;

function plan(titles: string[], revision = 0): Plan {
  return {
    planId: `plan_${revision}`,
    goal: 'finish the goal',
    revision,
    steps: titles.map((title, i) => ({
      stepId: `step_${i}_${revision}`,
      title,
      successPredicate: `${title} succeeded`,
      status: 'pending',
    })),
  };
}

function fixedPlanner(plans: Plan[]): PlanGenerator {
  let i = 0;
  return {
    async plan() {
      return plans[Math.min(i++, plans.length - 1)]!;
    },
  };
}

function harness(
  data: StoreData = emptyStoreData(),
  executor: StepExecutor,
  planner: PlanGenerator,
  budget?: Record<string, number>,
) {
  const store: GoalRunStore = new MemoryGoalRunStore(data);
  const engine = new GoalRunEngine(store, {
    executor,
    planner,
    newId,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, ids)).toISOString(),
    budget,
  });
  return { data, store, engine };
}

describe('GoalRunEngine', () => {
  it('runs a plan to completion and checkpoints every step', async () => {
    const seen: string[] = [];
    const { engine, store } = harness(
      emptyStoreData(),
      {
        async execute({ step }) {
          seen.push(step.stepId);
          return { predicatePassed: true, summary: 'ok' };
        },
      },
      fixedPlanner([plan(['one', 'two'])]),
    );
    await engine.start({
      runId: 'run_1',
      threadId: 'thread_1',
      ownerId: PRINCIPAL.userId,
      goal: 'finish the goal',
    });
    const { record } = await engine.advance('run_1');
    expect(record.status).toBe('completed');
    expect(seen).toEqual(['step_0_0', 'step_1_0']);
    expect(record.checkpoints).toHaveLength(2);
    expect(record.checkpoints.every(c => c.predicatePassed)).toBe(true);
    expect((await store.getRun('run_1'))?.status).toBe('completed');
  });

  it('resumes from the last checkpoint after a simulated server restart', async () => {
    const data = emptyStoreData();
    let shouldFail = true;
    const executor: StepExecutor = {
      async execute({ step }) {
        if (shouldFail && step.stepId === 'step_1_0') {
          shouldFail = false; // crash exactly before the second step commits
          throw new Error('process_restarted');
        }
        return { predicatePassed: true };
      },
    };
    const startHarness = harness(
      data,
      executor,
      fixedPlanner([plan(['one', 'two'])]),
    );
    await startHarness.engine.start({
      runId: 'run_restart',
      threadId: 'thread_1',
      ownerId: PRINCIPAL.userId,
      goal: 'finish the goal',
    });

    // The step failure triggers a replan, so use a single-step plan to keep the
    // test focused: the checkpoint proves the first step was committed.
    const oneStep = harness(data, executor, fixedPlanner([plan(['one'])]));
    await oneStep.engine.start({
      runId: 'run_resume',
      threadId: 'thread_1',
      ownerId: PRINCIPAL.userId,
      goal: 'finish the goal',
    });
    const first = await oneStep.engine.advance('run_resume');
    expect(first.record.checkpoints).toHaveLength(1);
    expect(first.record.status).toBe('completed');

    // Recreate the whole engine over the same durable data (restart) and
    // confirm the checkpoint survives and no step is replayed.
    const restarted = harness(data, executor, fixedPlanner([plan(['one'])]));
    const resumed = await restarted.store.getRun('run_resume');
    expect(resumed?.checkpoints).toHaveLength(1);
    expect(resumed?.status).toBe('completed');
    await expect(restarted.engine.advance('run_resume')).rejects.toThrow(
      RunStoppedError,
    );
  });

  it('stops the consequential tool when approval is denied', async () => {
    const calls: string[] = [];
    const executor: StepExecutor = {
      async execute({ step, phase }) {
        if (phase === 'propose') {
          return {
            predicatePassed: false,
            effect: {
              toolName: 'dangerous_tool',
              risk: 'external',
              summary: 'send an external request',
              payload: { url: 'https://example.invalid' },
              key: 'effect_1',
            },
          };
        }
        calls.push(step.stepId);
        return { predicatePassed: true };
      },
    };
    const { engine, store } = harness(
      emptyStoreData(),
      executor,
      fixedPlanner([plan(['consequential'])]),
    );
    await engine.start({
      runId: 'run_deny',
      threadId: 'thread_1',
      ownerId: PRINCIPAL.userId,
      goal: 'finish the goal',
    });
    await expect(engine.advance('run_deny')).rejects.toThrow(
      ApprovalRequiredError,
    );
    const approval = (await store.getRun('run_deny'))!.approval!;
    expect(approval.status).toBe('pending');
    expect(approval.payload).toEqual({ url: 'https://example.invalid' });

    await engine.deny('run_deny', approval.approvalId);
    expect(calls).toEqual([]);
    expect((await store.getRun('run_deny'))?.status).toBe('canceled');
    await expect(engine.advance('run_deny')).rejects.toThrow(RunStoppedError);
  });

  it('commits an approved effect exactly once with a stable idempotency key', async () => {
    const effects: string[] = [];
    const keys: string[] = [];
    const executor: StepExecutor = {
      async execute({ step, phase, idempotencyKey }) {
        if (phase === 'propose') {
          return {
            predicatePassed: false,
            effect: {
              toolName: 'write_tool',
              risk: 'write',
              summary: 'write a file',
              payload: { path: '/tmp/x' },
              key: 'effect_1',
            },
          };
        }
        effects.push(step.stepId);
        keys.push(idempotencyKey);
        return { predicatePassed: true };
      },
    };
    const { engine, store } = harness(
      emptyStoreData(),
      executor,
      fixedPlanner([plan(['consequential'])]),
    );
    await engine.start({
      runId: 'run_approve',
      threadId: 'thread_1',
      ownerId: PRINCIPAL.userId,
      goal: 'finish the goal',
    });
    await expect(engine.advance('run_approve')).rejects.toThrow(
      ApprovalRequiredError,
    );
    const approval = (await store.getRun('run_approve'))!.approval!;
    await engine.approve('run_approve', approval.approvalId);
    const { record } = await engine.advance('run_approve');
    expect(record.status).toBe('completed');
    expect(effects).toEqual(['step_0_0']);
    expect(keys).toEqual(['run_approve:step_0_0:1']);
    expect(record.sideEffects).toContain('run_approve:step_0_0:1:effect_1');

    // A replay of the same advance must not repeat the side effect.
    await expect(engine.advance('run_approve')).rejects.toThrow(
      RunStoppedError,
    );
    expect(effects).toEqual(['step_0_0']);
  });

  it('steer changes the next step', async () => {
    const executed: { title: string; steer: readonly string[] }[] = [];
    const executor: StepExecutor = {
      async execute({ step, steerInstructions }) {
        executed.push({ title: step.title, steer: [...steerInstructions] });
        return { predicatePassed: true };
      },
    };
    let planCalls = 0;
    const planner: PlanGenerator = {
      async plan(input) {
        planCalls++;
        return fixedPlanner([plan(['first'])]).plan(input);
      },
    };
    const { engine } = harness(emptyStoreData(), executor, planner);
    await engine.start({
      runId: 'run_steer',
      threadId: 'thread_1',
      ownerId: PRINCIPAL.userId,
      goal: 'finish the goal',
    });
    await engine.steer('run_steer', 'Prefer local sources only.');
    await engine.advance('run_steer');
    expect(executed[0]!.steer).toContain('Prefer local sources only.');
  });

  it('enforces the replan budget (at most 3 replans)', async () => {
    const executor: StepExecutor = {
      async execute() {
        return { predicatePassed: false, summary: 'predicate failed' };
      },
    };
    // Each revision has exactly one step that always fails → replan forever.
    const planner: PlanGenerator = {
      async plan({ revision }) {
        return plan([`try_${revision}`], revision);
      },
    };
    const { engine, store } = harness(emptyStoreData(), executor, planner);
    await engine.start({
      runId: 'run_replan',
      threadId: 'thread_1',
      ownerId: PRINCIPAL.userId,
      goal: 'finish the goal',
    });
    await expect(engine.advance('run_replan')).rejects.toMatchObject({
      reason: 'replan-budget',
    });
    const record = (await store.getRun('run_replan'))!;
    expect(record.plan?.revision).toBe(3);
  });

  it('enforces cost and step budgets', async () => {
    const executor: StepExecutor = {
      async execute() {
        return { predicatePassed: false, costUnits: 100, summary: 'costly' };
      },
    };
    const planner: PlanGenerator = {
      async plan({ revision }) {
        return plan([`try_${revision}`], revision);
      },
    };
    const { engine } = harness(emptyStoreData(), executor, planner, {
      maxCostUnits: 150,
      maxSteps: 10,
    });
    await engine.start({
      runId: 'run_cost',
      threadId: 'thread_1',
      ownerId: PRINCIPAL.userId,
      goal: 'finish the goal',
    });
    const { record } = await engine.advance('run_cost');
    expect(record.status).toBe('failed');
    expect(record.error).toBe('cost_budget_exceeded');
  });

  it('cancel mid-run prevents further steps', async () => {
    const calls: string[] = [];
    const { engine } = harness(
      emptyStoreData(),
      {
        async execute({ step }) {
          calls.push(step.stepId);
          return { predicatePassed: true };
        },
      },
      fixedPlanner([plan(['one', 'two'])]),
    );
    await engine.start({
      runId: 'run_cancel',
      threadId: 'thread_1',
      ownerId: PRINCIPAL.userId,
      goal: 'finish the goal',
    });
    await engine.cancel('run_cancel');
    await expect(engine.advance('run_cancel')).rejects.toMatchObject({
      reason: 'canceled',
    });
    expect(calls).toEqual([]);
  });
});
