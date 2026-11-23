/**
 * LLM router fallback. Uses AI SDK structured output on the gateway route
 * named by ROUTE_ROUTER (an env-mapped route name, never a model id). The mock
 * model cannot produce reliable structured output, so the deterministic
 * default is used whenever `provider === 'mock'` unless a fake is injected.
 */
import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';

const fallbackSchema = z.object({
  skill: z.enum(['general', 'deep-research', 'planning', 'creative', 'code']),
  tier: z.enum(['fast', 'deep', 'research']),
  needsResearch: z.boolean(),
  needsPlan: z.boolean(),
  rationale: z.string().max(500),
});

export type FallbackDecision = z.infer<typeof fallbackSchema>;

export interface LlmRouter {
  decide(input: {
    text: string;
    signal?: AbortSignal;
  }): Promise<FallbackDecision>;
}

const SYSTEM = `You are a pre-dispatch router for a chat agent.
Pick one skill, the lightest sufficient tier, and whether research or a plan
is needed. Answer only with the structured fields. Never invent capabilities.`;

export function createLlmRouter(model: LanguageModel): LlmRouter {
  return {
    async decide({ text, signal }) {
      const result = await generateObject({
        model,
        schema: fallbackSchema,
        system: SYSTEM,
        prompt: text.slice(0, 4000),
        abortSignal: signal,
        temperature: 0,
      });
      return fallbackSchema.parse(result.object);
    },
  };
}
