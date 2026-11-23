/**
 * Bridge from the deep research workflow to the durable goal-run engine.
 * The engine owns checkpoints, budgets and resume; this adapter maps a
 * research plan to goal steps and runs one isolated research workflow in the
 * propose phase, then commits the report as a read-only artifact (no external
 * side effects, so no approval gate is required).
 */
import type { Plan, StepStatus } from '@agent-chat/contract';
import {
  type PlanGenerator,
  type StepExecutor,
  type StepResult,
} from '../goals';
import type { ResearchReport, ResearchWorkflowOptions } from './types';
import { runResearch } from './workflow';

export interface ResearchRunOptions {
  workflow: Omit<ResearchWorkflowOptions, 'newId' | 'now'>;
  /** Injected by the engine; tests can capture reports here. */
  onReport?: (report: ResearchReport) => void;
  newId?: (prefix: string) => string;
  now?: () => string;
}

/**
 * Planner: a fixed four-step research plan, matching plan → parallel search →
 * read/fetch → reflect/report. Each step has an executable success predicate
 * checked by the executor.
 */
export function createResearchPlanner(
  options: ResearchRunOptions,
): PlanGenerator {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const steps = [
    { title: 'Plan search queries', successPredicate: 'queries are non-empty' },
    {
      title: 'Parallel search sub-agents',
      successPredicate: 'each sub-agent returned a bounded summary',
    },
    {
      title: 'Read and fetch sources',
      successPredicate: 'every cited source was fetched and sanitised',
    },
    {
      title: 'Reflect and report with citations',
      successPredicate: 'every claim resolves to a fetched source',
    },
  ];
  return {
    async plan({ revision }) {
      const plan: Plan = {
        planId: `plan_research_${revision}`,
        goal: 'deep research',
        revision,
        steps: steps.map((s, i) => ({
          stepId: `research_step_${i}_${revision}`,
          title: s.title,
          successPredicate: s.successPredicate,
          status: 'pending' as StepStatus,
        })),
      };
      return plan;
    },
  };
}

/**
 * Executor. `runResearch` is deterministic given its seams; a re-run produces
 * the same report, so replay after a crash cannot duplicate a side effect.
 * The only action is an in-memory report handoff, never a tool call.
 */
export function createResearchExecutor(
  options: ResearchRunOptions,
): StepExecutor {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date().toISOString());
  let cached: ResearchReport | undefined;
  return {
    async execute({ step, steerInstructions, phase }): Promise<StepResult> {
      if (phase === 'commit') {
        // Read-only workflow: nothing to commit. Report was produced in
        // propose, so an approved side effect never exists here.
        return { predicatePassed: true, summary: 'noop commit' };
      }
      const goal = [...steerInstructions].join(' | ') || 'research goal';
      cached ??= await runResearch(goal, {
        ...options.workflow,
        newId,
        now,
      });
      options.onReport?.(cached);
      const ok = cached.claims.every(c =>
        cached!.sources.some(s => s.sourceId === c.citation.sourceId),
      );
      const index = Number(/research_step_(\d+)/.exec(step.stepId)?.[1] ?? 0);
      const summaries = [
        `${cached.used.queries} queries, ${cached.used.fetches} fetches`,
        `${cached.used.subAgents} isolated sub-agent summaries`,
        `${cached.sources.length} sanitised sources`,
        `${cached.claims.length} claims, ${cached.gaps.length} gaps`,
      ];
      return {
        predicatePassed: ok,
        summary: summaries[index] ?? 'research completed',
        costUnits: cached.used.fetches,
      };
    },
  };
}
