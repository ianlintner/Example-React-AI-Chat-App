import type { AgentUIMessage, RouteDecision } from '@agent-chat/contract';
import { describe, expect, it, vi } from 'vitest';
import { classify } from './classify';
import { loadRouterConfig } from './config';
import { accuracyOf, GOLDEN_CASES, sameOutcome } from './golden';
import type { JevClient, JevDecision } from './jev';
import { ROUTER_SKILLS } from './jev';
import { createRouter, type RouterDeps } from './index';
import type { FallbackDecision, LlmRouter } from './fallback';
import type { RouteLogRow, RouteMetrics, RouteSink } from './observability';

const principal = {
  userId: 'user_test',
  kind: 'user' as const,
  tier: 'free' as const,
};
const context = { threadId: 'thr_test', runId: 'run_test' };
const messages = (text: string): AgentUIMessage[] => [
  {
    id: 'u1',
    role: 'user',
    parts: [{ type: 'text', text }],
  },
];

function jevDecision(overrides: Partial<JevDecision> = {}): JevDecision {
  const choice = (value: string, confidence = 0.9, margin = 0.8) => ({
    choice: value,
    confidence,
    margin,
  });
  return {
    skill: choice('code'),
    tier: choice('deep'),
    research: choice('no'),
    plan: choice('no'),
    model: 'jev-test',
    ...overrides,
  };
}

function fakeJev(decision: JevDecision = jevDecision()): JevClient {
  return { classify: vi.fn(async () => decision) };
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

describe('loadRouterConfig', () => {
  it('defaults to off and never invents an API key', () => {
    const c = loadRouterConfig({});
    expect(c.mode).toBe('off');
    expect(c.jevApiKey).toBeUndefined();
    expect(c.jevBaseUrl).toBe('https://api.typesafe.ai');
    expect(c.marginThreshold).toBe(0.15);
  });

  it('fails closed when shadow/live lacks a key', () => {
    expect(() => loadRouterConfig({ ROUTER_MODE: 'shadow' })).toThrow(
      /JEV_API_KEY/,
    );
    expect(() => loadRouterConfig({ ROUTER_MODE: 'live' })).toThrow(
      /JEV_API_KEY/,
    );
  });

  it('rejects a zero margin threshold when enabled', () => {
    expect(() =>
      loadRouterConfig({
        ROUTER_MODE: 'shadow',
        JEV_API_KEY: 'k',
        ROUTER_MARGIN_THRESHOLD: '0',
      }),
    ).toThrow(/ROUTER_MARGIN_THRESHOLD/);
  });

  it('does not echo the key in errors', () => {
    try {
      loadRouterConfig({
        ROUTER_MODE: 'live',
        JEV_API_KEY: 'super-secret-key',
        JEV_MODEL: 'bad model!',
      });
    } catch (error) {
      expect(String(error)).not.toContain('super-secret-key');
    }
  });
});

describe('createRouter modes', () => {
  it('off: baseline only, no Jev call, no log or metrics', async () => {
    const jev = fakeJev();
    const { router, rows, events } = recording({
      config: loadRouterConfig({ ROUTER_MODE: 'off' }),
      jev,
    });
    const decision = await router.decide({
      principal,
      messages: messages('fix this TypeScript bug'),
      context,
    });
    expect(jev.classify).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
    expect(events).toHaveLength(0);
    expect(decision.source).toBe('default');
    expect(decision.mode).toBe('shadow');
  });

  it('shadow: logs both decisions but dispatches the baseline', async () => {
    const { router, rows, events } = recording();
    const decision = await router.decide({
      principal,
      messages: messages('fix this TypeScript bug'),
      context,
    });
    expect(decision.skill).toBe('code');
    expect(decision.source).toBe('default');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.proposed.source).toBe('typed-router');
    expect(rows[0]!.baseline.source).toBe('default');
    expect(rows[0]!.mode).toBe('shadow');
    expect(rows[0]!.ownerId).toBe('user_test');
    expect(events.some(e => e.startsWith('decision:'))).toBe(true);
  });

  it('live: dispatches the typed decision', async () => {
    const { router, rows } = recording({
      config: loadRouterConfig({
        ROUTER_MODE: 'live',
        JEV_API_KEY: 'k',
      }),
    });
    const decision = await router.decide({
      principal,
      messages: messages('hello'),
      context,
    });
    expect(decision.skill).toBe('code');
    expect(decision.source).toBe('typed-router');
    expect(decision.mode).toBe('live');
    expect(rows[0]!.mode).toBe('live');
  });

  it('records agreement between proposed and baseline', async () => {
    const { router, rows, events } = recording();
    await router.decide({
      principal,
      messages: messages('fix this TypeScript bug'),
      context,
    });
    expect(rows[0]!.agreement).toBe(true);
    expect(events).toContain('agreement:true');
  });
});

