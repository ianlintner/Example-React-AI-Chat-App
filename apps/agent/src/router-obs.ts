/**
 * Prometheus instrumentation for routing. Metric names follow Prometheus
 * conventions; labels are bounded (skill/tier/source/mode). Collectors are
 * created once per registry so repeated service creation (tests, hot reload)
 * never throws on duplicate registration.
 */
import { Counter, Histogram, Registry } from 'prom-client';
import type { RouteDecision, Tier } from '@agent-chat/contract';
import type { RouteMetrics, RouterMode } from '@agent-chat/agent-core';

export interface RouterTelemetry {
  registry: Registry;
  metrics: RouteMetrics;
}

/** Shared registry so /metrics exposes the same collectors the router uses. */
export const routerRegistry = new Registry();

function counter(
  registry: Registry,
  name: string,
  help: string,
  labelNames: string[],
): Counter<string> {
  const existing = registry.getSingleMetric(name);
  return (
    (existing as Counter<string> | undefined) ??
    new Counter({ name, help, labelNames, registers: [registry] })
  );
}

function histogram(
  registry: Registry,
  name: string,
  help: string,
  buckets: number[],
): Histogram<string> {
  const existing = registry.getSingleMetric(name);
  return (
    (existing as Histogram<string> | undefined) ??
    new Histogram({ name, help, buckets, registers: [registry] })
  );
}

export function createRouterTelemetry(
  registry: Registry = routerRegistry,
): RouterTelemetry {
  const decisions = counter(
    registry,
    'route_decisions_total',
    'Routing decisions by source, mode, skill and tier.',
    ['source', 'mode', 'skill', 'tier'],
  );
  const margin = histogram(
    registry,
    'route_decision_margin',
    'Top-two probability gap of the routing decision.',
    [0.05, 0.1, 0.15, 0.25, 0.5, 0.75, 1],
  );
  const latency = histogram(
    registry,
    'route_decision_latency_ms',
    'Time spent making a routing decision.',
    [5, 10, 25, 50, 100, 250, 500, 1000],
  );
  const agreement = counter(
    registry,
    'route_decision_agreement_total',
    'Whether the proposed decision agreed with the baseline.',
    ['agreed'],
  );
  const fallbacks = counter(
    registry,
    'route_fallback_total',
    'Fallbacks from the typed router.',
    ['reason'],
  );
  const errors = counter(
    registry,
    'route_errors_total',
    'Router failures (Jev, LLM fallback or sink).',
    ['reason'],
  );

  return {
    registry,
    metrics: {
      decisions(
        labels: {
          source: RouteDecision['source'];
          mode: RouterMode;
          skill: string;
          tier: Tier;
        },
        latencyMs: number,
        gap: number,
      ) {
        decisions.inc(labels);
        latency.observe(latencyMs);
        margin.observe(gap);
      },
      agreement(agreed: boolean) {
        agreement.inc({ agreed: String(agreed) });
      },
      fallback(reason: string) {
        fallbacks.inc({ reason });
      },
      errors(reason: string) {
        errors.inc({ reason });
      },
    },
  };
}
