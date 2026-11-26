/**
 * Golden trajectory runner. Scores every case on both outcome and trajectory.
 * The same runner backs `npm run eval` and the Vitest CI gate.
 */
import {
  ALL_EVAL_CASES,
  GOAL_EVAL_CASES,
  RESEARCH_EVAL_CASES,
  ROUTING_EVAL_CASES,
  TOOL_EVAL_CASES,
} from './cases';
import { classify, type RouteOutcome } from '../router/classify';
import type { EvalCase, EvalReport, CaseResult } from './types';
import type { Execution } from './adapters/execution';
import { executeToolCase } from './adapters/tools';
import { executeGoalCase } from './adapters/goals';
import { executeResearchCase } from './adapters/research';

async function execute(c: EvalCase): Promise<Execution> {
  switch (c.category) {
    case 'routing': {
      const outcome = classify(
        (c.input as { text: string }).text,
      ) as RouteOutcome;
      return {
        outcome: `${outcome.skill}:${outcome.tier}:${outcome.needsResearch}:${outcome.needsPlan}`,
        trajectory: [`route:${outcome.skill}`, `tier:${outcome.tier}`],
      };
    }
    case 'tools':
      return executeToolCase(c.input as never);
    case 'goals':
      return executeGoalCase(c.input as never);
    case 'research':
      return executeResearchCase(c.input as never);
  }
}

function expectedOutcome(c: EvalCase): string {
  const raw = c.expectedOutcome as RouteOutcome | string;
  if (c.category === 'routing' && typeof raw === 'object') {
    const o = raw as RouteOutcome;
    return `${o.skill}:${o.tier}:${o.needsResearch}:${o.needsPlan}`;
  }
  return String(raw);
}

function trajectoryMatches(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  // Subsequence match: extra telemetry events are allowed, but the required
  // milestones must occur in order. A denied/sanitised step cannot be skipped.
  let i = 0;
  for (const step of actual) {
    if (i < expected.length && step === expected[i]) i++;
  }
  return i === expected.length;
}

async function runCase(c: EvalCase): Promise<CaseResult> {
  const started = Date.now();
  try {
    const actual = await execute(c);
    const wantOutcome = expectedOutcome(c);
    const outcomeOk = actual.outcome === wantOutcome;
    const trajectoryOk = trajectoryMatches(
      actual.trajectory,
      c.expectedTrajectory,
    );
    const failure = !outcomeOk
      ? `outcome: expected ${wantOutcome}, got ${actual.outcome}`
      : !trajectoryOk
        ? `trajectory: expected ${c.expectedTrajectory.join('→')}, got ${actual.trajectory.join('→')}`
        : undefined;
    return {
      id: c.id,
      category: c.category,
      description: c.description,
      outcome: outcomeOk ? 'pass' : 'fail',
      trajectory: trajectoryOk ? 'pass' : 'fail',
      failure,
      actualOutcome: actual.outcome,
      actualTrajectory: actual.trajectory,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      id: c.id,
      category: c.category,
      description: c.description,
      outcome: 'fail',
      trajectory: 'fail',
      failure:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
      durationMs: Date.now() - started,
    };
  }
}

export { ALL_EVAL_CASES };
export async function runGoldenEval(
  mode: 'mock' | 'live' = 'mock',
): Promise<EvalReport> {
  const results = await Promise.all(ALL_EVAL_CASES.map(runCase));
  const sets = {
    routing: ROUTING_EVAL_CASES,
    tools: TOOL_EVAL_CASES,
    goals: GOAL_EVAL_CASES,
    research: RESEARCH_EVAL_CASES,
  };
  const byCategory = Object.fromEntries(
    (Object.keys(sets) as (keyof typeof sets)[]).map(category => {
      const ids = new Set(sets[category].map(c => c.id));
      const rows = results.filter(r => ids.has(r.id));
      return [
        category,
        {
          total: rows.length,
          passed: rows.filter(
            r => r.outcome === 'pass' && r.trajectory === 'pass',
          ).length,
        },
      ];
    }),
  ) as EvalReport['summary']['byCategory'];
  const passed = results.filter(
    r => r.outcome === 'pass' && r.trajectory === 'pass',
  ).length;
  return {
    mode,
    generatedAt: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
      outcomePassed: results.filter(r => r.outcome === 'pass').length,
      trajectoryPassed: results.filter(r => r.trajectory === 'pass').length,
      byCategory,
    },
    ok: passed === results.length,
  };
}

/** Fail-fast helper for CI and Vitest. Prints only failures, no raw payloads. */
export function formatReport(report: EvalReport): string {
  const lines = [
    `eval(${report.mode}): ${report.summary.passed}/${report.summary.total} passed ` +
      `(outcome ${report.summary.outcomePassed}, trajectory ${report.summary.trajectoryPassed})`,
  ];
  for (const [category, stats] of Object.entries(report.summary.byCategory)) {
    lines.push(`  ${category}: ${stats.passed}/${stats.total}`);
  }
  for (const r of report.results.filter(
    x => x.outcome === 'fail' || x.trajectory === 'fail',
  )) {
    lines.push(`  FAIL ${r.id}: ${r.failure ?? 'unknown'}`);
  }
  return lines.join('\n');
}
