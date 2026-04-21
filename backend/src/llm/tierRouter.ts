import type { Tier } from '../middleware/identity';
import type { LLMProviderId } from '../agents/types';

/**
 * Tier-aware overrides for LLM provider selection.
 *
 * Authenticated callers use whatever the agent config asks for
 * (typically a premium Anthropic/OpenAI model). Anonymous callers are
 * routed to Azure AI Foundry — we run a free/low-cost deployment
 * there — so uncredentialed traffic cannot burn premium-provider
 * quota. The behaviour is gated on `LLM_TIERED=true` so production
 * can roll it out independently of the rest of the anon work.
 *
 * When Foundry is not configured, the registry falls back to the
 * agent's configured `fallbackProvider`, which keeps local dev
 * working without Foundry credentials.
 */

export interface TierRouteConfig {
  provider: LLMProviderId | undefined;
  fallbackProvider: LLMProviderId | undefined;
  model: string;
}

export interface TierRouteResult {
  provider: LLMProviderId | undefined;
  fallbackProvider: LLMProviderId | undefined;
  model: string;
  overrideApplied: boolean;
}

export function isTieredLLMEnabled(): boolean {
  return (process.env.LLM_TIERED || '').toLowerCase() === 'true';
}

export function routeLLMForTier(
  agent: TierRouteConfig,
  tier: Tier | undefined,
): TierRouteResult {
  if (!isTieredLLMEnabled() || tier !== 'anonymous') {
    return {
      provider: agent.provider,
      fallbackProvider: agent.fallbackProvider,
      model: agent.model,
      overrideApplied: false,
    };
  }

  const freeModel = process.env.LLM_FREE_MODEL || 'gpt-4o-mini';
  return {
    provider: 'foundry',
    // OpenAI is the safe last-resort; local dev without Foundry credentials
    // still gets a working model.
    fallbackProvider: agent.fallbackProvider ?? 'openai',
    model: freeModel,
    overrideApplied: true,
  };
}
