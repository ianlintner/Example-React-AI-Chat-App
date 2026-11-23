/** 24 golden routing cases. Expected outcomes are human-labelled. */
import type { RouteOutcome } from './classify';

export interface GoldenCase {
  id: string;
  text: string;
  expected: RouteOutcome;
}

export const GOLDEN_CASES: readonly GoldenCase[] = [
  {
    id: 'g01',
    text: 'hello there',
    expected: {
      skill: 'general',
      tier: 'fast',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g02',
    text: 'Thanks!',
    expected: {
      skill: 'general',
      tier: 'fast',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g03',
    text: 'What time is it in UTC?',
    expected: {
      skill: 'general',
      tier: 'fast',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g04',
    text: 'Tell me a joke about pirates',
    expected: {
      skill: 'creative',
      tier: 'fast',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g05',
    text: 'Write a haiku about the sea',
    expected: {
      skill: 'creative',
      tier: 'fast',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g06',
    text: 'Invent a short story about a robot',
    expected: {
      skill: 'creative',
      tier: 'fast',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g07',
    text: 'Compare Postgres and SQLite for my app',
    expected: {
      skill: 'deep-research',
      tier: 'research',
      needsResearch: true,
      needsPlan: false,
    },
  },
  {
    id: 'g08',
    text: 'Find sources on the history of the printing press',
    expected: {
      skill: 'deep-research',
      tier: 'research',
      needsResearch: true,
      needsPlan: false,
    },
  },
  {
    id: 'g09',
    text: 'What are the latest benchmark results for vector databases?',
    expected: {
      skill: 'deep-research',
      tier: 'research',
      needsResearch: true,
      needsPlan: false,
    },
  },
  {
    id: 'g10',
    text: 'I need a comprehensive, cited answer on EU AI rules',
    expected: {
      skill: 'deep-research',
      tier: 'research',
      needsResearch: true,
      needsPlan: false,
    },
  },
  {
    id: 'g11',
    text: 'Verify this claim with official docs',
    expected: {
      skill: 'deep-research',
      tier: 'research',
      needsResearch: true,
      needsPlan: false,
    },
  },
  {
    id: 'g12',
    text: 'Research current prices for rust web hosts',
    expected: {
      skill: 'deep-research',
      tier: 'research',
      needsResearch: true,
      needsPlan: false,
    },
  },
  {
    id: 'g13',
    text: 'Plan a weekend trip to Berlin',
    expected: {
      skill: 'planning',
      tier: 'deep',
      needsResearch: false,
      needsPlan: true,
    },
  },
  {
    id: 'g14',
    text: 'Create a checklist for onboarding new engineers',
    expected: {
      skill: 'planning',
      tier: 'deep',
      needsResearch: false,
      needsPlan: true,
    },
  },
  {
    id: 'g15',
    text: 'Help me organise a multi-step migration',
    expected: {
      skill: 'planning',
      tier: 'deep',
      needsResearch: false,
      needsPlan: true,
    },
  },
  {
    id: 'g16',
    text: 'Build a roadmap for our Q1 project',
    expected: {
      skill: 'planning',
      tier: 'deep',
      needsResearch: false,
      needsPlan: true,
    },
  },
  {
    id: 'g17',
    text: 'Fix this TypeScript bug: cannot read property of undefined',
    expected: {
      skill: 'code',
      tier: 'deep',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g18',
    text: 'Debug the failing SQL query and stack trace',
    expected: {
      skill: 'code',
      tier: 'deep',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g19',
    text: 'Refactor this function to use a regex',
    expected: {
      skill: 'code',
      tier: 'deep',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g20',
    text: 'Review the API code for errors',
    expected: {
      skill: 'code',
      tier: 'deep',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g21',
    text: 'Analyse the trade-offs of event sourcing',
    expected: {
      skill: 'general',
      tier: 'deep',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g22',
    text: 'Explain in detail how TCP works',
    expected: {
      skill: 'general',
      tier: 'deep',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g23',
    text: 'Why is the sky blue?',
    expected: {
      skill: 'general',
      tier: 'deep',
      needsResearch: false,
      needsPlan: false,
    },
  },
  {
    id: 'g24',
    text: 'Summarise the paragraph I pasted',
    expected: {
      skill: 'general',
      tier: 'fast',
      needsResearch: false,
      needsPlan: false,
    },
  },
];

export function sameOutcome(a: RouteOutcome, b: RouteOutcome): boolean {
  return (
    a.skill === b.skill &&
    a.tier === b.tier &&
    a.needsResearch === b.needsResearch &&
    a.needsPlan === b.needsPlan
  );
}

/** Accuracy of a classifier over the golden set (0..1). */
export function accuracyOf(
  classify: (text: string) => RouteOutcome,
  cases: readonly GoldenCase[] = GOLDEN_CASES,
): { accuracy: number; correct: number; total: number; missed: string[] } {
  const missed = cases
    .filter(c => !sameOutcome(classify(c.text), c.expected))
    .map(c => c.id);
  return {
    accuracy: (cases.length - missed.length) / cases.length,
    correct: cases.length - missed.length,
    total: cases.length,
    missed,
  };
}
