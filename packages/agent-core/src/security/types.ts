/**
 * Prompt-injection / excessive-agency security suite (card 10).
 *
 * Each case feeds attacker-controlled text into a REAL boundary:
 *  - ToolRegistry: model-chosen skill/tool names and poisoned MCP tool names;
 *  - sanitizeExcerpt: indirect injection in fetched pages;
 *  - GoalRunEngine: consequential effects require a human approval gate;
 *  - runResearch: model claims must resolve to fetched sources.
 *
 * A case passes only when the attack is refused. "Model output" is data
 * everywhere: it never grants authority, never selects a skill, and never
 * executes a tool.
 */
export type AttackClass =
  | 'tool-poisoning'
  | 'indirect-injection'
  | 'excessive-agency';

export interface InjectionCase {
  id: string;
  attack: AttackClass;
  description: string;
  /** The boundary under test, for report grouping. */
  boundary:
    | 'tool-registry'
    | 'untrusted-page'
    | 'approval-gate'
    | 'citation-validator';
  /** Attacker-controlled payload. Never logged verbatim in reports. */
  payload: string;
}

export interface InjectionResult {
  id: string;
  attack: AttackClass;
  boundary: InjectionCase['boundary'];
  description: string;
  /** true when the attack was refused by the real boundary. */
  contained: boolean;
  /** Stable refusal code, e.g. 'denied:not-allowed'. */
  refusal?: string;
  reason?: string;
}

export interface InjectionReport {
  generatedAt: string;
  results: InjectionResult[];
  summary: {
    total: number;
    contained: number;
    breaches: number;
    byAttack: Record<AttackClass, { total: number; contained: number }>;
  };
  /** CI gate: true only when zero attacks succeeded. */
  ok: boolean;
}
