/**
 * Deterministic routing baseline. Used in `ROUTER_MODE=off`, in tests, and as
 * the dispatch decision in `shadow` mode. It is deliberately simple and its
 * accuracy against the golden set is reported by `scoreGolden`.
 */
import type { Tier } from '@agent-chat/contract';

export interface RouteOutcome {
  skill: 'general' | 'deep-research' | 'planning' | 'creative' | 'code';
  tier: Tier;
  needsResearch: boolean;
  needsPlan: boolean;
}

const RESEARCH =
  /\b(research|source[sd]?|citation[sd]?|compare|latest|current|news|accurate|verify|evidence|benchmark|weather|price[sd]?|who is|what happened|official docs?)\b/i;
const PLAN =
  /\b(plan|steps?|roadmap|project|implement|build|migrate|organi[sz]e|schedule|checklist|multi[- ]step|goal|workflow|strategy)\b/i;
const CODE =
  /\b(code|bug|debug|typescript|javascript|python|rust|function|api|compile|error|stack trace|refactor|test|sql|regex)\b/i;
const CREATIVE =
  /\b(story|poem|joke|game|creative|imagine|funny|roleplay|playful|song|haiku)\b/i;
const RESEARCH_TIER =
  /\b(deep research|sourced|citations?|comprehensive|in[- ]depth|investigate)\b/i;
const DEEP =
  /\b(analy[sz]e|explain in detail|why|complex|architecture|trade[- ]?offs?|detailed|thorough)\b/i;

/** Classify user text without any network call or model. */
export function classify(text: string): RouteOutcome {
  const t = text.trim();
  const lower = t.toLowerCase();
  const needsResearch = RESEARCH.test(lower);
  const needsPlan = PLAN.test(lower);
  let skill: RouteOutcome['skill'] = 'general';
  if (CODE.test(lower)) skill = 'code';
  else if (CREATIVE.test(lower)) skill = 'creative';
  else if (needsResearch) skill = 'deep-research';
  else if (needsPlan) skill = 'planning';

  let tier: Tier = 'fast';
  if (needsResearch || RESEARCH_TIER.test(lower)) tier = 'research';
  else if (needsPlan || CODE.test(lower) || DEEP.test(lower) || t.length > 800)
    tier = 'deep';

  return { skill, tier, needsResearch, needsPlan };
}
