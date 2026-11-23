/**
 * Research workflow domain types (card 8). The workflow is deliberately a
 * pure orchestrator: search/fetch and model calls arrive through seams, so a
 * golden case runs end to end with no network and no real model.
 */
import type { Citation } from '@agent-chat/contract';

/** A fetched page. `text` is UNTRUSTED data — never instructions. */
export interface FetchedPage {
  sourceId: string;
  url: string;
  title: string;
  publisher?: string;
  /** Raw page text, before sanitisation. */
  text: string;
  retrievedAt?: string;
}

export interface SearchHit {
  url: string;
  title: string;
  snippet?: string;
}

/** Search/fetch behind an interface; env selects the provider, tests inject. */
export interface SearchFetcher {
  search(query: string, limit: number): Promise<SearchHit[]>;
  fetch(url: string): Promise<FetchedPage>;
}

/** Available budget for one research run. */
export interface ResearchBudget {
  /** Maximum parallel search sub-agents. */
  maxSubAgents: number;
  /** Maximum fetches across the whole run. */
  maxFetches: number;
  /** Maximum queries across the whole run. */
  maxQueries: number;
  /** Hard cap on tokens of sanitised page text per sub-agent summary. */
  summaryTokenCap: number;
  /** Maximum reflect/replan rounds. */
  maxRounds: number;
}

export const DEFAULT_RESEARCH_BUDGET: ResearchBudget = {
  maxSubAgents: 4,
  maxFetches: 8,
  maxQueries: 8,
  summaryTokenCap: 2000,
  maxRounds: 2,
};

/** A claim in the final report with its supporting citation. */
export interface ResearchClaim {
  text: string;
  citation: Citation;
}

/** One isolated sub-agent's condensed result (≤ summaryTokenCap tokens). */
export interface SubAgentSummary {
  query: string;
  /** Condensed findings — never raw page text. */
  summary: string;
  /** Ids of the pages this summary drew on, for the final citation map. */
  sourceIds: string[];
  tokenEstimate: number;
}

/** The fetched, sanitised source backing one or more citations. */
export interface ResearchSource {
  sourceId: string;
  url: string;
  title: string;
  publisher?: string;
  /** Sanitised excerpt suitable for the citation hover card. */
  excerpt: string;
  retrievedAt?: string;
}

/** Final research artifact. Every claim carries a resolvable citation. */
export interface ResearchReport {
  goal: string;
  summary: string;
  claims: ResearchClaim[];
  sources: ResearchSource[];
  /** What the reflect/gap-check step found missing (may be empty). */
  gaps: string[];
  /** Budget actually consumed. */
  used: {
    queries: number;
    fetches: number;
    rounds: number;
    subAgents: number;
  };
}

/** Events streamed to the client as the workflow advances. */
export type ResearchEvent =
  | { type: 'plan'; queries: string[] }
  | { type: 'search'; query: string; hits: number }
  | { type: 'fetch'; sourceId: string; url: string }
  | { type: 'summary'; query: string; tokenEstimate: number }
  | { type: 'reflect'; gaps: string[] }
  | { type: 'report'; report: ResearchReport };

export interface ResearchWorkflowOptions {
  fetcher: SearchFetcher;
  budget?: Partial<ResearchBudget>;
  newId?: (prefix: string) => string;
  now?: () => string;
  /**
   * Model call seam. Implementations must use named route names via `Llm`;
   * tests pass a deterministic fake. No model id is ever hard-coded here.
   */
  model: ResearchModel;
}

/**
 * Minimal model seam for the workflow. Each method is one isolated context;
 * the orchestrator caps and sanitises everything passed in and out.
 */
export interface ResearchModel {
  /** Produce the initial search queries for a goal. */
  plan(goal: string): Promise<string[]>;
  /** Condense one sub-agent's fetched pages into a bounded summary. */
  summarize(input: {
    query: string;
    goal: string;
    pages: readonly ResearchSource[];
  }): Promise<string>;
  /** Gap check after a round of summaries. */
  reflect(input: {
    goal: string;
    summaries: readonly SubAgentSummary[];
  }): Promise<string[]>;
  /** Draft the final claims; must reference only supplied source ids. */
  report(input: {
    goal: string;
    claims: readonly SubAgentSummary[];
    sources: readonly ResearchSource[];
  }): Promise<Array<{ text: string; sourceId: string }>>;
}