describe('LLM fallback', () => {
  const fallback: FallbackDecision = {
    skill: 'deep-research',
    tier: 'research',
    needsResearch: true,
    needsPlan: false,
    rationale: 'The user asks for current, sourced comparisons.',
  };
  const llmRouter: LlmRouter = { decide: vi.fn(async () => fallback) };

  it('uses the LLM router when the Jev margin is below threshold', async () => {
    const decision = jevDecision({
      skill: {
        choice: 'code',
        confidence: 0.55,
        margin: 0.05,
      },
    });
    const { router, rows, events } = recording({
      jev: fakeJev(decision),
      llmRouter,
    });
    const result = await router.decide({
      principal,
      messages: messages('compare vendors'),
      context,
    });
    expect(result.skill).toBe(rows[0]!.baseline.skill);
    expect(result.source).toBe('default');
    expect(rows[0]!.source).toBe('llm-fallback');
    expect(rows[0]!.proposed.skill).toBe('deep-research');
    expect(events).toContain('fallback:low_margin');
    expect(llmRouter.decide).toHaveBeenCalled();
  });

  it('uses the LLM router when Jev throws', async () => {
    const jev: JevClient = {
      classify: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    const { router, rows, events } = recording({ jev, llmRouter });
    const result = await router.decide({
      principal,
      messages: messages('compare vendors'),
      context,
    });
    expect(result.skill).toBe(rows[0]!.baseline.skill);
    expect(rows[0]!.source).toBe('llm-fallback');
    expect(events).toContain('error:jev_unavailable');
    expect(events).toContain('fallback:jev_unavailable');
  });

  it('falls back to the deterministic default if both routers fail', async () => {
    const jev: JevClient = {
      classify: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    const broken: LlmRouter = {
      decide: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    const { router, rows, events } = recording({
      jev,
      llmRouter: broken,
    });
    const result = await router.decide({
      principal,
      messages: messages('hello'),
      context,
    });
    expect(result.source).toBe('default');
    expect(rows[0]!.source).toBe('default');
    expect(events).toContain('error:llm_fallback_failed');
  });
});

describe('shadow sink resilience', () => {
  it('does not break dispatch when Postgres logging fails', async () => {
    const sink: RouteSink = {
      async log() {
        throw new Error('db down');
      },
    };
    const events: string[] = [];
    const router = createRouter({
      config: loadRouterConfig({
        ROUTER_MODE: 'shadow',
        JEV_API_KEY: 'k',
        ROUTER_SHADOW_SAMPLE: '1',
      }),
      jev: fakeJev(),
      sink,
      metrics: {
        decisions() {},
        agreement() {},
        fallback() {},
        errors: reason => events.push(`error:${reason}`),
      },
    });
    const decision = await router.decide({
      principal,
      messages: messages('hello'),
      context,
    });
    expect(decision.skill).toBe('general');
    expect(events).toContain('error:sink_failed');
  });
});

describe('golden routing cases', () => {
  it('has at least 20 labelled cases', () => {
    expect(GOLDEN_CASES.length).toBeGreaterThanOrEqual(20);
  });

  it('reports deterministic baseline accuracy', () => {
    const report = accuracyOf(classify);
    console.info(
      `[golden] baseline accuracy ${(report.accuracy * 100).toFixed(1)}% ` +
        `(${report.correct}/${report.total}); missed: ${report.missed.join(', ')}`,
    );
    expect(report.total).toBe(GOLDEN_CASES.length);
    expect(report.accuracy).toBeGreaterThanOrEqual(0.8);
  });

  it('uses the shared outcome comparator', () => {
    expect(sameOutcome(classify('hello'), classify('hello'))).toBe(true);
  });

  it('routes a research request to the research tier', () => {
    const outcome: RouteDecision = {
      ...classify('Find sources comparing vector databases'),
      decisionId: 'route_test',
      confidence: 1,
      margin: 1,
      source: 'default',
      mode: 'shadow',
      rationale: 'test',
    };
    expect(outcome.tier).toBe('research');
    expect(outcome.needsResearch).toBe(true);
  });
});

describe('skill names', () => {
  it('matches the contract union', () => {
    expect(Object.keys(ROUTER_SKILLS)).toEqual([
      'general',
      'deep-research',
      'planning',
      'creative',
      'code',
    ]);
  });
});
