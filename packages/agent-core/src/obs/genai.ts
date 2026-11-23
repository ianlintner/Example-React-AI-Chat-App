/**
 * OTel GenAI instrumentation for the agent loop (card 10).
 *
 * Emits a single `gen_ai` span per LLM invocation over OTLP/HTTP JSON. No SDK
 * dependency, no hard-coded model id: `gen_ai.request.model` is the env-mapped
 * *route name* supplied by the caller. No payload text is ever exported —
 * only counts, timings, route names and error class.
 *
 * Endpoint defaults to the loopback collector and is overridable via env;
 * export is best-effort and never blocks or fails the user request.
 */
export interface OtelConfig {
  /** OTLP/HTTP base, e.g. http://127.0.0.1:4318. Empty disables export. */
  endpoint: string;
  /** Service name reported as resource attribute. */
  serviceName: string;
}

const DEFAULT_ENDPOINT = 'http://127.0.0.1:4318';

/** Read instrumentation env explicitly; safe in Node/browser-free contexts. */
export function loadOtelConfig(
  env: Record<string, string | undefined>,
  serviceName = 'agent',
): OtelConfig {
  const raw = env.OTEL_EXPORTER_OTLP_ENDPOINT ?? DEFAULT_ENDPOINT;
  let endpoint = '';
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:')
      endpoint = url.origin;
  } catch {
    endpoint = '';
  }
  return { endpoint, serviceName };
}

export interface GenAiSpan {
  /** Env-mapped gateway route (e.g. `local-fast`), never a model id. */
  route: string;
  operation: 'chat' | 'router' | 'research' | 'goals';
  tier?: 'fast' | 'deep' | 'research';
  startedAt: number;
  endedAt: number;
  inputTokens?: number;
  outputTokens?: number;
  toolCalls?: number;
  status: 'ok' | 'error';
  errorType?: string;
}

function hex(bytes: number): string {
  let out = '';
  for (let i = 0; i < bytes; i++)
    out += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  return out;
}

function attributes(
  span: GenAiSpan,
): Record<string, string | number | boolean> {
  const attrs: Record<string, string | number | boolean> = {
    'gen_ai.system': 'openai-compatible-gateway',
    'gen_ai.operation.name': span.operation,
    'gen_ai.request.model': span.route,
    'gen_ai.response.model': span.route,
    'gen_ai.provider.name': 'switchyard',
  };
  if (span.tier) attrs['gen_ai.request.tier'] = span.tier;
  if (span.inputTokens !== undefined)
    attrs['gen_ai.usage.input_tokens'] = span.inputTokens;
  if (span.outputTokens !== undefined)
    attrs['gen_ai.usage.output_tokens'] = span.outputTokens;
  if (span.toolCalls !== undefined)
    attrs['gen_ai.response.tool_calls'] = span.toolCalls;
  if (span.errorType) attrs['error.type'] = span.errorType;
  return attrs;
}

/** Best-effort OTLP/HTTP JSON export. Never throws, never logs payloads. */
export function createGenAiExporter(
  config: OtelConfig,
  fetchImpl: typeof fetch = fetch,
) {
  if (!config.endpoint) return { exportSpan: async (_span: GenAiSpan) => {} };
  const url = `${config.endpoint}/v1/traces`;
  return {
    async exportSpan(span: GenAiSpan): Promise<void> {
      const start = `${span.startedAt * 1000000}`;
      const end = `${span.endedAt * 1000000}`;
      const payload = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: 'service.name',
                  value: { stringValue: config.serviceName },
                },
              ],
            },
            scopeSpans: [
              {
                scope: { name: 'agent-core-genai', version: '1.0.0' },
                spans: [
                  {
                    traceId: hex(16),
                    spanId: hex(8),
                    name: `gen_ai.${span.operation}`,
                    kind: 3, // SPAN_KIND_CLIENT
                    startTimeUnixNano: start,
                    endTimeUnixNano: end,
                    status: { code: span.status === 'ok' ? 1 : 2 },
                    attributes: Object.entries(attributes(span)).map(
                      ([key, value]) => ({
                        key,
                        value:
                          typeof value === 'number'
                            ? { intValue: `${Math.round(value)}` }
                            : typeof value === 'boolean'
                              ? { boolValue: value }
                              : { stringValue: value },
                      }),
                    ),
                  },
                ],
              },
            ],
          },
        ],
      };
      try {
        await fetchImpl(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(1500),
        });
      } catch {
        // Telemetry must never affect the request path.
      }
    },
  };
}
