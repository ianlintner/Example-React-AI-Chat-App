/**
 * LLM configuration from the environment. The app never names a model: it
 * talks to an OpenAI-compatible gateway (Switchyard by default) and asks for
 * a *route name* per tier. Route names are configuration, not code.
 */
import type { Tier } from '@agent-chat/contract';
import { z } from 'zod';

/** Lowercase gateway route names, e.g. `smart`, `local-fast`. */
const routeName = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, 'route names are lowercase slugs');

export const llmEnvSchema = z.object({
  LLM_BASE_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:4000/v1'),
  /** Optional bearer for the gateway. No default: absent means "no auth". */
  LLM_API_KEY: z.string().min(1).optional(),
  ROUTE_FAST: routeName.default('local-fast'),
  ROUTE_DEEP: routeName.default('smart'),
  ROUTE_RESEARCH: routeName.default('smart-frontier'),
  /** `mock` swaps in the deterministic mock model (tests, CI, offline dev). */
  LLM_PROVIDER: z.enum(['gateway', 'mock']).default('gateway'),
});

export interface LlmConfig {
  baseURL: string;
  apiKey: string | undefined;
  routes: Record<Tier, string>;
  provider: 'gateway' | 'mock';
}

/** Parse env; throws a readable error listing every invalid variable. */
export function loadLlmConfig(
  env: Record<string, string | undefined> = process.env,
): LlmConfig {
  const parsed = llmEnvSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid LLM configuration: ${fields}`);
  }
  const e = parsed.data;
  return {
    baseURL: e.LLM_BASE_URL,
    apiKey: e.LLM_API_KEY,
    routes: { fast: e.ROUTE_FAST, deep: e.ROUTE_DEEP, research: e.ROUTE_RESEARCH },
    provider: e.LLM_PROVIDER,
  };
}
