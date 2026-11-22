/** POST /chat and resumable GET /chat/:runId/stream. */
import { createUIMessageStreamResponse, type UIMessageChunk } from 'ai';
import { chatRequestSchema, validateAgentMessages } from '@agent-chat/contract';
import type { AgentUIMessage, AgentUIMessageChunk } from '@agent-chat/contract';
import {
  defaultDecision,
  ForbiddenError,
  NotFoundError,
} from '@agent-chat/agent-core';
import type { Hono } from 'hono';
import { checkRateLimit, resolvePrincipal } from '../http';
import type { AppEnv } from '../http';
import type { ServerConfig } from '../config';
import type { Services } from '../services';

const MAX_BODY_BYTES = 256 * 1024;

function messageText(message: AgentUIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map(part => part.text)
    .join('');
}

/**
 * The client may send the visible thread, but the server accepts exactly one
 * freshly appended user message. Stored turns must match byte-for-byte and no
 * extra messages (including fake assistant turns) are allowed after them.
 */
function appendNewMessages(
  stored: AgentUIMessage[],
  client: AgentUIMessage[],
): AgentUIMessage[] | undefined {
  if (client.length !== stored.length + 1) return undefined;
  const appended = client[stored.length]!;
  if (appended.role !== 'user') return undefined;
  for (let i = 0; i < stored.length; i++) {
    if (
      stored[i]!.id !== client[i]!.id ||
      stored[i]!.role !== client[i]!.role ||
      messageText(stored[i]!) !== messageText(client[i]!)
    ) {
      return undefined;
    }
  }
  return [appended];
}

function isForbidden(error: unknown): boolean {
  return error instanceof ForbiddenError || error instanceof NotFoundError;
}

export function mountChatRoutes(
  app: Hono<AppEnv>,
  config: ServerConfig,
  services: Services,
) {
  app.post('/chat', async c => {
    const principal = resolvePrincipal(c, config);
    const limited = await checkRateLimit(c, services, principal);
    if (limited) return limited;

    const declared = Number(c.req.header('content-length') ?? '0');
    if (declared > MAX_BODY_BYTES) {
      return c.json({ error: 'request_too_large' }, 413);
    }
    const raw = await c.req.text().catch(() => '');
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      return c.json({ error: 'request_too_large' }, 413);
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      return c.json({ error: 'invalid_request' }, 400);
    }
    const parsed = chatRequestSchema.safeParse(parsedBody);
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
    const messages = await validateAgentMessages(parsed.data.messages);
    if (!messages.success) return c.json({ error: 'invalid_messages' }, 400);

    const { id: threadId } = parsed.data;
    let stored: AgentUIMessage[];
    try {
      if (!(await services.store.getThread(threadId, principal))) {
        await services.store.createThread(threadId, principal);
      }
      stored = await services.store.loadThread(threadId, principal);
    } catch (error) {
      if (isForbidden(error)) return c.json({ error: 'thread_not_found' }, 404);
      throw error;
    }
    const appended = appendNewMessages(stored, messages.data);
    if (!appended) return c.json({ error: 'invalid_history' }, 400);
    const history = [...stored, ...appended];
    const decision = defaultDecision(history);
    const runId = `run_${crypto.randomUUID()}`;
    await services.store.createRun({
      runId,
      threadId,
      ownerId: principal.userId,
      status: 'running',
      tier: decision.tier,
    });

    const stream = services.runtime.stream({
      threadId,
      runId,
      principal,
      messages: history,
      decision,
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
    let run;
    try {
      run = await services.store.getRun(runId, principal);
    } catch (error) {
      if (isForbidden(error)) return c.json({ error: 'run_not_found' }, 404);
      throw error;
    }
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
