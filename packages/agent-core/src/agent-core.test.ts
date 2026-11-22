import { streamText } from 'ai';
import { describe, expect, it } from 'vitest';
import { createLlm, loadLlmConfig } from './index';
import { createMockModel } from './testing';

describe('loadLlmConfig', () => {
  it('defaults to Switchyard with named routes and no API key', () => {
    const c = loadLlmConfig({});
    expect(c.baseURL).toBe('http://localhost:4000/v1');
    expect(c.apiKey).toBeUndefined();
    expect(c.routes).toEqual({
      fast: 'local-fast',
      deep: 'smart',
      research: 'smart-frontier',
    });
    expect(c.provider).toBe('gateway');
  });

  it('maps tiers to env route names', () => {
    const c = loadLlmConfig({ ROUTE_FAST: 'cheap', ROUTE_DEEP: 'big' });
    expect(c.routes.fast).toBe('cheap');
    expect(c.routes.deep).toBe('big');
  });

  it('fails closed on invalid values', () => {
    expect(() => loadLlmConfig({ LLM_BASE_URL: 'file:///etc/passwd' })).toThrow(
      /LLM_BASE_URL/,
    );
    expect(() => loadLlmConfig({ ROUTE_FAST: 'Bad Route!' })).toThrow(
      /ROUTE_FAST/,
    );
    expect(() => loadLlmConfig({ LLM_API_KEY: '' })).toThrow(/LLM_API_KEY/);
  });

  it('does not echo secret values in validation errors', () => {
    const secret = 'sk-should-never-appear';
    try {
      loadLlmConfig({ LLM_API_KEY: secret, ROUTE_FAST: 'Bad Route!' });
    } catch (e) {
      expect(String(e)).not.toContain(secret);
    }
  });
});

describe('createLlm', () => {
  it('binds gateway models to route names, never model ids', () => {
    const llm = createLlm(loadLlmConfig({ ROUTE_RESEARCH: 'research-route' }));
    const model = llm.model('research');
    expect(typeof model).toBe('object');
    expect((model as { modelId: string }).modelId).toBe('research-route');
    expect(llm.routeFor('research')).toBe('research-route');
  });

  it('streams token-by-token from the mock model without network', async () => {
    const llm = createLlm(loadLlmConfig({ LLM_PROVIDER: 'mock' }));
    const result = streamText({ model: llm.model('fast'), prompt: 'hi' });
    const deltas: string[] = [];
    for await (const d of result.textStream) deltas.push(d);
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join('')).toBe('Mock reply from the agent.');
  });

  it('mock model accepts custom text', async () => {
    const result = streamText({
      model: createMockModel({ text: 'a b c' }),
      prompt: 'x',
    });
    expect(await result.text).toBe('a b c');
  });
});
