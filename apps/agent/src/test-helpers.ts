import { createAgentRuntime, createLlm, createMockModel, MemoryStore, TierRateLimiter } from '@agent-chat/agent-core';
import type { LlmConfig, StoreData } from '@agent-chat/agent-core';
import { loadServerConfig } from './config';
import type { Services } from './services';

export const TEST_ENV = {
  SESSION_SECRET: 'test-secret-at-least-32-characters-long',
  LLM_PROVIDER: 'mock',
};

export const LLM_CONFIG: LlmConfig = {
  baseURL: 'http://localhost:4000/v1',
  routes: { fast: 'local-fast', deep: 'smart', research: 'smart-frontier' },
  provider: 'mock',
  apiKey: 'not-used-in-mock-tests',
};

export function testConfig(overrides: Record<string, string> = {}) {
  return loadServerConfig({ ...TEST_ENV, ...overrides });
}

export function testServices(
  data?: StoreData,
  mockText = 'Mock reply from the agent.',
  chunkDelayMs = 0,
): Services {
  const store = new MemoryStore(data);
  const llm = createLlm(LLM_CONFIG);
  llm.model = () => createMockModel({ text: mockText, chunkDelayMs });
  return {
    store,
    runtime: createAgentRuntime({ llm, store }),
    limiter: new TierRateLimiter(),
    llmConfig: LLM_CONFIG,
    async close() {
      await store.close();
    },
  };
}

export const AUTH_HEADERS = {
  'content-type': 'application/json',
  'x-user-id': 'test-user',
};

export const TEST_CONFIG = testConfig({ TRUST_USER_HEADER: 'x-user-id' });

export const TEST_PRINCIPAL = {
  userId: 'user_test-user',
  kind: 'user' as const,
  tier: 'free' as const,
};

export function chatBody(threadId: string, text = 'hello') {
  return JSON.stringify({
    id: threadId,
    trigger: 'submit-message',
    messages: [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text }] },
    ],
  });
}

export async function sseEvents(res: Response): Promise<unknown[]> {
  const text = await res.text();
  return text
    .split('\n')
    .filter(line => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map(line => JSON.parse(line.slice(6)) as unknown);
}
