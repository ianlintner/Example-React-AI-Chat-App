/** Race regressions: cancel/steer made during slow plan/step writes. */
import { describe, expect, it } from 'vitest';
import { emptyStoreData } from '../store/memory';
import {
  GoalRunEngine,
  MemoryGoalRunStore,
  type GoalRunStore,
  type PlanGenerator,
} from './index';
import type { Plan } from '@agent-chat/contract';
import type { StepResult } from './types';

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
  executor: {
    execute: (input: {
      step: Plan['steps'][number];
    }) => Promise<{ predicatePassed: boolean; summary?: string }>;
  },
  planner: PlanGenerator,
) {
  const store: GoalRunStore = new MemoryGoalRunStore(emptyStoreData());
  const engine = new GoalRunEngine(store, {
    executor,
    planner,
    newId,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, ids++)).toISOString(),
  });
  return { store, engine };
}

describe('goal run control races', () => {
  it('cancel during a slow replan wins and stops the run', async () => {
    const calls: string[] = [];
    let engineRef: GoalRunEngine;
    const planner: PlanGenerator = {
      async plan({ revision }) {
        if (revision === 1) await engineRef.cancel('run_replan_cancel', OWNER);
        return plan([`replanned_${revision}`], revision);
      },
    };
    const { engine, store } = harness(
      {
        async execute({ step }) {
          calls.push(step.stepId);
          return { predicatePassed: false, summary: 'retry' };
        },
      },
      planner,
    );
    engineRef = engine;
    await engine.start({
      runId: 'run_replan_cancel',
      threadId: 'thread_1',
      ownerId: OWNER,
      goal: 'finish the goal',
    });
    const result = await engine.advance('run_replan_cancel', OWNER);
    expect(result.outcome).toBe('stopped');
    expect(calls).toEqual(['step_0_0']);
    const persisted = (await store.getRun('run_replan_cancel'))!;
    expect(persisted.canceled).toBe(true);
    expect(persisted.status).toBe('canceled');
  });

  it('cancel between checkControl and persist is not overwritten', async () => {
    const base = new MemoryGoalRunStore(emptyStoreData());
    let cancelOnNextSave = false;
    let engineRef: GoalRunEngine;
    const store: GoalRunStore = {
      createRun: r => base.createRun(r),
      getRun: (id, owner) => base.getRun(id, owner),
      claimEffect: (key, id) => base.claimEffect(key, id),
      listRuns: owner => base.listRuns(owner),
      async saveRun(record, expected) {
        if (cancelOnNextSave) {
          cancelOnNextSave = false;
          await engineRef.cancel(record.runId, OWNER);
        }
        return base.saveRun(record, expected);
      },
    };
    engineRef = new GoalRunEngine(store, {
      executor: {
        async execute({ step }) {
          if (step.stepId === 'step_0_0') cancelOnNextSave = true;
          return { predicatePassed: true };
        },
      },
      planner: fixedPlanner([plan(['one', 'two'])]),
      newId,
      now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, ids++)).toISOString(),
    });
    await engineRef.start({
      runId: 'run_cancel_gap',
      threadId: 'thread_1',
      ownerId: OWNER,
      goal: 'g',
    });
    const result = await engineRef.advance('run_cancel_gap', OWNER);
    expect(result.outcome).toBe('stopped');
    const persisted = (await store.getRun('run_cancel_gap'))!;
    expect(persisted.canceled).toBe(true);
    expect(persisted.status).toBe('canceled');
  });

  it('steer during a slow replan reaches the next plan', async () => {
    const seen: string[][] = [];
    let engineRef: GoalRunEngine;
    const planner: PlanGenerator = {
      async plan({ revision, steerInstructions }) {
        seen.push([...steerInstructions]);
        if (revision === 1) {
          await engineRef.steer('run_steer_replan', 'Do the report', OWNER);
        }
        return plan(
          steerInstructions.includes('Do the report')
            ? ['report']
            : ['original'],
          revision,
        );
      },
    };
    const { engine, store } = harness(
      {
        async execute({ step }) {
          return { predicatePassed: step.stepId !== 'step_0_0' };
        },
      },
      planner,
    );
    engineRef = engine;
    await engine.start({
      runId: 'run_steer_replan',
      threadId: 'thread_1',
      ownerId: OWNER,
      goal: 'finish the goal',
    });
    const result = await engine.advance('run_steer_replan', OWNER);
    expect(result.outcome).toBe('completed');
    expect(seen[1]).not.toContain('Do the report');
    const persisted = (await store.getRun('run_steer_replan'))!;
    expect(persisted.steerInstructions).toContain('Do the report');
  });

  it('steer during a propose step keeps the approval gate', async () => {
    let engineRef: GoalRunEngine;
    const base = new MemoryGoalRunStore(emptyStoreData());
    const wrapped: GoalRunStore = {
      createRun: r => base.createRun(r),
      getRun: (id, owner) => base.getRun(id, owner),
      claimEffect: (key, id) => base.claimEffect(key, id),
      listRuns: owner => base.listRuns(owner),
      saveRun: (record, expected) => base.saveRun(record, expected),
    };
    engineRef = new GoalRunEngine(wrapped, {
      executor: {
        async execute({ step, phase }): Promise<StepResult> {
          if (step.stepId === 'step_0_0' && phase === 'propose') {
            await engineRef.steer(
              'run_steer_propose',
              'Use the safe tool',
              OWNER,
            );
          }
          return {
            predicatePassed: false,
            effect: {
              toolName: 'send_email',
              risk: 'external',
              summary: 'notify the team',
              payload: { to: 'team@example.com' },
              key: 'notify-team',
            },
          };
        },
      },
      planner: fixedPlanner([plan(['send the email'])]),
      newId,
      now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, ids++)).toISOString(),
    });
    await engineRef.start({
      runId: 'run_steer_propose',
      threadId: 'thread_1',
      ownerId: OWNER,
      goal: 'g',
    });
    const result = await engineRef.advance('run_steer_propose', OWNER);
    expect(result.outcome).toBe('approval-required');
    expect(
      result.outcome === 'approval-required' && result.approval !== undefined,
    ).toBe(true);
    const persisted = (await wrapped.getRun('run_steer_propose'))!;
    expect(persisted.status).toBe('awaiting-approval');
    expect(persisted.approval?.status).toBe('pending');
    expect(persisted.pendingEffect).toBeDefined();
    expect(persisted.steerInstructions).toContain('Use the safe tool');
  });

  it('a stale gate write keeps its approval across a non-control conflict', async () => {
    const base = new MemoryGoalRunStore(emptyStoreData());
    let conflictOnNextSave = false;
    let conflicted = false;
    const wrapped: GoalRunStore = {
      createRun: r => base.createRun(r),
      getRun: (id, owner) => base.getRun(id, owner),
      claimEffect: (key, id) => base.claimEffect(key, id),
      listRuns: owner => base.listRuns(owner),
      async saveRun(record, expected) {
        if (conflictOnNextSave && !conflicted) {
          conflicted = true;
          conflictOnNextSave = false;
          // A benign progress write from another actor: no gate, no control
          // decision. It must not erase the locally proposed approval gate.
          const other = (await base.getRun(record.runId))!;
          await base.saveRun({ ...other, costUnits: other.costUnits + 1 });
        }
        return base.saveRun(record, expected);
      },
    };
    let engineRef: GoalRunEngine;
    engineRef = new GoalRunEngine(wrapped, {
      executor: {
        async execute({ phase }): Promise<StepResult> {
          if (phase === 'propose') conflictOnNextSave = true;
          return {
            predicatePassed: false,
            effect: {
              toolName: 'send_email',
              risk: 'external',
              summary: 'notify the team',
              payload: {},
              key: 'notify-team-2',
            },
          };
        },
      },
      planner: fixedPlanner([plan(['send the email'])]),
      newId,
      now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, ids++)).toISOString(),
    });
    await engineRef.start({
      runId: 'run_stale_gate',
      threadId: 'thread_1',
      ownerId: OWNER,
      goal: 'g',
    });
    const result = await engineRef.advance('run_stale_gate', OWNER);
    expect(conflicted).toBe(true);
    expect(result.outcome).toBe('approval-required');
    const persisted = (await wrapped.getRun('run_stale_gate'))!;
    expect(persisted.status).toBe('awaiting-approval');
    expect(persisted.approval?.status).toBe('pending');
    expect(persisted.pendingEffect?.key).toBe('notify-team-2');
  });
});
