/** Wires the HTTP shell to agent-core services. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAgentRuntime,
  createLlm,
  createMcpClient,
  createRedisBuffer,
  createToolRegistry,
  defaultDeps,
  loadLlmConfig,
  loadSkills,
  loadToolsConfig,
  MemoryStore,
  PostgresStore,
  TierRateLimiter,
} from '@agent-chat/agent-core';
import type {
  AgentRuntime,
  LlmConfig,
  RateLimiter,
  SkillRegistry,
  ThreadStore,
} from '@agent-chat/agent-core';
import type { ServerConfig } from './config';
import type { GoalRunService } from './runs/service';
import type { RunEventEmitter } from './runs/events';
import type { Inngest, InngestFunction } from 'inngest';
import { createGoalRunService, bootstrapGoalRuns } from './runs/service';
import { createInngest } from './inngest';
import { createGoalRunFunctions } from './runs/inngest';
import { inngestRunEvents, noOpRunEvents } from './runs/events';

const SKILLS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../packages/agent-core/skills',
);

export interface Services {
  store: ThreadStore;
  runtime: AgentRuntime;
  limiter: RateLimiter;
  llmConfig: LlmConfig;
  runs: GoalRunService;
  runEvents: RunEventEmitter;
  inngestFunctions: InngestFunction.Any[];
  /** Single client shared by the serve endpoint and event emitter. */
  inngestClient?: Inngest;
  skills: SkillRegistry;
  close(): Promise<void>;
}

export async function createServices(
  config: ServerConfig,
  env: Record<string, string | undefined> = process.env,
  injectedStore?: ThreadStore,
): Promise<Services> {
  const llmConfig = loadLlmConfig(env);
  const llm = createLlm(llmConfig);

  // Card 6: skills from SKILL.md and the authorised tool boundary. MCP
  // servers are configured by env; an unreachable server exposes no tools.
  const toolsConfig = loadToolsConfig(env);
  const skills = await loadSkills(SKILLS_DIR);
  const registry = createToolRegistry({
    deps: defaultDeps(toolsConfig),
    skills,
    mcpClients: toolsConfig.MCP_SERVER_URLS.map(url =>
      createMcpClient({
        fetch: globalThis.fetch,
        url,
        apiKey: toolsConfig.MCP_API_KEY,
      }),
    ),
  });
  await registry.warm();

  let store = injectedStore;
  if (!store) {
    if (config.databaseUrl) {
      if (!config.redisUrl) {
        throw new Error(
          'DATABASE_URL requires REDIS_URL for resumable streams',
        );
      }
      const buffer = createRedisBuffer(config.redisUrl);
      const sql = readFileSync(
        new URL('../migrations/001_init.sql', import.meta.url),
        'utf8',
      );
      const postgres = new PostgresStore(config.databaseUrl, buffer);
      // Boot applies idempotent DDL; no migration CLI for local development.
      await postgres.bootstrap(sql);
      store = postgres;
    } else {
      // No Postgres: use the in-process store (Redis alone cannot back
      // threads/messages, so no Redis client is created here).
      store = new MemoryStore();
    }
  }

  const runs = createGoalRunService({
    config,
    llm,
    memoryStoreData: store instanceof MemoryStore ? store.data : undefined,
  });
  await bootstrapGoalRuns(runs.store);

  const { client, functions } = createInngest({ dev: config.inngest.dev });
  functions.push(...createGoalRunFunctions(client, runs));
  const runEvents = config.inngest.enabled
    ? inngestRunEvents(client)
    : noOpRunEvents;

  return {
    store,
    runtime: createAgentRuntime({ llm, store, skills, tools: registry }),
    limiter: new TierRateLimiter(),
    llmConfig,
    runs,
    runEvents,
    inngestFunctions: functions,
    inngestClient: client,
    skills,
    async close() {
      await store.close();
    },
  };
}
