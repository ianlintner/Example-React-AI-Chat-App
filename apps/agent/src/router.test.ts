import type { JevClient, JevDecision } from '@agent-chat/agent-core';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import { loadServerConfig } from './config';
import { routerRegistry } from './router-obs';
import { createServices } from './services';
import { AUTH_HEADERS, chatBody, sseEvents, TEST_CONFIG } from './test-helpers';

const env = {
  SESSION_SECRET: 'test-secret-at-least-32-characters-long',
  LLM_PROVIDER: 'mock',
  ROUTER_MODE: 'shadow',
  JEV_API_KEY: 'test-only-key',
  ROUTER_SHADOW_SAMPLE: '1',
};

function decision(): JevDecision {
  const choice = (value: string) => ({
    choice: value,
    confidence: 0.9,
    margin: 0.8,
  });
  return {
    skill: choice('code'),
    tier: choice('deep'),
    research: choice('no'),
    plan: choice('no'),
    model: 'jev-test',
  };
}

describe('routing metrics and data part', () => {
  it('exposes router counters/histograms on /metrics after a shadow chat', async () => {
    const logged: unknown[] = [];
    const config = loadServerConfig(env);
    const jev: JevClient = { classify: vi.fn(async () => decision()) };
    const services = await createServices(config, env, {
      jev,
      sink: {
        async log(row) {
          logged.push(row);
        },
      },
    });
    const app = createApp(TEST_CONFIG, services);

    const res = await app.request('/chat', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: chatBody('thr_metrics', 'fix this TypeScript bug'),
    });
    expect(res.status).toBe(200);
    const events = await sseEvents(res);
    const routePart = events.find(
      e =>
        typeof e === 'object' &&
        e !== null &&
        (e as { type?: string }).type === 'data-route-decision',
    ) as
      | {
          type: 'data-route-decision';
          data: { skill: string; mode: string; source: string };
        }
      | undefined;
    // Shadow emits the dispatched legacy route, never the upgraded keyword tier.
    expect(routePart?.data.skill).toBe('general');
    expect(routePart?.data.mode).toBe('shadow');
    expect(logged).toHaveLength(1);

    const metrics = await app.request('/metrics');
    expect(metrics.status).toBe(200);
    const text = await metrics.text();
    expect(text).toContain('route_decisions_total');
    expect(text).toContain('route_decision_margin');
    expect(text).toContain('route_decision_latency_ms');
    expect(text).toContain('route_decision_agreement_total');
    expect(routerRegistry.contentType).toContain('text/plain');
    await services.close();
  });
});
