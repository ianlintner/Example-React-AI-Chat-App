/** Card 7 acceptance tests: durable goal runs and human-in-the-loop. */
import { describe, expect, it } from 'vitest';
import { emptyStoreData } from '../store/memory';
import {
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

const OWNER = 'owner_1';
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
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, ids++)).toISOString(),
    budget,
  });
  return { data, store, engine };
}

async function start(engine: GoalRunEngine, runId: string) {
  await engine.start({
    runId,
    threadId: 'thread_1',
    ownerId: OWNER,
    goal: 'finish the goal',
  });
}

/** Narrow a non-gate advance result so tests can assert on the record. */
function finished(result: Awaited<ReturnType<GoalRunEngine['advance']>>) {
  if (result.outcome === 'approval-required') {
    throw new Error(`unexpected approval gate: ${result.approval.toolName}`);
  }
  return result;
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
    await start(engine, 'run_1');
    const result = finished(await engine.advance('run_1', OWNER));
    expect(result.outcome).toBe('completed');
    expect(seen).toEqual(['step_0_0', 'step_1_0']);
    expect(result.record.checkpoints).toHaveLength(2);
    expect(result.record.checkpoints.every(c => c.predicatePassed)).toBe(true);
    expect((await store.getRun('run_1'))?.status).toBe('completed');
  });

  it('resumes mid-run from a checkpoint after an engine restart', async () => {
    const data = emptyStoreData();
    const executed: string[] = [];
    const base = new MemoryGoalRunStore(data);
    let crashOnNextSave = false;
    // Simulate a process dying between the step checkpoint and the next
    // advance: the store write throws instead of the executor.
    const crashingStore: GoalRunStore = {
      createRun: record => base.createRun(record),
      getRun: (runId, ownerId) => base.getRun(runId, ownerId),
      claimEffect: (key, runId) => base.claimEffect(key, runId),
      listRuns: ownerId => base.listRuns(ownerId),
      async saveRun(record, expected) {
        if (
          crashOnNextSave &&
          record.checkpoints.some(cp => cp.stepId === 'step_0_0')
        ) {
          crashOnNextSave = false;
          throw new Error('process_restarted');
        }
        return base.saveRun(record, expected);
      },
    };
    const executor: StepExecutor = {
      async execute({ step }) {
        executed.push(step.stepId);
        if (step.stepId === 'step_0_0') crashOnNextSave = true;
        return { predicatePassed: true };
      },
    };
    const first = new GoalRunEngine(crashingStore, {
      executor,
      planner: fixedPlanner([plan(['one', 'two'])]),
      newId,
    });
    await start(first, 'run_restart');
    await expect(first.advance('run_restart', OWNER)).rejects.toThrow(
      /process_restarted/,
    );
    expect(executed).toEqual(['step_0_0']);

    // New process, same durable data: the checkpoint is already saved, so
    // only the unfinished step may execute.
    const resumedPlan = plan(['one', 'two']);
    resumedPlan.steps[0]!.status = 'succeeded';
    const restarted = harness(
      data,
      {
        async execute({ step }) {
          executed.push(`restarted:${step.stepId}`);
          return { predicatePassed: true };
        },
      },
      fixedPlanner([resumedPlan]),
    );
    const result = finished(
      await restarted.engine.advance('run_restart', OWNER),
    );
    expect(result.outcome).toBe('completed');
    expect(executed).toContain('restarted:step_1_0');
    expect(executed).not.toContain('restarted:step_0_0');
    const final = (await restarted.store.getRun('run_restart'))!;
    expect(final.checkpoints.map(c => c.stepId)).toContain('step_1_0');
    expect(final.checkpoints.at(-1)?.status).toBe('succeeded');
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
    await start(engine, 'run_deny');
    const gated = await engine.advance('run_deny', OWNER);
    expect(gated.outcome).toBe('approval-required');
    if (gated.outcome !== 'approval-required') throw new Error('unreachable');
    const approval = gated.approval;
    expect(approval.payload).toEqual({ url: 'https://example.invalid' });
    expect((await store.getRun('run_deny'))!.status).toBe('awaiting-approval');

    await engine.deny('run_deny', approval.approvalId, undefined, OWNER);
    expect(calls).toEqual([]);
    expect((await store.getRun('run_deny'))?.status).toBe('canceled');
    expect((await engine.advance('run_deny', OWNER)).outcome).toBe('stopped');
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
    await start(engine, 'run_approve');
    const gated = await engine.advance('run_approve', OWNER);
    if (gated.outcome !== 'approval-required') throw new Error('unreachable');
    await engine.approve('run_approve', gated.approval.approvalId, OWNER);
    const result = finished(await engine.advance('run_approve', OWNER));
    expect(result.outcome).toBe('completed');
    expect(effects).toEqual(['step_0_0']);
    expect(keys).toEqual(['run_approve:step_0_0:1']);
    expect(result.record.sideEffects).toContain(
      'run_approve:step_0_0:1:effect_1',
    );
    expect((await store.getRun('run_approve'))?.status).toBe('completed');
  });

  it('steer between steps changes the next executed step', async () => {
    const executed: { title: string; steer: readonly string[] }[] = [];
    const executor: StepExecutor = {
      async execute({ step, steerInstructions }) {
        executed.push({ title: step.title, steer: [...steerInstructions] });
        // First attempt fails, giving the engine a replan opportunity.
        return {
          predicatePassed: step.stepId !== 'step_0_0',
          summary: step.stepId === 'step_0_0' ? 'retry needed' : 'ok',
        };
      },
    };
    const planner: PlanGenerator = {
      async plan({ revision, steerInstructions }) {
        const titles = steerInstructions.includes('Skip to the report')
          ? ['report only']
          : ['original first', 'fallback'];
        return plan(titles, revision);
      },
    };
    const { engine } = harness(emptyStoreData(), executor, planner);
    await start(engine, 'run_steer');
    // Guidance injected while the first step is executing must be visible
    // to the next plan.
    const steerPromise = engine.steer('run_steer', 'Skip to the report', OWNER);
    await steerPromise;
    const first = finished(await engine.advance('run_steer', OWNER));
    expect(first.outcome).toBe('completed');
    expect(first.record.steerInstructions).toContain('Skip to the report');
    expect(executed.map(e => e.title)).toEqual([
      'original first',
      'report only',
    ]);
    expect(executed[1]!.steer).toContain('Skip to the report');
  });

  it('enforces the replan budget and persists failed status', async () => {
    const executor: StepExecutor = {
      async execute() {
        return { predicatePassed: false, summary: 'predicate failed' };
      },
    };
    const planner: PlanGenerator = {
      async plan({ revision }) {
        return plan([`try_${revision}`], revision);
      },
    };
    const { engine, store } = harness(emptyStoreData(), executor, planner);
    await start(engine, 'run_replan');
    const result = finished(await engine.advance('run_replan', OWNER));
    expect(result.outcome).toBe('stopped');
    expect(result.record.plan?.revision).toBe(3);
    const persisted = (await store.getRun('run_replan'))!;
    expect(persisted.status).toBe('failed');
    expect(persisted.error).toBe('replan_budget_exceeded');
  });

  it('enforces cost and cumulative step budgets across resumes', async () => {
    const executed: string[] = [];
    const planner: PlanGenerator = {
      async plan({ revision }) {
        return plan([`step_${revision}`], revision);
      },
    };
    const failingExec: StepExecutor = {
      async execute({ step }) {
        executed.push(step.stepId);
        return { predicatePassed: false, costUnits: 100, summary: 'costly' };
      },
    };
    const { engine } = harness(emptyStoreData(), failingExec, planner, {
      maxCostUnits: 150,
      maxSteps: 10,
    });
    await start(engine, 'run_cost');
    const cost = finished(await engine.advance('run_cost', OWNER));
    expect(cost.outcome).toBe('stopped');
    expect(cost.record.error).toBe('cost_budget_exceeded');

    // maxSteps counts every executed step, not each advance invocation.
    const alwaysPass: StepExecutor = {
      async execute({ step }) {
        executed.push(step.stepId);
        return { predicatePassed: false };
      },
    };
    const bounded = harness(emptyStoreData(), alwaysPass, planner, {
      maxSteps: 2,
    });
    await start(bounded.engine, 'run_steps');
    const steps = finished(await bounded.engine.advance('run_steps', OWNER));
    expect(steps.outcome).toBe('stopped');
    expect(steps.record.stepsExecuted).toBe(2);
    expect(steps.record.error).toBe('step_budget_exceeded');
  });

  it('cancel during an in-flight step is observed before the next step', async () => {
    const calls: string[] = [];
    const { engine, store } = harness(
      emptyStoreData(),
      {
        async execute({ step }) {
          calls.push(step.stepId);
          // A human cancels while this step is executing.
          await engine.cancel('run_cancel_mid', OWNER);
          return { predicatePassed: true };
        },
      },
      fixedPlanner([plan(['one', 'two'])]),
    );
    await start(engine, 'run_cancel_mid');
    const result = finished(await engine.advance('run_cancel_mid', OWNER));
    expect(result.outcome).toBe('stopped');
    expect(result.record.status).toBe('canceled');
    expect(calls).toEqual(['step_0_0']);
    expect((await store.getRun('run_cancel_mid'))?.status).toBe('canceled');
  });

  it('rejects cross-owner mutations and terminal-state edits', async () => {
    const { engine } = harness(
      emptyStoreData(),
      {
        async execute() {
          return { predicatePassed: true } as StepResult;
        },
      },
      fixedPlanner([plan(['one'])]),
    );
    await start(engine, 'run_owner');
    await expect(engine.cancel('run_owner', 'attacker')).rejects.toThrow(
      /run_not_found/,
    );
    await expect(engine.steer('run_owner', 'x', 'attacker')).rejects.toThrow(
      /run_not_found/,
    );
    await expect(engine.advance('run_owner', 'attacker')).rejects.toThrow(
      /run_not_found/,
    );
    await engine.cancel('run_owner', OWNER);
    await expect(engine.steer('run_owner', 'x', OWNER)).rejects.toThrow(
      RunStoppedError,
    );
  });
});
