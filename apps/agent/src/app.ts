/**
 * HTTP shell. Routes stay thin: parse with contract schemas, call an
 * agent-core seam, stream the contract's UI message stream back.
 */
import { CONTRACT_VERSION, type HealthResponse } from '@agent-chat/contract';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { ServerConfig } from './config';
import { createInngest } from './inngest';

export function createApp(config: ServerConfig) {
  const app = new Hono();

  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: config.webOrigin,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['content-type'],
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
    const { handler } = createInngest({ dev: config.inngest.dev });
    app.on(['GET', 'POST', 'PUT'], '/api/inngest', handler);
  }

  app.notFound(c => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    // Never echo internal error details (may contain upstream payloads).
    console.error('[agent] unhandled error:', err.name);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
