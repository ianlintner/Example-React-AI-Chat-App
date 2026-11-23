/**
 * Deep research workflow on top of the goal-run conventions: plan → parallel
 * isolated search sub-agents (bounded summaries) → read/fetch → reflect/gap
 * check → report with claim-level citations. All model calls go through the
 * `ResearchModel` seam (backed by `Llm`, named routes only); all network goes
 * through `SearchFetcher`. Tests inject both.
 */
import type { Citation } from '@agent-chat/contract';
import {
  containsDirective,
  estimateTokens,
  sanitizeExcerpt,
} from './untrusted';
import {
  DEFAULT_RESEARCH_BUDGET,
  type ResearchBudget,
  type ResearchEvent,
  type ResearchReport,
  type ResearchSource,
  type ResearchWorkflowOptions,
  type SubAgentSummary,
} from './types';

export class ResearchBudgetError extends Error {
  constructor(readonly limit: string) {
    super(`research_budget_exceeded:${limit}`);
    this.name = 'ResearchBudgetError';
  }
}

/**
 * Process a goal. Emits events in order; returns the durable report.
 * The workflow never calls tools from model output — `SearchFetcher` is
 * called only by this orchestrator with URLs from search hits, and every
 * page is sanitised before it enters a model context.
 */
export async function runResearch(
  goal: string,
  options: ResearchWorkflowOptions,
  onEvent?: (event: ResearchEvent) => void,
): Promise<ResearchReport> {
  const budget: ResearchBudget = {
    ...DEFAULT_RESEARCH_BUDGET,
    ...options.budget,
  };
  const newId = options.newId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date().toISOString());
  const emit = (event: ResearchEvent) => onEvent?.(event);

  const used = { queries: 0, fetches: 0, rounds: 0, subAgents: 0 };
  const sources = new Map<string, ResearchSource>();

  // Plan: at most maxQueries search sub-agents.
  const planned = await options.model.plan(goal);
  const queries = planned
    .map(q => q.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, budget.maxQueries);
  if (queries.length === 0) throw new Error('research_no_queries');
  emit({ type: 'plan', queries });

  let summaries: SubAgentSummary[] = [];
  let gaps: string[] = [];

  for (let round = 0; round < Math.max(1, budget.maxRounds); round++) {
    used.rounds = round + 1;
    // Parallel search sub-agents, each with its own isolated context. Only
    // the condensed summary crosses back into the orchestrator.
    const batch = round === 0 ? queries : gaps.slice(0, budget.maxQueries);
    if (batch.length === 0) break;
    const workers = batch.slice(0, budget.maxSubAgents).map(async query => {
      if (used.queries >= budget.maxQueries)
        throw new ResearchBudgetError('queries');
      used.queries += 1;
      const hits = await options.fetcher.search(query, budget.maxFetches);
      emit({ type: 'search', query, hits: hits.length });

      // Do NOT pre-slice hits to the budget: every hit beyond the global
      // limit must hit the guard so exhaustion is observable, not silent.
      // Reserve the slot BEFORE awaiting: parallel sub-agents would otherwise
      // all pass a check-then-act guard and overshoot maxFetches together.
      const pages: ResearchSource[] = [];
      for (const hit of hits) {
        if (used.fetches >= budget.maxFetches)
          throw new ResearchBudgetError('fetches');
        used.fetches += 1;
        // Search-hit URLs are untrusted input: the injected SearchFetcher is
        // the SSRF boundary and MUST reject unsupported schemes/hosts (only
        // https to a public host should be fetched in production).
        const page = await options.fetcher.fetch(hit.url);
        if (sources.has(page.sourceId))
          throw new Error(`duplicate_source:${page.sourceId}`);
        const source: ResearchSource = {
          sourceId: page.sourceId,
          url: page.url,
          title: page.title,
          ...(page.publisher ? { publisher: page.publisher } : {}),
          ...(page.retrievedAt ? { retrievedAt: page.retrievedAt } : {}),
          // Structural trim before the model ever sees the text.
          excerpt: sanitizeExcerpt(page.text, budget.summaryTokenCap),
        };
        sources.set(source.sourceId, source);
        pages.push(source);
        emit({ type: 'fetch', sourceId: source.sourceId, url: source.url });
      }
      if (pages.length === 0) return undefined;

      const summary = await options.model.summarize({ query, goal, pages });
      // A model may echo untrusted page text. Re-sanitise before that text
      // enters another model context (reflect/report) so a fence escape or
      // directive cannot survive via the summary channel.
      const trimmed = capSummary(
        sanitizeExcerpt(summary, budget.summaryTokenCap),
        budget.summaryTokenCap,
      );
      const result: SubAgentSummary = {
        query,
        summary: trimmed,
        sourceIds: pages.map(p => p.sourceId),
        tokenEstimate: estimateTokens(trimmed),
      };
      emit({
        type: 'summary',
        query,
        tokenEstimate: result.tokenEstimate,
      });
      return result;
    });

    // allSettled rather than all: if one worker hits a budget guard, the
    // other workers' rejections must still be observed (no unhandled
    // rejection) before the first failure is rethrown.
    const settled = await Promise.allSettled(workers);
    const failure = settled.find(r => r.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    const results = settled.map(
      r => (r as PromiseFulfilledResult<SubAgentSummary | undefined>).value,
    );
    summaries.push(
      ...results.filter((s): s is SubAgentSummary => s !== undefined),
    );
    used.subAgents += results.filter(Boolean).length;

    gaps = await options.model.reflect({ goal, summaries });
    gaps = gaps.map(g => g.trim().slice(0, 500)).filter(Boolean);
    emit({ type: 'reflect', gaps });
    if (gaps.length === 0) break;
    // Do not replan into already-covered queries.
    const seen = new Set(summaries.map(s => s.query));
    gaps = gaps.filter(g => !seen.has(g)).slice(0, budget.maxQueries);
  }

  // Report: every claim must resolve to a fetched source. The model returns
  // source IDs only; this orchestrator builds the Citation from its own map.
  const draft = await options.model.report({
    goal,
    claims: summaries,
    sources: [...sources.values()],
  });
  const claims = draft.map(({ text, sourceId }) => {
    // Reject model output that still carries an injected directive rather
    // than publishing it as a claim. This is the report validator the
    // containsDirective helper documents.
    if (containsDirective(text)) throw new Error('directive_in_claim');
    const source = sources.get(sourceId);
    if (!source) throw new Error(`unresolved_citation:${sourceId}`);
    const citation: Citation = {
      citationId: newId('cite'),
      sourceId: source.sourceId,
      url: source.url,
      title: source.title,
      excerpt: source.excerpt,
      claim: text,
      retrievedAt: source.retrievedAt ?? now(),
    };
    return { text, citation };
  });
  if (claims.length === 0) throw new Error('research_no_claims');

  const report: ResearchReport = {
    goal,
    summary: buildSummary(summaries),
    claims,
    sources: [...sources.values()],
    gaps,
    used,
  };
  emit({ type: 'report', report });
  return report;
}

/** Hard cap on a sub-agent summary, in tokens. */
function capSummary(summary: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (summary.length <= maxChars) return summary.trim();
  return `${summary.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

/** Short digest of sub-agent findings; no raw page text leaks here. */
function buildSummary(summaries: readonly SubAgentSummary[]): string {
  return summaries
    .map(s => `## ${s.query}\n${s.summary}`)
    .join('\n\n')
    .slice(0, 8000);
}

export { estimateTokens, sanitizeExcerpt } from './untrusted';
