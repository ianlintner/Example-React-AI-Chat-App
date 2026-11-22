import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadServerConfig } from './config';
import { createServices } from './services';

const config = loadServerConfig();
const services = await createServices(config);

const llmLabel = services.llmConfig.provider === 'mock' ? 'mock' : 'gateway';

const app = createApp(config, services);
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
