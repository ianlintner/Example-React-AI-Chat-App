import { LLMProvider } from './provider';
import { OpenAIProvider } from './openaiProvider';
import { AnthropicProvider } from './anthropicProvider';
import { FoundryProvider } from './foundryProvider';
import { LLMProviderId } from '../agents/types';
import { logger } from '../logger';

const FALLBACK_OPENAI_MODEL = 'gpt-4o-mini';

class ProviderRegistry {
  private openai: OpenAIProvider | null = null;
  private anthropic: AnthropicProvider | null = null;
  private foundry: FoundryProvider | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAIProvider(process.env.OPENAI_API_KEY);
    }
    // Anthropic direct API takes precedence; falls back to Foundry-hosted Claude
    // when only Foundry is configured (Foundry exposes Anthropic-compatible /v1/messages).
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
    } else if (
      process.env.AZURE_FOUNDRY_API_KEY &&
      process.env.AZURE_FOUNDRY_ENDPOINT
    ) {
      this.anthropic = new AnthropicProvider(
        process.env.AZURE_FOUNDRY_API_KEY,
        process.env.AZURE_FOUNDRY_ENDPOINT,
      );
      logger.info(
        '[llm] anthropic provider routed through Azure Foundry endpoint',
      );
    }
    if (process.env.AZURE_FOUNDRY_PROJECT_ENDPOINT) {
      this.foundry = new FoundryProvider(
        process.env.AZURE_FOUNDRY_PROJECT_ENDPOINT,
      );
    }
  }

  resolve(
    providerId: LLMProviderId | undefined,
    fallback?: LLMProviderId,
  ): { provider: LLMProvider; model?: string } {
    const preferred = this.get(providerId);
    if (preferred) {
      return { provider: preferred };
    }

    const fallbackProvider = this.get(fallback ?? 'openai');
    if (fallbackProvider) {
      logger.info(
        `[llm] fallback: ${providerId} → ${fallback ?? 'openai'} (model=${FALLBACK_OPENAI_MODEL})`,
      );
      return { provider: fallbackProvider, model: FALLBACK_OPENAI_MODEL };
    }

    // Last resort: always return openai even if no key (will fail at call time)
    logger.warn(
      '[llm] no configured providers; will attempt OpenAI without key',
    );
    return { provider: new OpenAIProvider(''), model: FALLBACK_OPENAI_MODEL };
  }

  private get(id: LLMProviderId | undefined): LLMProvider | null {
    switch (id) {
      case 'openai':
        return this.openai;
      case 'anthropic':
        return this.anthropic;
      case 'foundry':
        return this.foundry;
      default:
        return null;
    }
  }
}

export const providerRegistry = new ProviderRegistry();
