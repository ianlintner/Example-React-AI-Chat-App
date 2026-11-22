/**
 * Minimal client for the frozen AI SDK UI message stream (`POST /chat`).
 * We parse the contract's `data: {json}` SSE lines directly instead of
 * shipping React + assistant-ui in the embed bundle; the wire format is the
 * same one `packages/contract` defines for the web app.
 */
import type { AgentUIMessageChunk } from '@agent-chat/contract';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
}

export interface StreamCallbacks {
  onStart?(messageId: string): void;
  onDelta(text: string): void;
  onDecision?(label: string): void;
  onDone?(runId?: string): void;
  onError?(message: string): void;
}

/** Parse one SSE frame body (`data: <json>` lines) into contract chunks. */
export function parseSseFrame(frame: string): AgentUIMessageChunk[] {
  const chunks: AgentUIMessageChunk[] = [];
  for (const line of frame.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') continue;
    chunks.push(JSON.parse(payload) as AgentUIMessageChunk);
  }
  return chunks;
}

/** Split a raw SSE byte stream on blank lines into frames, then chunks. */
export async function* sseChunks(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentUIMessageChunk> {
  const decoder = new TextDecoder();
  let buffer = '';
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        yield* parseSseFrame(frame);
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (buffer.trim()) yield* parseSseFrame(buffer);
}

function decisionLabel(chunk: AgentUIMessageChunk): string | undefined {
  if (chunk.type !== 'data-route-decision') return undefined;
  const data = (chunk as { data?: Record<string, unknown> }).data;
  if (!data) return undefined;
  const tier = typeof data.tier === 'string' ? data.tier : undefined;
  return tier ? `route: ${tier}` : undefined;
}

/**
 * POST a user turn and stream the reply. `apiUrl` is the agent origin; the
 * request body follows `chatRequestSchema` (DefaultChatTransport shape).
 */
export async function streamChat(
  apiUrl: string,
  threadId: string,
  history: ChatMessage[],
  signal: AbortSignal,
  callbacks: StreamCallbacks,
): Promise<void> {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'x-vercel-ai-ui-message-stream': 'v1',
    },
    credentials: 'include',
    signal,
    body: JSON.stringify({
      id: threadId,
      messages: history,
      trigger: 'submit-message',
    }),
  });
  if (!response.ok || !response.body) {
    callbacks.onError?.(`Agent request failed (HTTP ${response.status}).`);
    return;
  }
  try {
    let done = false;
    for await (const chunk of sseChunks(response.body)) {
      if (chunk.type === 'start' && typeof chunk.messageId === 'string') {
        callbacks.onStart?.(chunk.messageId);
      }
      const label = decisionLabel(chunk);
      if (label) callbacks.onDecision?.(label);
      if (
        chunk.type === 'text-delta' &&
        typeof (chunk as { delta?: string }).delta === 'string'
      ) {
        callbacks.onDelta((chunk as { delta: string }).delta);
      }
      if (chunk.type === 'finish' || chunk.type === 'error') done = true;
    }
    if (!done) {
      callbacks.onError?.('Stream ended before the reply finished.');
      return;
    }
    callbacks.onDone?.(response.headers.get('x-run-id') ?? undefined);
  } catch (err) {
    if (!signal.aborted) {
      callbacks.onError?.(
        err instanceof Error ? err.message : 'Stream interrupted.',
      );
    }
  }
}
