/** Thin HTTP routes for durable goal runs. No business logic here. */
import {
  approvalDecisionSchema,
  steerRequestSchema,
  startRunRequestSchema,
} from '@agent-chat/contract';
import type { Context } from 'hono';
import type { Hono } from 'hono';
import type { AppEnv } from '../http';
import type { ServerConfig } from '../config';
import type { RunEventEmitter } from './events';
import type { Services } from '../services';
import { RunNotFoundError, type GoalRunService } from './service';
import { checkRateLimit, resolvePrincipal } from '../http';

export function mountRunRoutes(
  app: Hono<AppEnv>,
  config: ServerConfig,
  runs: GoalRunService,
  emit: RunEventEmitter,
  services?: Services,
) {
  async function readBody(c: { req: { json(): Promise<unknown> } }) {
    try {
      return { body: await c.req.json() };
    } catch {
      return { error: 'invalid_json' as const };
    }
  }

  app.post('/runs', async c => {
    const parsedBody = await readBody(c);
    if ('error' in parsedBody) return c.json(parsedBody, 400);
    const body = parsedBody.body;
    const principal = resolvePrincipal(c, config);
    if (services) {
      const limited = await checkRateLimit(c, services, principal);
      if (limited) return limited;
    }
    const parsed = startRunRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    const record = await runs.start({
      ownerId: principal.userId,
      threadId: parsed.data.threadId,
      goal: parsed.data.goal,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    // The HTTP route is the durable executor's entry point: one event per
    // accepted start, keyed by run id so Inngest retries dedupe the run.
    await emit({
      name: 'run/start',
      id: `run-start-${record.runId}`,
      data: {
        runId: record.runId,
        ownerId: principal.userId,
        threadId: record.threadId,
        goal: record.goal,
        ...(record.idempotencyKey
          ? { idempotencyKey: record.idempotencyKey }
          : {}),
      },
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
    const principal = resolvePrincipal(c, config);
    const parsedBody = await readBody(c);
    if ('error' in parsedBody) return c.json(parsedBody, 400);
    const parsed = approvalDecisionSchema.safeParse(parsedBody.body);
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    const { runId, approvalId } = c.req.param();
    try {
      if (parsed.data.decision === 'approve') {
        await runs.approve(runId, approvalId, parsed.data, principal.userId);
      } else {
        await runs.deny(runId, approvalId, parsed.data, principal.userId);
      }
      // A waiting step.waitForEvent must receive this decision; otherwise
      // approvals time out and deny is replayed as already-decided.
      await emit({
        name: 'run/decision',
        id: `run-decision-${approvalId}-${parsed.data.decision}`,
        data: {
          runId,
          approvalId,
          decision: parsed.data.decision,
          ownerId: principal.userId,
        },
      });
      return c.json({ status: 'recorded' });
    } catch (error) {
      return errorResponse(c, error);
    }
  });

  app.post('/runs/:runId/steer', async c => {
    const principal = resolvePrincipal(c, config);
    const parsedBody = await readBody(c);
    if ('error' in parsedBody) return c.json(parsedBody, 400);
    const parsed = steerRequestSchema.safeParse(parsedBody.body);
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    try {
      await runs.steer(c.req.param('runId'), parsed.data, principal.userId);
      return c.json({ status: 'recorded' });
    } catch (error) {
      return errorResponse(c, error);
    }
  });

  app.post('/runs/:runId/cancel', async c => {
    const principal = resolvePrincipal(c, config);
    try {
      await runs.cancel(c.req.param('runId'), principal.userId);
      return c.json({ status: 'canceled' });
    } catch (error) {
      return errorResponse(c, error);
    }
  });
}

/** Never leak internals; 404 for foreign/unknown runs, 409 for state errors. */
function errorResponse(c: Context<AppEnv>, error: unknown) {
  const message = error instanceof Error ? error.message : 'internal_error';
  const notFound =
    error instanceof RunNotFoundError || message === 'run_not_found';
  return c.json(
    { error: notFound ? 'not_found' : message },
    notFound ? 404 : 409,
  );
}
