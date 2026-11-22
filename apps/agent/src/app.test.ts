import { CONTRACT_VERSION, healthResponseSchema } from '@agent-chat/contract';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { loadServerConfig } from './config';
import { createServices } from './services';

const testEnv = {
  SESSION_SECRET: 'test-secret-at-least-32-characters-long',
  LLM_PROVIDER: 'mock',
};

async function fixture(configOverrides: Record<string, string> = {}) {
  const config = loadServerConfig({ ...testEnv, ...configOverrides });
  const services = await createServices(config, testEnv);
  return { app: createApp(config, services), services, config };
}

describe('agent app', () => {
  it('GET /healthz returns ok with the contract version', async () => {
    const { app, services } = await fixture();
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body).toEqual({
      status: 'ok',
      service: 'agent',
      contractVersion: CONTRACT_VERSION,
    });
    await services.close();
  });

  it('sets security headers and scoped CORS', async () => {
    const { app, services } = await fixture();
    const res = await app.request('/healthz', {
      headers: { origin: 'http://localhost:3000' },
    });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:3000',
    );
    await services.close();
  });

  it('returns JSON 404 for unknown routes', async () => {
    const { app, services } = await fixture();
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    await services.close();
  });

  it('does not mount /api/inngest without dev mode or a signing key', async () => {
    const { app, services } = await fixture();
    const res = await app.request('/api/inngest');
    expect(res.status).toBe(404);
    await services.close();
  });

  it('mounts /api/inngest in dev mode', async () => {
    const { app, services } = await fixture({ INNGEST_DEV: '1' });
    const res = await app.request('/api/inngest');
    expect(res.status).toBe(200);
    await services.close();
  });
});

describe('loadServerConfig', () => {
  it('binds to loopback on 8787 by default', () => {
    const c = loadServerConfig(testEnv);
    expect(c.host).toBe('127.0.0.1');
    expect(c.port).toBe(8787);
    expect(c.inngest).toEqual({ enabled: false, dev: false });
  });

  it('rejects invalid ports', () => {
    expect(() => loadServerConfig({ ...testEnv, AGENT_PORT: '70000' })).toThrow(
      /AGENT_PORT/,
    );
  });

  it('fails closed without a session secret', () => {
    expect(() => loadServerConfig({ LLM_PROVIDER: 'mock' })).toThrow(
      /SESSION_SECRET/,
    );
  });
});
