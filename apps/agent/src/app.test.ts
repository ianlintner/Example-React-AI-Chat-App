import { CONTRACT_VERSION, healthResponseSchema } from '@agent-chat/contract';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { loadServerConfig } from './config';

describe('agent app', () => {
  const app = createApp(loadServerConfig({}));

  it('GET /healthz returns ok with the contract version', async () => {
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body).toEqual({
      status: 'ok',
      service: 'agent',
      contractVersion: CONTRACT_VERSION,
    });
  });

  it('sets security headers and scoped CORS', async () => {
    const res = await app.request('/healthz', {
      headers: { origin: 'http://localhost:3000' },
    });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:3000',
    );
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('does not mount /api/inngest without dev mode or a signing key', async () => {
    const res = await app.request('/api/inngest');
    expect(res.status).toBe(404);
  });

  it('mounts /api/inngest in dev mode', async () => {
    const dev = createApp(loadServerConfig({ INNGEST_DEV: '1' }));
    const res = await dev.request('/api/inngest');
    expect(res.status).toBe(200);
  });
});

describe('loadServerConfig', () => {
  it('binds to loopback on 8787 by default', () => {
    const c = loadServerConfig({});
    expect(c.host).toBe('127.0.0.1');
    expect(c.port).toBe(8787);
    expect(c.inngest).toEqual({ enabled: false, dev: false });
  });

  it('rejects invalid ports', () => {
    expect(() => loadServerConfig({ AGENT_PORT: '70000' })).toThrow(
      /AGENT_PORT/,
    );
  });
});
