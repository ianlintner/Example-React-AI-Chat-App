import { loadLlmConfig } from '@agent-chat/agent-core';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadServerConfig } from './config';

const config = loadServerConfig();
// Validate LLM env at boot so misconfiguration fails fast (fail closed).
// Log only a fixed label derived from it, never config values (which may
// include LLM_API_KEY).
const llmLabel = loadLlmConfig().provider === 'mock' ? 'mock' : 'gateway';

const app = createApp(config);
const server = serve(
  { fetch: app.fetch, port: config.port, hostname: config.host },
  info => {
    console.log(
      `[agent] listening on http://${info.address}:${info.port} ` +
        `(llm=${llmLabel}, inngest=${config.inngest.enabled ? 'on' : 'off'})`,
    );
  },
);

function shutdown(signal: string) {
  console.log(`[agent] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
