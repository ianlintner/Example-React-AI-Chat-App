/** Thin HTTP routes for durable goal runs. No business logic here. */
import {
  approvalDecisionSchema,
  steerRequestSchema,
  startRunRequestSchema,
} from '@agent-chat/contract';
import type { Hono } from 'hono';
import type { AppEnv } from '../http';
import type { ServerConfig } from '../config';
import type { GoalRunService } from './service';
import { resolvePrincipal } from '../http';

export function mountRunRoutes(
  app: Hono<AppEnv>,
  config: ServerConfig,
  runs: GoalRunService,
) {
  app.post('/runs', async c => {
    const principal = resolvePrincipal(c, config);
    const parsed = startRunRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    const record = await runs.start({
      ownerId: principal.userId,
      threadId: parsed.data.threadId,
      goal: parsed.data.goal,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return c.json({ run: record }, 201);
  });

  app.get('/runs/:runId', async c => {
    const principal = resolvePrincipal(c, config);
    const record = await runs.get(c.req.param('runId'), principal.userId);
    if (!record) return c.json({ error: 'not_found' }, 404);
    return c.json({ run: record });
  });

  app.post('/runs/:runId/approvals/:approvalId', async c => {
    const parsed = approvalDecisionSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    const { runId, approvalId } = c.req.param();
    try {
      if (parsed.data.decision === 'approve') {
        await runs.approve(runId, approvalId, parsed.data);
      } else {
        await runs.deny(runId, approvalId, parsed.data);
      }
      return c.json({ status: 'recorded' });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'internal_error' },
        409,
      );
    }
  });

  app.post('/runs/:runId/steer', async c => {
    const parsed = steerRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    try {
      await runs.steer(c.req.param('runId'), parsed.data);
      return c.json({ status: 'recorded' });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'internal_error' },
        409,
      );
    }
  });

  app.post('/runs/:runId/cancel', async c => {
    try {
      await runs.cancel(c.req.param('runId'));
      return c.json({ status: 'canceled' });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'internal_error' },
        409,
      );
    }
  });
}
