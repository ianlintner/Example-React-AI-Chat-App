import { describe, expect, it } from 'vitest';
import { parseSseFrame, sseChunks, streamChat } from '../src/stream';

function sse(chunks: unknown[]): ReadableStream<Uint8Array> {
  const text =
    chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join('') +
    'data: [DONE]\n\n';
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe('SSE stream parsing', () => {
  it('parses data frames on the contract chunk shape', () => {
    const chunks = parseSseFrame(
      'data: {"type":"text-delta","id":"t1","delta":"Hi"}\n\n' +
        'data: [DONE]\n\n',
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ type: 'text-delta', delta: 'Hi' });
  });

  it('yields chunks across split frames', async () => {
    const out = [];
    for await (const chunk of sseChunks(
      sse([
        { type: 'start', messageId: 'm1' },
        { type: 'text-delta', id: 't1', delta: 'Hello' },
        { type: 'finish', finishReason: 'stop' },
      ]),
    )) {
      out.push(chunk);
    }
    expect(out.map(c => c.type)).toEqual(['start', 'text-delta', 'finish']);
  });

  it('delivers only text deltas to the caller', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        sse([
          { type: 'start', messageId: 'm1' },
          { type: 'data-route-decision', id: 'r1', data: { tier: 'fast' } },
          { type: 'text-delta', id: 't1', delta: 'Mock ' },
          { type: 'text-delta', id: 't1', delta: 'reply.' },
          { type: 'finish', finishReason: 'stop' },
        ]),
        { status: 200, headers: { 'x-run-id': 'run_1' } },
      )) as typeof fetch;
    const deltas: string[] = [];
    const decisions: string[] = [];
    try {
      await streamChat(
        'http://localhost:8787',
        'thr_test',
        [
          {
            id: 'msg_u1',
            role: 'user',
            parts: [{ type: 'text', text: 'Hello there' }],
          },
        ],
        new AbortController().signal,
        { onDelta: d => deltas.push(d), onDecision: d => decisions.push(d) },
      );
    } finally {
      globalThis.fetch = original;
    }
    expect(deltas.join('')).toBe('Mock reply.');
    expect(decisions).toEqual(['route: fast']);
  });

  it('calls onDone only after the stream finishes', async () => {
    const original = globalThis.fetch;
    let release!: () => void;
    const gated = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(
          enc.encode('data: {"type":"text-delta","id":"t1","delta":"Hi"}\n\n'),
        );
        release = () => {
          controller.enqueue(
            enc.encode('data: {"type":"finish","finishReason":"stop"}\n\n'),
          );
          controller.close();
        };
      },
    });
    globalThis.fetch = (async () =>
      new Response(gated, {
        status: 200,
        headers: { 'x-run-id': 'run_gated' },
      })) as typeof fetch;
    const order: string[] = [];
    try {
      const pending = streamChat(
        'http://x',
        'thr',
        [],
        new AbortController().signal,
        {
          onDelta: () => order.push('delta'),
          onDone: runId => order.push(`done:${runId}`),
        },
      );
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(order).toEqual(['delta']);
      release();
      await pending;
    } finally {
      globalThis.fetch = original;
    }
    expect(order).toEqual(['delta', 'done:run_gated']);
  });

  it('reports HTTP failures without throwing', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('no', { status: 500 })) as typeof fetch;
    let error = '';
    try {
      await streamChat('http://x', 'thr', [], new AbortController().signal, {
        onDelta: () => {},
        onError: m => (error = m),
      });
    } finally {
      globalThis.fetch = original;
    }
    expect(error).toMatch(/500/);
  });
});
