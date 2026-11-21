/**
 * The single place that turns a tier into an AI SDK `LanguageModel`.
 * Everything else asks `llm.model(tier)`; nothing else imports a provider.
 */
import type { Tier } from '@agent-chat/contract';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { LlmConfig } from './config';
import { createMockModel } from './testing/mock-model';

export interface Llm {
  /** Resolved gateway route for a tier (for logs/metrics; not a model id). */
  routeFor(tier: Tier): string;
  model(tier: Tier): LanguageModel;
}

export function createLlm(config: LlmConfig): Llm {
  if (config.provider === 'mock') {
    return {
      routeFor: tier => config.routes[tier],
      model: () => createMockModel(),
    };
  }
  const gateway = createOpenAICompatible({
    name: 'gateway',
    baseURL: config.baseURL,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    includeUsage: true,
  });
  return {
    routeFor: tier => config.routes[tier],
    model: tier => gateway.chatModel(config.routes[tier]),
  };
}
