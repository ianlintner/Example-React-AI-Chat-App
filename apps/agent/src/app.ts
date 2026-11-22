/**
 * HTTP shell. Routes stay thin: parse with contract schemas, call an
 * agent-core seam, stream the contract's UI message stream back.
 */
import { CONTRACT_VERSION, type HealthResponse } from '@agent-chat/contract';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { ServerConfig } from './config';
import type { Services } from './services';
import { createInngest } from './inngest';
import { serve } from 'inngest/hono';
import type { AppEnv } from './http';
import { mountChatRoutes } from './routes/chat';
import { mountThreadRoutes } from './routes/threads';
import { mountRunRoutes } from './runs/routes';

export function createApp(config: ServerConfig, services: Services) {
  const app = new Hono<AppEnv>();

  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: config.webOrigin,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: [
        'content-type',
        ...(config.trustUserHeader ? [config.trustUserHeader] : []),
      ],
      credentials: true,
    }),
  );

  app.get('/healthz', c =>
    c.json({
      status: 'ok',
      service: 'agent',
      contractVersion: CONTRACT_VERSION,
    } satisfies HealthResponse),
  );

  if (config.inngest.enabled) {
    const { client } = createInngest({ dev: config.inngest.dev });
    const handler = serve({ client, functions: services.inngestFunctions });
    app.on(['GET', 'POST', 'PUT'], '/api/inngest', handler);
  }

  mountThreadRoutes(app, config, services);
  mountChatRoutes(app, config, services);
  mountRunRoutes(app, config, services.runs, services.runEvents);

  app.notFound(c => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    // Never echo internal error details (may contain upstream payloads).
    console.error('[agent] unhandled error:', err.name);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
