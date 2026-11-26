/**
 * HTTP shell. Routes stay thin: parse with contract schemas, call an
 * agent-core seam, stream the contract's UI message stream back.
 */
import { timingSafeEqual } from 'node:crypto';
import { CONTRACT_VERSION, type HealthResponse } from '@agent-chat/contract';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { ServerConfig } from './config';
import type { Services } from './services';
import { routePath as matchedRoutePath } from 'hono/route';
import { serve } from 'inngest/hono';
import type { AppEnv } from './http';
import { mountChatRoutes } from './routes/chat';
import { mountThreadRoutes } from './routes/threads';
import { routerRegistry } from './router-obs';
import { createAgentMetrics } from '@agent-chat/agent-core';
import { mountRunRoutes } from './runs/routes';

/** Card 10: legacy-named metrics on the same registry as route telemetry. */
export const agentMetrics = createAgentMetrics(routerRegistry);

export function createApp(config: ServerConfig, services: Services) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    const method = c.req.method;
    const labels = {
      service: 'agent',
      http_method: method,
      // Filled after next(): only registered route patterns get their own
      // label. Anything else (404s, early rejections) shares one value.
      http_route: 'unmatched',
    };
    agentMetrics.activeRequests.inc({ service: 'agent', http_method: method });
    const began = Date.now();
    try {
      await next();
    } finally {
      const status = c.res.status;
      // The matched handler pattern is only known after next() ran. -1 picks
      // the last matched route, i.e. the endpoint rather than this middleware.
      const pattern = matchedRoutePath(c, -1);
      const final = {
        ...labels,
        ...(pattern && pattern !== '*' && !pattern.includes('*')
          ? { http_route: pattern.slice(0, 80) }
          : {}),
        http_status_code: String(status),
        status_class: `${Math.floor(status / 100)}xx`,
      };
      agentMetrics.httpRequests.inc(final);
      agentMetrics.httpDuration.observe(final, (Date.now() - began) / 1000);
      agentMetrics.activeRequests.dec({
        service: 'agent',
        http_method: method,
      });
    }
  });

  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: config.webOrigin,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: [
        'content-type',
        'x-vercel-ai-ui-message-stream',
        ...(config.trustUserHeader ? [config.trustUserHeader] : []),
      ],
      exposeHeaders: ['x-run-id'],
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

  /**
   * Prometheus scrape endpoint. Open on loopback only; a non-loopback
   * listener is rejected at boot unless METRICS_TOKEN is configured.
   */
  app.get('/metrics', async c => {
    if (config.metricsToken) {
      const supplied = c.req.header('x-metrics-token') ?? '';
      const a = Buffer.from(supplied);
      const b = Buffer.from(config.metricsToken);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return c.json({ error: 'unauthorized' }, 401);
      }
    }
    const body = await routerRegistry.metrics();
    return c.body(body, 200, { 'content-type': routerRegistry.contentType });
  });

  if (config.inngest.enabled && services.inngestClient) {
    const handler = serve({
      client: services.inngestClient,
      functions: services.inngestFunctions,
    });
    app.on(['GET', 'POST', 'PUT'], '/api/inngest', handler);
  }

  mountThreadRoutes(app, config, services);
  mountChatRoutes(app, config, services);
  mountRunRoutes(app, config, services.runs, services.runEvents, services);

  app.notFound(c => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    // Never echo internal error details (may contain upstream payloads).
    console.error('[agent] unhandled error:', err.name);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
