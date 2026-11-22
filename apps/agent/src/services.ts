/** Wires the HTTP shell to agent-core services. */
import { readFileSync } from 'node:fs';
import {
  createAgentRuntime,
  createLlm,
  createRedisBuffer,
  loadLlmConfig,
  MemoryStore,
  PostgresStore,
  TierRateLimiter,
} from '@agent-chat/agent-core';
import type {
  AgentRuntime,
  LlmConfig,
  RateLimiter,
  ThreadStore,
} from '@agent-chat/agent-core';
import type { ServerConfig } from './config';

export interface Services {
  store: ThreadStore;
  runtime: AgentRuntime;
  limiter: RateLimiter;
  llmConfig: LlmConfig;
  close(): Promise<void>;
}

export async function createServices(
  config: ServerConfig,
  env: Record<string, string | undefined> = process.env,
  injectedStore?: ThreadStore,
): Promise<Services> {
  const llmConfig = loadLlmConfig(env);
  const llm = createLlm(llmConfig);

  let store = injectedStore;
  if (!store) {
    const buffer = config.redisUrl
      ? createRedisBuffer(config.redisUrl)
      : undefined;
    if (config.databaseUrl && buffer) {
      const sql = readFileSync(
        new URL('../migrations/001_init.sql', import.meta.url),
        'utf8',
      );
      const postgres = new PostgresStore(config.databaseUrl, buffer);
      // Boot applies idempotent DDL; no migration CLI for local development.
      await postgres.bootstrap(sql);
      store = postgres;
    } else {
      store = new MemoryStore();
    }
  }

  return {
    store,
    runtime: createAgentRuntime({ llm, store }),
    limiter: new TierRateLimiter(),
    llmConfig,
    async close() {
      await store.close();
    },
  };
}
