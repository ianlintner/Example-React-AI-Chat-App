import { routeLLMForTier } from '../tierRouter';

describe('routeLLMForTier', () => {
  const baseConfig = {
    provider: 'anthropic' as const,
    fallbackProvider: 'openai' as const,
    model: 'claude-sonnet-4-6',
  };

  afterEach(() => {
    delete process.env.LLM_TIERED;
    delete process.env.LLM_FREE_MODEL;
  });

  it('is a no-op when LLM_TIERED is unset', () => {
    const result = routeLLMForTier(baseConfig, 'anonymous');
    expect(result.overrideApplied).toBe(false);
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('is a no-op for authenticated callers even with LLM_TIERED on', () => {
    process.env.LLM_TIERED = 'true';
    const result = routeLLMForTier(baseConfig, 'authenticated');
    expect(result.overrideApplied).toBe(false);
    expect(result.provider).toBe('anthropic');
  });

  it('routes anonymous callers to foundry when LLM_TIERED=true', () => {
    process.env.LLM_TIERED = 'true';
    const result = routeLLMForTier(baseConfig, 'anonymous');
    expect(result.overrideApplied).toBe(true);
    expect(result.provider).toBe('foundry');
    expect(result.fallbackProvider).toBe('openai');
    expect(result.model).toBe('gpt-4o-mini');
  });

  it('honours LLM_FREE_MODEL for the free-tier model name', () => {
    process.env.LLM_TIERED = 'true';
    process.env.LLM_FREE_MODEL = 'gpt-4o-mini-free';
    const result = routeLLMForTier(baseConfig, 'anonymous');
    expect(result.model).toBe('gpt-4o-mini-free');
  });

  it('is a no-op when tier is undefined', () => {
    process.env.LLM_TIERED = 'true';
    const result = routeLLMForTier(baseConfig, undefined);
    expect(result.overrideApplied).toBe(false);
    expect(result.provider).toBe('anthropic');
  });
});
