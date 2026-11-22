/** POST /chat and resumable GET /chat/:runId/stream. */
import {
  createUIMessageStreamResponse,
  type UIMessageChunk,
} from 'ai';
import { chatRequestSchema, validateAgentMessages } from '@agent-chat/contract';
import type { AgentUIMessageChunk } from '@agent-chat/contract';
import type { Hono } from 'hono';
import { checkRateLimit, resolvePrincipal } from '../http';
import type { AppEnv } from '../http';
import type { ServerConfig } from '../config';
import type { Services } from '../services';

export function mountChatRoutes(
  app: Hono<AppEnv>,
  config: ServerConfig,
  services: Services,
) {
  app.post('/chat', async c => {
    const principal = resolvePrincipal(c, config);
    const limited = await checkRateLimit(c, services, principal);
    if (limited) return limited;

    const parsed = chatRequestSchema.safeParse(
      await c.req.json().catch(() => undefined),
    );
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    const messages = await validateAgentMessages(parsed.data.messages);
    if (!messages.success) return c.json({ error: 'invalid_messages' }, 400);

    const { id: threadId } = parsed.data;
    if (!(await services.store.getThread(threadId, principal))) {
      await services.store.createThread(threadId, principal);
    }
    const runId = `run_${crypto.randomUUID()}`;
    await services.store.createRun({
      runId,
      threadId,
      ownerId: principal.userId,
      status: 'running',
      tier: 'fast',
    });

    const stream = services.runtime.stream({
      threadId,
      runId,
      principal,
      messages: messages.data,
    });
    // Keep generating after the client disconnects: one branch is drained
    // independently, the other is returned to the caller.
    const [clientBranch, drainBranch] = stream.tee();
    void (async () => {
      const reader = drainBranch.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } catch {
        // The runtime records errors in the stream; nothing else to do here.
      }
    })();

    return createUIMessageStreamResponse({
      stream: clientBranch as unknown as ReadableStream<UIMessageChunk>,
      headers: { 'x-run-id': runId, 'x-thread-id': threadId },
    });
  });

  app.get('/chat/:runId/stream', async c => {
    const principal = resolvePrincipal(c, config);
    const runId = c.req.param('runId');
    const run = await services.store.getRun(runId, principal);
    if (!run) return c.json({ error: 'run_not_found' }, 404);
    const from = Number(c.req.query('from') ?? '0');
    if (!Number.isSafeInteger(from) || from < 0) {
      return c.json({ error: 'invalid_cursor' }, 400);
    }
    const replay = ReadableStream.from(services.store.replay(runId, from));
    return createUIMessageStreamResponse({
      stream: replay as unknown as ReadableStream<UIMessageChunk>,
      headers: { 'x-run-id': runId },
    });
  });
}

export type ChatChunk = AgentUIMessageChunk;
