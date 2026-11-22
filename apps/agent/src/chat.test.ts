import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import type { StoreData } from '@agent-chat/agent-core';
import {
  AUTH_HEADERS,
  chatBody,
  sseEvents,
  TEST_CONFIG,
  TEST_PRINCIPAL,
  testServices,
} from './test-helpers';

describe('POST /chat', () => {
  it('streams token-by-token text deltas from the mock model', async () => {
    const services = testServices(undefined, 'Alpha beta gamma.');
    const app = createApp(TEST_CONFIG, services);
    const res = await app.request('/chat', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: chatBody('thr_stream'),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-run-id')).toMatch(/^run_/);
    const events = await sseEvents(res);
    const deltas = events.filter(
      (e): e is { type: string; delta: string } =>
        typeof e === 'object' &&
        e !== null &&
        (e as { type?: string }).type === 'text-delta',
    );
    expect(deltas).toHaveLength(3);
    expect(deltas.map(d => d.delta).join('')).toBe('Alpha beta gamma.');
    expect(
      events.some(e => (e as { type?: string }).type === 'data-route-decision'),
    ).toBe(true);
    await services.close();
  });

  it('resumes a run after the client disconnects mid-stream', async () => {
    const services = testServices(undefined, 'One two three four.', 12);
    const app = createApp(TEST_CONFIG, services);
    const first = await app.request('/chat', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: chatBody('thr_resume'),
    });
    const runId = first.headers.get('x-run-id')!;
    const reader = first.body!.getReader();
    await reader.read(); // start + one delta
    await reader.cancel();

    // Give the detached generator time to finish; resume from cursor 1.
    await new Promise(resolve => setTimeout(resolve, 250));
    const replay = await app.request(`/chat/${runId}/stream?from=1`, {
      headers: { 'x-user-id': 'test-user' },
    });
    expect(replay.status).toBe(200);
    const events = await sseEvents(replay);
    const text = events
      .filter(
        (e): e is { type: string; delta: string } =>
          typeof e === 'object' &&
          e !== null &&
          (e as { type?: string }).type === 'text-delta',
      )
      .map(e => e.delta)
      .join('');
    // Client saw at least the first delta on the original stream; replay from 1
    // still contains the remainder of the completed run.
    expect(text.length).toBeGreaterThan(0);
    expect('One two three four.'.includes(text)).toBe(true);
    expect((await services.store.getRun(runId, TEST_PRINCIPAL))?.status).toBe(
      'completed',
    );
    await services.close();
  });

  it('keeps a thread and its messages across a server restart', async () => {
    const shared: StoreData = {
      threads: new Map(),
      messages: new Map(),
      runs: new Map(),
      chunks: new Map(),
      finished: new Set(),
    };
    const first = testServices(shared, 'Persisted answer.');
    const app1 = createApp(TEST_CONFIG, first);
    const posted = await app1.request('/chat', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: chatBody('thr_persist', 'remember me'),
    });
    await sseEvents(posted);
    await first.close();

    const second = testServices(shared, 'unused');
    const app2 = createApp(TEST_CONFIG, second);
    const principal = TEST_PRINCIPAL;
    const thread = await app2.request('/threads/thr_persist', {
      headers: { 'x-user-id': 'test-user' },
    });
    expect(thread.status).toBe(200);
    const body = (await thread.json()) as {
      messages: Array<{ parts: Array<{ type: string; text?: string }> }>;
    };
    expect(
      body.messages.map(m => m.parts.find(p => p.type === 'text')?.text),
    ).toContain('remember me');
    expect(
      body.messages.map(m => m.parts.find(p => p.type === 'text')?.text),
    ).toContain('Persisted answer.');
    expect(
      (await second.store.getRun(posted.headers.get('x-run-id')!, principal))
        ?.status,
    ).toBe('completed');
    await second.close();
  });

  it('returns 429 when the signed session exceeds its rate limit', async () => {
    const services = testServices(undefined, 'ok');
    const app = createApp(TEST_CONFIG, services);
    const request = () =>
      app.request('/chat', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: chatBody(`thr_limit_${Math.random().toString(36).slice(2)}`),
      });
    for (let i = 0; i < 11; i++) await request();
    const limited = await app.request('/chat', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: chatBody('thr_over_limit'),
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    await services.close();
  });

  it('rejects a request with an unknown data part', async () => {
    const services = testServices();
    const app = createApp(TEST_CONFIG, services);
    const res = await app.request('/chat', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        id: 'thr_bad',
        trigger: 'submit-message',
        messages: [
          {
            id: 'u1',
            role: 'user',
            parts: [{ type: 'data-admin', data: { ok: true } }],
          },
        ],
      }),
    });
    expect(res.status).toBe(400);
    await services.close();
  });
});
