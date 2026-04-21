import { describe, expect, it, vi } from 'vitest';
import { SocketChatAdapter } from '../SocketChatAdapter';
import type { SocketClient } from '../socketClient';
import type {
  HandoffEvent,
  ServerToClientEvents,
  StreamChunkEvent,
  StreamCompleteEvent,
  StreamStartEvent,
} from '../types';

type Handlers = Partial<{
  [K in keyof ServerToClientEvents]: ServerToClientEvents[K];
}>;

function makeFakeClient() {
  const handlers: Handlers = {};
  const emitted: Array<{ event: string; args: unknown[] }> = [];

  const client: Partial<SocketClient> = {
    on: ((event: keyof ServerToClientEvents, listener: ServerToClientEvents[typeof event]) => {
      (handlers as Record<string, unknown>)[event as string] = listener;
      return () => {
        delete (handlers as Record<string, unknown>)[event as string];
      };
    }) as SocketClient['on'],
    emit: ((event: string, ...args: unknown[]) => {
      emitted.push({ event, args });
    }) as SocketClient['emit'],
  };

  return {
    client: client as SocketClient,
    fire<K extends keyof Handlers>(event: K, payload: Parameters<NonNullable<Handlers[K]>>[0]) {
      const h = handlers[event] as ((p: unknown) => void) | undefined;
      h?.(payload);
    },
    emitted,
  };
}

describe('SocketChatAdapter', () => {
  const conversationId = 'conv-1';
  const baseMessage = {
    id: 'm1',
    role: 'user' as const,
    content: [{ type: 'text' as const, text: 'hello' }],
  };

  it('streams chunks and resolves on stream_complete with metadata', async () => {
    const { client, fire } = makeFakeClient();
    const adapter = new SocketChatAdapter({ conversationId, client });
    const ac = new AbortController();

    const runP = adapter.run({
      messages: [baseMessage as never],
      abortSignal: ac.signal,
      runConfig: {},
      config: {} as never,
      context: {} as never,
      unstable_getMessage: () => baseMessage as never,
    });

    fire('stream_start', { messageId: 'a1', conversationId } satisfies StreamStartEvent);
    fire('stream_chunk', {
      id: 'a1',
      messageId: 'a1',
      conversationId,
      content: 'hi',
      isComplete: false,
    } satisfies StreamChunkEvent);
    fire('stream_chunk', {
      id: 'a1',
      messageId: 'a1',
      conversationId,
      content: 'hi there',
      isComplete: false,
    } satisfies StreamChunkEvent);
    fire('stream_complete', {
      messageId: 'a1',
      conversationId,
      conversation: { id: conversationId, messages: [] },
      agentUsed: 'general',
      confidence: 0.9,
      attachments: [],
    } satisfies StreamCompleteEvent);

    const result = await runP;
    expect(result.status).toEqual({ type: 'complete', reason: 'stop' });
    expect(result.content?.[0]).toEqual({ type: 'text', text: 'hi there' });
    expect(result.metadata?.custom).toMatchObject({ agentUsed: 'general', confidence: 0.9 });
  });

  it('captures handoff metadata when a handoff_event arrives before complete', async () => {
    const { client, fire } = makeFakeClient();
    const adapter = new SocketChatAdapter({ conversationId, client });
    const ac = new AbortController();

    const runP = adapter.run({
      messages: [baseMessage as never],
      abortSignal: ac.signal,
      runConfig: {},
      config: {} as never,
      context: {} as never,
      unstable_getMessage: () => baseMessage as never,
    });

    fire('handoff_event', {
      conversationId,
      messageId: 'a1',
      fromAgent: 'general',
      toAgent: 'youtube_guru',
      reason: 'intent match',
    } satisfies HandoffEvent);
    fire('stream_start', { messageId: 'a1', conversationId });
    fire('stream_chunk', { id: 'a1', messageId: 'a1', conversationId, content: 'x', isComplete: false });
    fire('stream_complete', {
      messageId: 'a1',
      conversationId,
      conversation: { id: conversationId, messages: [] },
      agentUsed: 'youtube_guru',
      confidence: 0.8,
    });

    const result = await runP;
    expect((result.metadata?.custom as { handoff?: HandoffEvent }).handoff?.toAgent).toBe('youtube_guru');
  });

  it('yields incomplete on stream_error', async () => {
    const { client, fire } = makeFakeClient();
    const adapter = new SocketChatAdapter({ conversationId, client });
    const ac = new AbortController();
    const runP = adapter.run({
      messages: [baseMessage as never],
      abortSignal: ac.signal,
      runConfig: {},
      config: {} as never,
      context: {} as never,
      unstable_getMessage: () => baseMessage as never,
    });
    fire('stream_error', { conversationId, message: 'upstream timeout', code: 'UPSTREAM_TIMEOUT' });
    const r = await runP;
    expect(r.status).toMatchObject({ type: 'incomplete', reason: 'error' });
  });

  it('emits cancel_stream and resolves cancelled on abort', async () => {
    const { client, emitted } = makeFakeClient();
    const adapter = new SocketChatAdapter({ conversationId, client });
    const ac = new AbortController();
    const runP = adapter.run({
      messages: [baseMessage as never],
      abortSignal: ac.signal,
      runConfig: {},
      config: {} as never,
      context: {} as never,
      unstable_getMessage: () => baseMessage as never,
    });
    ac.abort();
    const r = await runP;
    expect(r.status).toMatchObject({ type: 'incomplete', reason: 'cancelled' });
    expect(emitted.find((e) => e.event === 'cancel_stream')).toBeDefined();
  });

  it('ignores events for other conversations', async () => {
    const { client, fire } = makeFakeClient();
    const adapter = new SocketChatAdapter({ conversationId, client });
    const ac = new AbortController();
    const runP = adapter.run({
      messages: [baseMessage as never],
      abortSignal: ac.signal,
      runConfig: {},
      config: {} as never,
      context: {} as never,
      unstable_getMessage: () => baseMessage as never,
    });

    fire('stream_chunk', {
      id: 'x',
      messageId: 'x',
      conversationId: 'other-convo',
      content: 'noise',
      isComplete: false,
    });
    fire('stream_start', { messageId: 'a1', conversationId });
    fire('stream_chunk', { id: 'a1', messageId: 'a1', conversationId, content: 'real', isComplete: false });
    fire('stream_complete', {
      messageId: 'a1',
      conversationId,
      conversation: { id: conversationId, messages: [] },
    });

    const r = await runP;
    expect(r.content?.[0]).toEqual({ type: 'text', text: 'real' });
    // Ensure dependencies are used to silence unused-import warnings in strict mode
    const noop: ServerToClientEvents['stream_start'] = () => undefined;
    expect(typeof noop).toBe('function');
    vi.restoreAllMocks();
  });
});
