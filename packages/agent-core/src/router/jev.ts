/**
 * A thin typed client for TypeSafe Jev's `POST /v1/systemone` choice API.
 * No SDK dependency: the wire shape is defined by api.typesafe.ai/openapi.json.
 * The key is supplied by config (env), never logged and never stored in code.
 */
import { z } from 'zod';
import type { RouterConfig } from './config';

/** The four routing dimensions, plus the boolean flags as choices. */
export const ROUTER_QUESTIONS = {
  skill: 'skill',
  tier: 'tier',
  research: 'research',
  plan: 'plan',
} as const;

/** Skills available to card 6; kept as data, not code paths. */
export const ROUTER_SKILLS = {
  general: 'Everyday chat, questions, summarising or rewriting provided text.',
  'deep-research':
    'Requests for sourced facts, comparisons, current information or citations.',
  planning:
    'Multi-step goals, projects or tasks that need a plan and checkpoints.',
  creative: 'Writing, stories, jokes, games and playful entertainment tasks.',
  code: 'Programming, debugging, code review and technical implementation.',
} as const;

const choiceAnswer = z.object({
  type: z.literal('choice'),
  choice: z.string(),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number()),
});

const systemOneResponse = z.object({
  model: z.string(),
  answers: z.record(z.string(), choiceAnswer),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

export interface JevChoice {
  choice: string;
  confidence: number;
  /** Gap between the top two choices; low values trigger the fallback. */
  margin: number;
}

export interface JevDecision {
  skill: JevChoice;
  tier: JevChoice;
  research: JevChoice;
  plan: JevChoice;
  /** The model that answered, from Jev's response (not used for dispatch). */
  model: string;
}

export interface JevClient {
  classify(input: { text: string; signal?: AbortSignal }): Promise<JevDecision>;
}

function marginOf(probabilities: Record<string, number>): number {
  const sorted = Object.values(probabilities).sort((a, b) => b - a);
  return sorted.length < 2
    ? 1
    : Math.max(0, Math.min(1, sorted[0]! - sorted[1]!));
}

function choiceOf(answer: z.infer<typeof choiceAnswer>): JevChoice {
  return {
    choice: answer.choice,
    confidence: answer.confidence,
    margin: marginOf(answer.probabilities),
  };
}

/** Extract the latest user text; the router decides on the user's turn only. */
export function classifyText(text: string): string {
  return text.trim().slice(0, 4000);
}

/** Real HTTP client. Deterministic in shape, so tests can inject a fake. */
export function createJevClient(config: RouterConfig): JevClient {
  if (!config.jevApiKey) {
    throw new Error('JEV_API_KEY is required to create the Jev client');
  }
  const endpoint = new URL('/v1/systemone', config.jevBaseUrl);
  const instructions = (question: string) =>
    `Choose the best routing option for this chat message. ${question}`;
  return {
    async classify({ text, signal }) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Never log the header or the response body on error.
          authorization: `Bearer ${config.jevApiKey}`,
        },
        body: JSON.stringify({
          model: config.jevModel,
          state: classifyText(text),
          questions: {
            [ROUTER_QUESTIONS.skill]: {
              type: 'choice',
              instructions: instructions('Which skill should handle it?'),
              criteria: ROUTER_SKILLS,
            },
            [ROUTER_QUESTIONS.tier]: {
              type: 'choice',
              instructions: instructions('Which model tier is sufficient?'),
              criteria: {
                fast: 'Short, simple or conversational messages.',
                deep: 'Complex reasoning, long input, code or detailed analysis.',
                research: 'Needs external sources, current facts or citations.',
              },
            },
            [ROUTER_QUESTIONS.research]: {
              type: 'choice',
              instructions: instructions('Does this need web research?'),
              criteria: {
                no: 'No external information is needed.',
                yes: 'Current, sourced or verifiable external information is needed.',
              },
            },
            [ROUTER_QUESTIONS.plan]: {
              type: 'choice',
              instructions: instructions('Does this need a multi-step plan?'),
              criteria: {
                no: 'A single response is enough.',
                yes: 'Several dependent steps with checkpoints are needed.',
              },
            },
          },
        }),
        signal,
      });
      if (!response.ok) throw new Error('jev_request_failed');
      const parsed = systemOneResponse.safeParse(await response.json());
      if (!parsed.success) throw new Error('jev_invalid_response');
      const a = parsed.data.answers;
      for (const key of Object.values(ROUTER_QUESTIONS)) {
        if (!a[key]) throw new Error('jev_incomplete_response');
      }
      return {
        skill: choiceOf(a[ROUTER_QUESTIONS.skill]!),
        tier: choiceOf(a[ROUTER_QUESTIONS.tier]!),
        research: choiceOf(a[ROUTER_QUESTIONS.research]!),
        plan: choiceOf(a[ROUTER_QUESTIONS.plan]!),
        model: parsed.data.model,
      };
    },
  };
}
