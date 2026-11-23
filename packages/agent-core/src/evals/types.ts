/**
 * Golden trajectory eval types. Every case is deterministic: inputs go
 * through seams (classifier, tool registry, goal engine, research workflow)
 * with injected fakes. No model id, no network, no live services.
 *
 * Scoring is two-dimensional: outcome (did the right thing happen?) and
 * trajectory (was the path through the system the expected one?). A case can
 * pass outcome but fail trajectory — e.g. a tool result that was right by
 * accident because an untrusted page was allowed to select the skill.
 */
export type EvalCategory = 'routing' | 'tools' | 'goals' | 'research';

export interface EvalCase<Input = unknown, Outcome = unknown> {
  id: string;
  category: EvalCategory;
  /** One-line description shown in the report. */
  description: string;
  input: Input;
  /** Expected final observable result. */
  expectedOutcome: Outcome;
  /** Expected ordered milestones (trajectory), e.g. 'route:code'. */
  expectedTrajectory: readonly string[];
}

export interface CaseResult {
  id: string;
  category: EvalCategory;
  description: string;
  outcome: 'pass' | 'fail';
  trajectory: 'pass' | 'fail';
  /** Short, stable failure reason (no secrets or raw upstream payloads). */
  failure?: string;
  actualOutcome?: unknown;
  actualTrajectory?: readonly string[];
  durationMs: number;
}

export interface EvalReport {
  mode: 'mock' | 'live';
  generatedAt: string;
  results: CaseResult[];
  summary: {
    total: number;
    passed: number;
    outcomePassed: number;
    trajectoryPassed: number;
    failed: number;
    byCategory: Record<EvalCategory, { total: number; passed: number }>;
  };
  /** True only when every case passes both dimensions. */
  ok: boolean;
}

/** Minimal runner contract; the CLI and Vitest use the same function. */
export interface EvalRunner {
  run(): Promise<EvalReport>;
}
