/**
 * Prometheus metrics registry for the backend.
 *
 * Follows the paved-path spec in `~/.claude/skills/prometheus-metrics/SKILL.md`:
 *   - OTel semantic conventions (`http_server_*`, `http_client_*`, `db_client_*`,
 *     `worker_*`, `websocket_*`, `llm_*`, `agent_*`).
 *   - Curated latency buckets (no defaults in production).
 *   - Templated route labels (no raw paths).
 *   - Label whitelists at emit time — unknown values collapse to `"other"`
 *     (cardinality guard).
 *   - `safeEmit()` wraps every emitter; metrics failures never throw.
 */
import type { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';

const SERVICE_LABEL = 'backend';
const OTHER = 'other';

// ─────────────────────────────────────────────────────────────────────────────
// Buckets (per SKILL.md §3)
// ─────────────────────────────────────────────────────────────────────────────
const LATENCY_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;
/** HTTP server — extended to 30s to cover slow streaming endpoints. */
const HTTP_SERVER_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30,
] as const;
/** LLM — long tail for provider streaming. */
const LLM_BUCKETS = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120] as const;
/** Time-to-first-token — short tail only; > 10s is effectively dead. */
const TTFT_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;
/** Quality scores (0–1). Retained for backward compat with validation dashboards. */
const SCORE_BUCKETS = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
] as const;
/** Response length in characters. */
const CHAR_BUCKETS = [50, 100, 200, 500, 1000, 2000, 5000, 10000] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Label whitelists — cardinality guard
// ─────────────────────────────────────────────────────────────────────────────
const WS_EVENTS = new Set<string>([
  'stream_chat',
  'cancel_stream',
  'typing_start',
  'typing_stop',
  'message_read',
  'join_conversation',
  'leave_conversation',
  'stream_start',
  'stream_chunk',
  'stream_complete',
  'stream_error',
  'new_message',
  'proactive_message',
  'proactive_error',
  'agent_status_update',
  'handoff_event',
  'attachment',
  'user_typing',
  'message_status',
  'connect',
  'disconnect',
]);

const LLM_PROVIDERS = new Set<string>(['anthropic', 'openai', 'foundry']);
const DB_OPS = new Set<string>([
  'get',
  'set',
  'del',
  'expire',
  'exists',
  'hget',
  'hset',
  'hgetall',
  'hdel',
  'incr',
  'decr',
  'lpush',
  'rpush',
  'lpop',
  'rpop',
  'lrange',
  'publish',
  'subscribe',
  'ping',
  'scan',
  'keys',
]);
const PEER_SERVICES = new Set<string>([
  'tenor',
  'giphy',
  'youtube',
  'tts',
  'anthropic',
  'openai',
  'foundry',
  'azure',
]);
const PROACTIVE_ACTION_TYPES = new Set<string>([
  'youtube_recommendation',
  'gif_recommendation',
  'audio_recommendation',
  'entertainment',
  'joke',
  'trivia',
  'story',
  'game',
  'other',
]);
const MEMORY_OPS = new Set<string>([
  'read',
  'write',
  'delete',
  'list',
  'clear',
]);
const ERROR_KINDS = new Set<string>([
  'validation',
  'upstream',
  'internal',
  'auth',
  'ratelimit',
]);

function whitelist(value: unknown, set: Set<string>): string {
  const v = typeof value === 'string' ? value.toLowerCase() : '';
  return set.has(v) ? v : OTHER;
}

function statusClass(code: number | string): string {
  const n = typeof code === 'number' ? code : parseInt(String(code), 10);
  if (!Number.isFinite(n) || n < 100 || n >= 600) {
    return OTHER;
  }
  return `${Math.floor(n / 100)}xx`;
}

/**
 * Normalize an Express route for the `http_route` label.
 * Prefers the matched route template (`req.route.path`) when available,
 * falling back to a regex sanitizer that converts UUIDs, 24-hex Mongo IDs,
 * `temp-*` ids, and numeric segments to `{id}`. Unmatched routes become
 * `unknown`.
 */
