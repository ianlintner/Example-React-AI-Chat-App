import type { AgentUIMessage } from '@agent-chat/contract';
import { describe, expect, it, vi } from 'vitest';
import { loadRouterConfig } from './config';
import type { FallbackDecision, LlmRouter } from './fallback';
import type { JevClient } from './jev';
import { createRouter, type RouterDeps } from './index';
import type { RouteLogRow, RouteMetrics, RouteSink } from './observability';

const principal = {
  userId: 'user_test',
  kind: 'user' as const,
  tier: 'free' as const,
};
const context = { threadId: 'thr_test', runId: 'run_test' };
const messages = (text: string): AgentUIMessage[] => [
  { id: 'u1', role: 'user', parts: [{ type: 'text', text }] },
];

function jevDecision() {
  const choice = (value: string) => ({
    choice: value,
    confidence: 0.9,
    margin: 0.8,
  });
  return {
    skill: choice('general'),
    tier: choice('fast'),
    research: choice('no'),
    plan: choice('no'),
    model: 'jev-test',
  };
}

function fakeJev(): JevClient {
  return {
    classify: vi.fn(async () => jevDecision()),
  };
}

function recording(overrides: Partial<RouterDeps> = {}) {
  const rows: RouteLogRow[] = [];
  const events: string[] = [];
  const sink: RouteSink = {
    async log(row) {
      rows.push(row);
    },
  };
  const metrics: RouteMetrics = {
    decisions: (_labels, latencyMs, margin) =>
      events.push(`decision:${latencyMs}:${margin}`),
    agreement: agreed => events.push(`agreement:${agreed}`),
    fallback: reason => events.push(`fallback:${reason}`),
    errors: reason => events.push(`error:${reason}`),
  };
  const router = createRouter({
    config: loadRouterConfig({
      ROUTER_MODE: 'shadow',
      JEV_API_KEY: 'k',
      ROUTER_SHADOW_SAMPLE: '1',
    }),
    jev: fakeJev(),
    sink,
    metrics,
    ...overrides,
  });
  return { router, rows, events };
}

describe('review fixes: bounded, private, cost-neutral routing', () => {
  const fallbackStub: FallbackDecision = {
    skill: 'general',
    tier: 'fast',
    needsResearch: false,
    needsPlan: false,
    rationale: 'stub',
  };

  it('off dispatches exactly as before the router (general/fast, no keyword upgrades)', async () => {
    const jev = fakeJev();
    const { router, rows } = recording({
      config: loadRouterConfig({ ROUTER_MODE: 'off' }),
      jev,
    });
    const short = await router.decide({
      principal,
      messages: messages('why does this code compare latest sources and plan?'),
      context,
    });
    expect(short.skill).toBe('general');
    expect(short.tier).toBe('fast');
    expect(short.needsResearch).toBe(false);
    expect(short.needsPlan).toBe(false);
    expect(rows).toHaveLength(0);
    expect(jev.classify).not.toHaveBeenCalled();

    const long = await router.decide({
      principal,
      messages: messages('x'.repeat(801)),
      context,
    });
    expect(long.tier).toBe('deep');
    expect(long.skill).toBe('general');
  });

  it('aborts a hanging Jev call and falls back within the budget', async () => {
    const events: string[] = [];
    const hung: JevClient = {
      classify: ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    };
    const router = createRouter({
      config: loadRouterConfig({
        ROUTER_MODE: 'shadow',
        JEV_API_KEY: 'k',
        ROUTER_SHADOW_SAMPLE: '1',
        ROUTER_TIMEOUT_MS: '60',
      }),
      jev: hung,
      metrics: {
        decisions() {},
        agreement() {},
        fallback: reason => events.push(`fallback:${reason}`),
        errors: reason => events.push(`error:${reason}`),
      },
    });
    const started = Date.now();
    const decision = await router.decide({
      principal,
      messages: messages('hello'),
      context,
    });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(decision.skill).toBe('general');
    expect(events).toContain('error:router_timeout');
  });

  it('passes an aborted signal and redacted text to Jev', async () => {
    const seen: { text?: string; signal?: AbortSignal }[] = [];
    const jev: JevClient = {
      async classify(input) {
        seen.push(input);
        return jevDecision();
      },
    };
    const router = createRouter({
      config: loadRouterConfig({
        ROUTER_MODE: 'shadow',
        JEV_API_KEY: 'k',
        ROUTER_SHADOW_SAMPLE: '1',
      }),
      jev,
    });
    await router.decide({
      principal,
      messages: messages(
        'email me at alice@example.com via https://example.com/a?id=12345678',
      ),
      context,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.signal).toBeInstanceOf(AbortSignal);
    expect(seen[0]!.text).not.toContain('alice@example.com');
    expect(seen[0]!.text).not.toContain('https://example.com');
    expect(seen[0]!.text).toContain('[email]');
    expect(seen[0]!.text).toContain('[url]');
  });

  it('does not call a third party at sample rate 0', async () => {
    const jev = fakeJev();
    const llmRouter: LlmRouter = { decide: vi.fn(async () => fallbackStub) };
    const { router, rows, events } = recording({
      config: loadRouterConfig({
        ROUTER_MODE: 'shadow',
        JEV_API_KEY: 'k',
        ROUTER_SHADOW_SAMPLE: '0',
      }),
      jev,
      llmRouter,
    });
    const decision = await router.decide({
      principal,
      messages: messages('fix this TypeScript bug'),
      context,
    });
    expect(decision.skill).toBe('general');
    expect(decision.tier).toBe('fast');
    expect(jev.classify).not.toHaveBeenCalled();
    expect(llmRouter.decide).not.toHaveBeenCalled();
    expect(rows[0]!.source).toBe('default');
    expect(rows[0]!.comparison.skill).toBe('code');
    expect(events).toContain('fallback:sampled_out');
  });
});
