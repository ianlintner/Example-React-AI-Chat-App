/**
 * New-stack Prometheus metrics reusing legacy names (card 10) so existing
 * Grafana queries and operator muscle memory keep working after card 12
 * deletes backend/. Collectors are created once per Registry; labels are
 * bounded and never carry user content, model ids or secrets.
 */
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

/** Matches the legacy latency buckets used by backend/src/metrics. */
export const LATENCY_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

export interface AgentMetrics {
  httpRequests: Counter<string>;
  httpDuration: Histogram<string>;
  activeRequests: Gauge<string>;
  chatMessages: Counter<string>;
  agentResponseTime: Histogram<string>;
  llmRequests: Counter<string>;
  llmDuration: Histogram<string>;
  llmTokens: Counter<string>;
  llmTimeToFirstToken: Histogram<string>;
  agentHandoffs: Counter<string>;
  validationChecks: Counter<string>;
  validationScores: Histogram<string>;
  backendErrors: Counter<string>;
}

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
  labelNames: string[],
): Histogram<string> {
  const existing = registry.getSingleMetric(name);
  return (
    (existing as Histogram<string> | undefined) ??
    new Histogram({
      name,
      help,
      labelNames,
      buckets: LATENCY_BUCKETS,
      registers: [registry],
    })
  );
}

/** Idempotent: safe to call from every createApp in tests/dev. */
export function createAgentMetrics(registry: Registry): AgentMetrics {
  return {
    httpRequests: counter(
      registry,
      'http_server_requests_total',
      'Total HTTP server requests.',
      [
        'service',
        'http_method',
        'http_route',
        'http_status_code',
        'status_class',
      ],
    ),
    httpDuration: histogram(
      registry,
      'http_server_request_duration_seconds',
      'HTTP server request duration in seconds.',
      [
        'service',
        'http_method',
        'http_route',
        'http_status_code',
        'status_class',
      ],
    ),
    activeRequests:
      (registry.getSingleMetric('http_server_active_requests') as
        | Gauge<string>
        | undefined) ??
      new Gauge({
        name: 'http_server_active_requests',
        help: 'In-flight HTTP server requests.',
        labelNames: ['service', 'http_method'],
        registers: [registry],
      }),
    chatMessages: counter(
      registry,
      'chat_messages_total',
      'Chat messages processed.',
      ['service', 'tier', 'direction'],
    ),
    agentResponseTime: histogram(
      registry,
      'agent_response_time_seconds',
      'End-to-end agent response time.',
      ['service', 'skill', 'tier'],
    ),
    llmRequests: counter(
      registry,
      'llm_requests_total',
      'LLM gateway requests by env-mapped route.',
      ['service', 'route', 'operation', 'status'],
    ),
    llmDuration: histogram(
      registry,
      'llm_request_duration_seconds',
      'LLM gateway request duration.',
      ['service', 'route', 'operation'],
    ),
    llmTokens: counter(
      registry,
      'llm_tokens_total',
      'LLM tokens by env-mapped route and direction.',
      ['service', 'route', 'direction'],
    ),
    llmTimeToFirstToken: histogram(
      registry,
      'llm_time_to_first_token_seconds',
      'Time to first streamed token.',
      ['service', 'route'],
    ),
    agentHandoffs: counter(
      registry,
      'agent_handoffs_total',
      'Skill/tool handoffs during agent turns.',
      ['service', 'from', 'to'],
    ),
    validationChecks: counter(
      registry,
      'validation_checks_total',
      'Quality/injection checks performed.',
      ['service', 'check', 'result'],
    ),
    validationScores: histogram(
      registry,
      'validation_scores',
      'Golden trajectory and injection scores.',
      ['service', 'suite'],
    ),
    backendErrors: counter(
      registry,
      'backend_errors_total',
      'Agent service errors by class.',
      ['service', 'error_type'],
    ),
  };
}