export function normalizeRoute(req: Request): string {
  // Express 4/5: req.route.path is the template ('/users/:id'); combine with baseUrl.
  const template = (req.route?.path as string | undefined) ?? null;
  const baseUrl = (req.baseUrl as string | undefined) ?? '';
  if (template) {
    return (
      (baseUrl + template).replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}') || '/'
    );
  }
  // Fallback: sanitize the raw path.
  const raw = (req.path as string | undefined) ?? '';
  if (!raw) {
    return 'unknown';
  }
  return (
    raw
      .split('/')
      .map(seg => {
        if (!seg) {
          return seg;
        }
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            seg,
          )
        ) {
          return '{id}';
        }
        if (/^[0-9a-f]{24}$/i.test(seg)) {
          return '{id}';
        }
        if (/^temp-[A-Za-z0-9_-]+$/i.test(seg)) {
          return '{id}';
        }
        if (/^\d+$/.test(seg)) {
          return '{id}';
        }
        return seg;
      })
      .join('/') || '/'
  );
}

function safeEmit(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      // One-shot debug; never throw to callers.
      console.debug(
        '[metrics] emit failed',
        err instanceof Error ? err.message : err,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry + default process/nodejs metrics
// ─────────────────────────────────────────────────────────────────────────────
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// ─────────────────────────────────────────────────────────────────────────────
// §1/§2 HTTP server
// ─────────────────────────────────────────────────────────────────────────────
const httpServerRequestsTotal = new promClient.Counter({
  name: 'http_server_requests_total',
  help: 'Total HTTP server requests.',
  labelNames: [
    'service',
    'http_method',
    'http_route',
    'http_status_code',
    'status_class',
  ],
});

const httpServerRequestDuration = new promClient.Histogram({
  name: 'http_server_request_duration_seconds',
  help: 'HTTP server request duration in seconds.',
  labelNames: [
    'service',
    'http_method',
    'http_route',
    'http_status_code',
    'status_class',
  ],
  buckets: [...HTTP_SERVER_BUCKETS],
});

const httpServerActiveRequests = new promClient.Gauge({
  name: 'http_server_active_requests',
  help: 'In-flight HTTP server requests.',
  labelNames: ['service', 'http_method'],
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 Socket.io / websocket
// ─────────────────────────────────────────────────────────────────────────────
const websocketConnectionsActive = new promClient.Gauge({
  name: 'websocket_connections_active',
  help: 'Active websocket connections.',
  labelNames: ['service'],
});

const websocketEventsTotal = new promClient.Counter({
  name: 'websocket_events_total',
  help: 'Websocket events observed at the server.',
  labelNames: ['service', 'direction', 'event'], // direction: in|out
});

const websocketEventDuration = new promClient.Histogram({
  name: 'websocket_event_duration_seconds',
  help: 'Server-side websocket event handler duration.',
  labelNames: ['service', 'event'],
  buckets: [...LATENCY_BUCKETS],
});

const websocketRoomsActive = new promClient.Gauge({
  name: 'websocket_rooms_active',
  help: 'Active websocket rooms (conversations joined).',
  labelNames: ['service'],
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 Chat / agent
// ─────────────────────────────────────────────────────────────────────────────
const chatMessagesTotal = new promClient.Counter({
  name: 'chat_messages_total',
  help: 'Chat messages processed.',
  labelNames: ['service', 'type', 'agent_type'], // type: user|assistant|proactive
});

const agentResponseTime = new promClient.Histogram({
  name: 'agent_response_time_seconds',
  help: 'Agent response duration (end-to-end, excluding user think time).',
  labelNames: ['service', 'agent_type', 'success'],
  buckets: [...LATENCY_BUCKETS, 30],
});

const agentHandoffsTotal = new promClient.Counter({
  name: 'agent_handoffs_total',
  help: 'Agent-to-agent handoffs.',
  labelNames: ['service', 'from_agent', 'to_agent'],
});

const agentProactiveFiresTotal = new promClient.Counter({
  name: 'agent_proactive_fires_total',
  help: 'Proactive agent actions fired.',
  labelNames: ['service', 'agent_type', 'action_type', 'outcome'],
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 LLM providers
// ─────────────────────────────────────────────────────────────────────────────
const llmRequestsTotal = new promClient.Counter({
  name: 'llm_requests_total',
  help: 'LLM provider requests.',
  labelNames: ['service', 'provider', 'model', 'outcome'],
});

const llmRequestDuration = new promClient.Histogram({
  name: 'llm_request_duration_seconds',
  help: 'End-to-end LLM provider request duration.',
  labelNames: ['service', 'provider', 'model'],
  buckets: [...LLM_BUCKETS],
});

const llmTokensTotal = new promClient.Counter({
  name: 'llm_tokens_total',
  help: 'LLM tokens processed.',
  labelNames: ['service', 'provider', 'model', 'direction'], // direction: input|output
});

const llmTimeToFirstToken = new promClient.Histogram({
  name: 'llm_time_to_first_token_seconds',
  help: 'LLM streaming time to first token.',
  labelNames: ['service', 'provider', 'model'],
  buckets: [...TTFT_BUCKETS],
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 DB client (Redis + future mongo)
// ─────────────────────────────────────────────────────────────────────────────
const dbClientOperationsTotal = new promClient.Counter({
  name: 'db_client_operations_total',
  help: 'DB client operations.',
  labelNames: ['service', 'db_system', 'db_operation', 'outcome'],
});

const dbClientOperationDuration = new promClient.Histogram({
  name: 'db_client_operation_duration_seconds',
  help: 'DB client operation duration.',
  labelNames: ['service', 'db_system', 'db_operation'],
  buckets: [...LATENCY_BUCKETS],
});

const dbClientConnectionsActive = new promClient.Gauge({
  name: 'db_client_connections_active',
  help: 'Active DB client connections.',
  labelNames: ['service', 'db_system', 'pool'],
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 Outbound HTTP client
// ─────────────────────────────────────────────────────────────────────────────
const httpClientRequestsTotal = new promClient.Counter({
  name: 'http_client_requests_total',
  help: 'Outbound HTTP client requests.',
  labelNames: [
    'service',
    'peer_service',
    'http_method',
    'http_status_code',
    'status_class',
  ],
});

const httpClientRequestDuration = new promClient.Histogram({
  name: 'http_client_request_duration_seconds',
  help: 'Outbound HTTP client request duration.',
  labelNames: [
    'service',
    'peer_service',
    'http_method',
    'http_status_code',
    'status_class',
  ],
  buckets: [...LATENCY_BUCKETS],
});

// ─────────────────────────────────────────────────────────────────────────────
// §8 Worker / queue
// ─────────────────────────────────────────────────────────────────────────────
const workerQueueDepth = new promClient.Gauge({
  name: 'worker_queue_depth',
  help: 'Background worker queue depth.',
  labelNames: ['service', 'queue'],
});

const workerJobsTotal = new promClient.Counter({
  name: 'worker_jobs_total',
  help: 'Worker jobs completed.',
  labelNames: ['service', 'job', 'outcome'],
});

const workerJobDuration = new promClient.Histogram({
  name: 'worker_job_duration_seconds',
  help: 'Worker job duration.',
  labelNames: ['service', 'job', 'outcome'],
  buckets: [...LATENCY_BUCKETS, 30, 60],
});

// ─────────────────────────────────────────────────────────────────────────────
// §9 Storage (memory)
// ─────────────────────────────────────────────────────────────────────────────
const memoryStorageOperationsTotal = new promClient.Counter({
  name: 'memory_storage_operations_total',
  help: 'In-memory storage operations (fallback path when Redis is unavailable).',
  labelNames: ['service', 'operation', 'outcome'],
});

// ─────────────────────────────────────────────────────────────────────────────
// §10 Build / app info
// ─────────────────────────────────────────────────────────────────────────────
const appInfo = new promClient.Gauge({
  name: 'app_info',
  help: 'Build and runtime info for this service. Always 1.',
  labelNames: ['service', 'version', 'commit', 'node_version'],
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation metrics (existing — kept for validation dashboard compatibility)
// ─────────────────────────────────────────────────────────────────────────────
const validationChecks = new promClient.Counter({
  name: 'validation_checks_total',
  help: 'Total number of validation checks performed.',
  labelNames: ['agent_type', 'result', 'proactive'],
});

const validationScores = new promClient.Histogram({
  name: 'validation_scores',
  help: 'Distribution of validation scores.',
  labelNames: ['agent_type', 'proactive'],
  buckets: [...SCORE_BUCKETS],
});

const validationIssues = new promClient.Counter({
  name: 'validation_issues_total',
  help: 'Total number of validation issues by severity.',
  labelNames: ['agent_type', 'severity', 'issue_type'],
});

const validationResponseLength = new promClient.Histogram({
  name: 'validation_response_length_chars',
  help: 'Length of responses being validated.',
  labelNames: ['agent_type'],
  buckets: [...CHAR_BUCKETS],
});

const validationQualityMetrics = new promClient.Histogram({
  name: 'validation_quality_metrics',
  help: 'Various quality metrics from validation.',
  labelNames: ['agent_type', 'metric_type'],
  buckets: [...SCORE_BUCKETS],
});

// ─────────────────────────────────────────────────────────────────────────────
// Errors (generic)
// ─────────────────────────────────────────────────────────────────────────────
const errorsTotal = new promClient.Counter({
  name: 'backend_errors_total',
  help: 'Errors observed by the backend, by coarse kind.',
  labelNames: ['service', 'kind'],
});

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────
const allMetrics: Array<
  | promClient.Counter<string>
  | promClient.Histogram<string>
  | promClient.Gauge<string>
> = [
  httpServerRequestsTotal,
  httpServerRequestDuration,
  httpServerActiveRequests,
  websocketConnectionsActive,
  websocketEventsTotal,
  websocketEventDuration,
  websocketRoomsActive,
  chatMessagesTotal,
  agentResponseTime,
  agentHandoffsTotal,
  agentProactiveFiresTotal,
  llmRequestsTotal,
  llmRequestDuration,
  llmTokensTotal,
  llmTimeToFirstToken,
  dbClientOperationsTotal,
  dbClientOperationDuration,
  dbClientConnectionsActive,
  httpClientRequestsTotal,
  httpClientRequestDuration,
  workerQueueDepth,
  workerJobsTotal,
  workerJobDuration,
  memoryStorageOperationsTotal,
  appInfo,
  validationChecks,
  validationScores,
  validationIssues,
  validationResponseLength,
  validationQualityMetrics,
  errorsTotal,
];
for (const m of allMetrics) {
  register.registerMetric(m);
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP middleware (§1/§2)
// ─────────────────────────────────────────────────────────────────────────────
export function httpMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();
  const method = req.method;
  httpServerActiveRequests.inc({ service: SERVICE_LABEL, http_method: method });

  let finished = false;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    safeEmit(() => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      const route = normalizeRoute(req);
      const code = String(res.statusCode);
      const cls = statusClass(res.statusCode);
      const labels = {
        service: SERVICE_LABEL,
        http_method: method,
        http_route: route,
        http_status_code: code,
        status_class: cls,
      };
      httpServerRequestsTotal.inc(labels);
      httpServerRequestDuration.observe(labels, duration);
      httpServerActiveRequests.dec({
        service: SERVICE_LABEL,
        http_method: method,
      });
    });
  };

  res.on('finish', finish);
  res.on('close', finish);
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Emit helpers — use these from consumers.
// Every helper is side-effect-only and wrapped in safeEmit.
// ─────────────────────────────────────────────────────────────────────────────
export const metricsEmit = {
  ws: {
    connectionOpened: () =>
      safeEmit(() =>
        websocketConnectionsActive.inc({ service: SERVICE_LABEL }),
      ),
    connectionClosed: () =>
      safeEmit(() =>
        websocketConnectionsActive.dec({ service: SERVICE_LABEL }),
      ),
    eventIn: (event: string) =>
      safeEmit(() =>
        websocketEventsTotal.inc({
          service: SERVICE_LABEL,
          direction: 'in',
          event: whitelist(event, WS_EVENTS),
        }),
      ),
    eventOut: (event: string) =>
      safeEmit(() =>
        websocketEventsTotal.inc({
          service: SERVICE_LABEL,
          direction: 'out',
          event: whitelist(event, WS_EVENTS),
        }),
      ),
    eventDuration: (event: string, seconds: number) =>
      safeEmit(() =>
        websocketEventDuration.observe(
          { service: SERVICE_LABEL, event: whitelist(event, WS_EVENTS) },
          Math.max(0, seconds),
        ),
      ),
    roomJoined: () =>
      safeEmit(() => websocketRoomsActive.inc({ service: SERVICE_LABEL })),
    roomLeft: () =>
      safeEmit(() => websocketRoomsActive.dec({ service: SERVICE_LABEL })),
  },

  chat: {
    messageObserved: (
      type: 'user' | 'assistant' | 'proactive',
      agentType: string | undefined,
    ) =>
      safeEmit(() =>
        chatMessagesTotal.inc({
          service: SERVICE_LABEL,
          type,
          agent_type:
            (agentType ?? 'unknown').toString().toLowerCase() || 'unknown',
        }),
      ),
  },

  agent: {
    responseTime: (
      agentType: string | undefined,
      success: boolean,
      seconds: number,
    ) =>
      safeEmit(() =>
        agentResponseTime.observe(
          {
            service: SERVICE_LABEL,
            agent_type:
              (agentType ?? 'unknown').toString().toLowerCase() || 'unknown',
            success: success ? 'true' : 'false',
          },
          Math.max(0, seconds),
        ),
      ),
    handoff: (fromAgent: string | undefined, toAgent: string | undefined) =>
      safeEmit(() =>
        agentHandoffsTotal.inc({
          service: SERVICE_LABEL,
          from_agent:
            (fromAgent ?? 'unknown').toString().toLowerCase() || 'unknown',
          to_agent:
            (toAgent ?? 'unknown').toString().toLowerCase() || 'unknown',
        }),
      ),
    proactiveFire: (
      agentType: string | undefined,
      actionType: string | undefined,
      outcome: 'success' | 'error',
    ) =>
      safeEmit(() =>
        agentProactiveFiresTotal.inc({
          service: SERVICE_LABEL,
          agent_type:
            (agentType ?? 'unknown').toString().toLowerCase() || 'unknown',
          action_type: whitelist(actionType, PROACTIVE_ACTION_TYPES),
          outcome,
        }),
      ),
  },

  llm: {
    request: (
      provider: string,
      model: string,
      outcome: 'success' | 'error',
      durationSec: number,
    ) =>
      safeEmit(() => {
        const labels = {
          service: SERVICE_LABEL,
          provider: whitelist(provider, LLM_PROVIDERS),
          model: (model ?? 'unknown').toString(),
        };
        llmRequestsTotal.inc({ ...labels, outcome });
        llmRequestDuration.observe(labels, Math.max(0, durationSec));
      }),
    tokens: (
      provider: string,
      model: string,
      direction: 'input' | 'output',
      count: number,
    ) =>
      safeEmit(() =>
        llmTokensTotal.inc(
          {
            service: SERVICE_LABEL,
            provider: whitelist(provider, LLM_PROVIDERS),
            model: (model ?? 'unknown').toString(),
            direction,
          },
          Math.max(0, count),
        ),
      ),
    timeToFirstToken: (provider: string, model: string, seconds: number) =>
      safeEmit(() =>
        llmTimeToFirstToken.observe(
          {
            service: SERVICE_LABEL,
            provider: whitelist(provider, LLM_PROVIDERS),
            model: (model ?? 'unknown').toString(),
          },
          Math.max(0, seconds),
        ),
      ),
  },

  db: {
    operation: (
      dbSystem: string,
      dbOperation: string,
      outcome: 'success' | 'error',
      durationSec: number,
    ) =>
      safeEmit(() => {
        const op = whitelist(dbOperation, DB_OPS);
        const labels = {
          service: SERVICE_LABEL,
          db_system: dbSystem,
          db_operation: op,
        };
        dbClientOperationsTotal.inc({ ...labels, outcome });
        dbClientOperationDuration.observe(labels, Math.max(0, durationSec));
      }),
    connectionsActive: (dbSystem: string, pool: string, value: number) =>
      safeEmit(() =>
        dbClientConnectionsActive.set(
          { service: SERVICE_LABEL, db_system: dbSystem, pool },
          value,
        ),
      ),
  },

  httpClient: {
    request: (
      peerService: string,
      method: string,
      statusCode: number | string,
      durationSec: number,
    ) =>
      safeEmit(() => {
        const labels = {
          service: SERVICE_LABEL,
          peer_service: whitelist(peerService, PEER_SERVICES),
          http_method: (method ?? 'GET').toUpperCase(),
          http_status_code: String(statusCode),
          status_class: statusClass(statusCode),
        };
        httpClientRequestsTotal.inc(labels);
        httpClientRequestDuration.observe(labels, Math.max(0, durationSec));
      }),
  },

  worker: {
    queueDepth: (queue: string, depth: number) =>
      safeEmit(() =>
        workerQueueDepth.set({ service: SERVICE_LABEL, queue }, depth),
      ),
    job: (
      job: string,
      outcome: 'success' | 'failure' | 'retry',
      durationSec: number,
    ) =>
      safeEmit(() => {
        const labels = { service: SERVICE_LABEL, job, outcome };
        workerJobsTotal.inc(labels);
        workerJobDuration.observe(labels, Math.max(0, durationSec));
      }),
  },

  memory: {
    operation: (operation: string, outcome: 'success' | 'error') =>
      safeEmit(() =>
        memoryStorageOperationsTotal.inc({
          service: SERVICE_LABEL,
          operation: whitelist(operation, MEMORY_OPS),
          outcome,
        }),
      ),
  },

  error: (kind: string) =>
    safeEmit(() =>
      errorsTotal.inc({
        service: SERVICE_LABEL,
        kind: whitelist(kind, ERROR_KINDS),
      }),
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// App info registration — call once at startup.
// ─────────────────────────────────────────────────────────────────────────────
export function registerAppInfo(): void {
  safeEmit(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- read at runtime to avoid bundling package.json
    const pkg = require('../../package.json') as { version?: string };
    appInfo.set(
      {
        service: SERVICE_LABEL,
        version: pkg.version ?? 'unknown',
        commit: process.env.GIT_COMMIT ?? 'unknown',
        node_version: process.version,
      },
      1,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Back-compat `metrics.*` export — existing callers (responseValidator,
// socket/__tests__, etc.) keep compiling. Prefer `metricsEmit.*` in new code.
// ─────────────────────────────────────────────────────────────────────────────
export const metrics = {
  /** @deprecated use metricsEmit.ws.connectionOpened/closed */
  activeConnections: websocketConnectionsActive,
  /** @deprecated use metricsEmit.chat.messageObserved */
  chatMessagesTotal,
  /** @deprecated use metricsEmit.agent.responseTime */
  agentResponseTime,
  /** @deprecated use metricsEmit.llm.* */
  aiModelRequests: llmRequestsTotal,
  /** @deprecated use metricsEmit.llm.tokens */
  aiModelTokensUsed: llmTokensTotal,
  validationChecks,
  validationScores,
  validationIssues,
  validationResponseLength,
  validationMetrics: validationQualityMetrics,
  memoryStorageOperations: memoryStorageOperationsTotal,
  httpRequestDuration: httpServerRequestDuration,
  httpRequestsTotal: httpServerRequestsTotal,
};

export { register };
export default promClient;
