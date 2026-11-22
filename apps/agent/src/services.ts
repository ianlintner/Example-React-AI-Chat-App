/** Wires the HTTP shell to agent-core services. */
import { readFileSync } from 'node:fs';
import {
  createAgentRuntime,
  createJevClient,
  createLlm,
  createLlmRouter,
  createRedisBuffer,
  createRouter,
  loadLlmConfig,
  loadRouterConfig,
  MemoryStore,
  PostgresStore,
  TierRateLimiter,
} from '@agent-chat/agent-core';
import type {
  AgentRuntime,
  JevClient,
  LlmConfig,
  LlmRouter,
  RateLimiter,
  RouteMetrics,
  RouteSink,
  Router,
  ThreadStore,
} from '@agent-chat/agent-core';
import type { ServerConfig } from './config';
import { createRouterTelemetry } from './router-obs';
import { PostgresRouteSink } from './route-sink';

export interface Services {
  store: ThreadStore;
  runtime: AgentRuntime;
  router: Router;
  limiter: RateLimiter;
  llmConfig: LlmConfig;
  close(): Promise<void>;
}

export interface ServiceOverrides {
  store?: ThreadStore;
  jev?: JevClient;
  llmRouter?: LlmRouter;
  sink?: RouteSink;
  metrics?: RouteMetrics;
}

export async function createServices(
  config: ServerConfig,
  env: Record<string, string | undefined> = process.env,
  overrides: ServiceOverrides = {},
): Promise<Services> {
  const llmConfig = loadLlmConfig(env);
  const routerConfig = loadRouterConfig(env);
  const llm = createLlm(llmConfig);

  let store = overrides.store;
  let routeSink = overrides.sink;
  if (!store) {
    if (config.databaseUrl) {
      if (!config.redisUrl) {
        throw new Error(
          'DATABASE_URL requires REDIS_URL for resumable streams',
        );
      }
      const buffer = createRedisBuffer(config.redisUrl);
      const sql = [
        '../migrations/001_init.sql',
        '../migrations/002_route_decisions.sql',
      ]
        .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
        .join('\n');
      const postgres = new PostgresStore(config.databaseUrl, buffer);
      // Boot applies idempotent DDL; no migration CLI for local development.
      await postgres.bootstrap(sql);
      store = postgres;
      routeSink ??= new PostgresRouteSink(config.databaseUrl);
    } else {
      // No Postgres: use the in-process store (Redis alone cannot back
      // threads/messages, so no Redis client is created here).
      store = new MemoryStore();
    }
  }

  const telemetry = createRouterTelemetry();
  const router = createRouter({
    config: routerConfig,
    jev:
      overrides.jev ??
      (routerConfig.jevApiKey ? createJevClient(routerConfig) : undefined),
    llmRouter:
      overrides.llmRouter ??
      (llmConfig.provider === 'gateway'
        ? createLlmRouter(llm.modelForRoute(llmConfig.routerRoute))
        : undefined),
    sink: routeSink,
    metrics: overrides.metrics ?? telemetry.metrics,
  });

  return {
    store,
    router,
    runtime: createAgentRuntime({ llm, store, decide: router.decide }),
    limiter: new TierRateLimiter(),
    llmConfig,
    async close() {
      await store.close();
      await routeSink?.close?.();
    },
  };
}
