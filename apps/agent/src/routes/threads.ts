/** Thread CRUD; all reads are scoped to the signed principal. */
import { ForbiddenError, NotFoundError } from '@agent-chat/agent-core';
import type { Hono } from 'hono';
import { z } from 'zod';
import { checkRateLimit, resolvePrincipal } from '../http';
import type { AppEnv } from '../http';
import type { ServerConfig } from '../config';
import type { Services } from '../services';

const createSchema = z.object({ title: z.string().min(1).max(200).optional() });

export function mountThreadRoutes(
  app: Hono<AppEnv>,
  config: ServerConfig,
  services: Services,
) {
  app.get('/threads', async c => {
    const principal = resolvePrincipal(c, config);
    const threads = await services.store.listThreads(principal);
    return c.json({ threads });
  });

  app.post('/threads', async c => {
    const principal = resolvePrincipal(c, config);
    const limited = await checkRateLimit(c, services, principal);
    if (limited) return limited;
    const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    const threadId = `thr_${crypto.randomUUID()}`;
    const thread = await services.store.createThread(
      threadId,
      principal,
      parsed.data.title,
    );
    return c.json(thread, 201);
  });

  app.get('/threads/:threadId', async c => {
    const principal = resolvePrincipal(c, config);
    const threadId = c.req.param('threadId');
    let thread;
    try {
      thread = await services.store.getThread(threadId, principal);
    } catch (error) {
      if (error instanceof ForbiddenError || error instanceof NotFoundError) {
        return c.json({ error: 'thread_not_found' }, 404);
      }
      throw error;
    }
    if (!thread) return c.json({ error: 'thread_not_found' }, 404);
    return c.json({
      ...thread,
      messages: await services.store.loadThread(threadId, principal),
    });
  });
}
