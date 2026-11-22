/**
 * Goal-run domain types (card 7). The engine is a state machine over a
 * persisted checkpoint; it never holds authority to call tools itself —
 * callers supply a `StepExecutor`, and the engine guards every step with an
 * idempotency key so a retry after a crash cannot replay a side effect.
 */
import type {
  ApprovalRequest,
  Plan,
  Step,
  StepStatus,
} from '@agent-chat/contract';

export type GoalRunStatus =
  | 'planning'
  | 'running'
  | 'awaiting-approval'
  | 'completed'
  | 'failed'
  | 'canceled';

/** Which direction a replan should take (used by the default planner). */
export type ReplanReason = 'predicate-failed' | 'steer' | 'step-failed';

export interface GoalBudget {
  /** Maximum number of plans (1 initial + at most 3 replans). */
  maxReplans: number;
  /** Maximum number of step executions across all plan revisions. */
  maxSteps: number;
  /** Maximum accumulated cost in arbitrary integer units (e.g. tokens/100). */
  maxCostUnits: number;
}

export const DEFAULT_BUDGET: GoalBudget = {
  maxReplans: 3,
  maxSteps: 30,
  maxCostUnits: 10_000,
};

/** A deterministic checkpoint for one step execution. */
export interface StepCheckpoint {
  stepId: string;
  status: StepStatus;
  attempt: number;
  predicatePassed?: boolean;
  summary?: string;
  error?: string;
  at: string;
}

/**
 * Everything needed to resume a run after a process restart. Persisted as
 * JSON in Postgres (and mirrored in the shared in-process store for tests).
 */
export interface GoalRunRecord {
  runId: string;
  threadId: string;
  ownerId: string;
  goal: string;
  status: GoalRunStatus;
  plan?: Plan;
  checkpoints: StepCheckpoint[];
  stepsExecuted: number;
  costUnits: number;
  /** Pending human gate, if any. */
  approval?: ApprovalRequest;
  /** Effect awaiting commit after approval (bound to a specific step/key). */
  pendingEffect?: {
    stepId: string;
    attempt: number;
    idempotencyKey: string;
    toolName: string;
    risk: ApprovalRequest['risk'];
    summary: string;
    payload: Record<string, unknown>;
    key: string;
  };
  /** Steering guidance injected by the user, consumed by the next plan/step. */
  steerInstructions: string[];
  canceled: boolean;
  /** Idempotency keys of side effects already committed by this run. */
  sideEffects: string[];
  createdAt: string;
  updatedAt: string;
  error?: string;
}

/** Result of executing one step. */
export interface StepResult {
  /** Did the executable success predicate pass? */
  predicatePassed: boolean;
  /** Human-readable outcome, streamed to the client. */
  summary?: string;
  /** Cost of this step in budget units. */
  costUnits?: number;
  /**
   * A consequential side effect the step wants to perform. When present,
   * the engine allocates a deterministic idempotency key, emits an approval
   * request and suspends; on approval the executor is called again with that
   * key and must perform the effect at most once.
   */
  effect?: {
    toolName: string;
    risk: ApprovalRequest['risk'];
    summary: string;
    payload: Record<string, unknown>;
    /** Stable per-tool idempotency hint; combined with run/step/attempt. */
    key: string;
  };
}

/**
 * Supplied by the application. Implementations must treat `idempotencyKey`
 * as "perform this effect at most once, ever" — e.g. pass it to the tool or
 * record it in an outbox before performing the effect.
 */
export interface StepExecutor {
  execute(input: {
    run: GoalRunRecord;
    step: Plan['steps'][number];
    attempt: number;
    idempotencyKey: string;
    steerInstructions: readonly string[];
    /**
     * `propose`: the step decides what it wants to do (no side effects yet).
     * `commit`: the human approved; perform the effect with the same key.
     * A well-behaved executor performs side effects only in `commit`.
     */
    phase: 'propose' | 'commit';
  }): Promise<StepResult>;
}

/** Produces (or revises) a plan. Deterministic implementations are fine. */
export interface PlanGenerator {
  plan(input: {
    goal: string;
    revision: number;
    steerInstructions: readonly string[];
    priorCheckpoints: readonly StepCheckpoint[];
  }): Promise<Plan>;
}

/** Events emitted by the engine; the Inngest function streams them. */
export type GoalRunEvent =
  | { type: 'plan'; plan: Plan }
  | { type: 'step'; step: Step }
  | { type: 'approval-request'; approval: ApprovalRequest }
  | { type: 'steer'; text: string }
  | { type: 'status'; status: GoalRunStatus; error?: string };

export interface EngineOptions {
  executor: StepExecutor;
  planner: PlanGenerator;
  budget?: Partial<GoalBudget>;
  /** Injected clock for deterministic tests. */
  now?: () => string;
  /** Injected id generator for deterministic tests. */
  newId?: (prefix: string) => string;
}
