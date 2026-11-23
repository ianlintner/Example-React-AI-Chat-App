/** Card 10: legacy metric names and bounded OTLP GenAI spans. */
import { describe, expect, it } from 'vitest';
import { Registry } from 'prom-client';
import { createAgentMetrics } from './metrics';
import { createGenAiExporter, loadOtelConfig, type GenAiSpan } from './genai';

describe('observability', () => {
  it('registers legacy metric names once per registry', () => {
    const registry = new Registry();
    const a = createAgentMetrics(registry);
    const b = createAgentMetrics(registry);
    expect(a.chatMessages).toBe(b.chatMessages);
    a.chatMessages.inc({ service: 'agent', tier: 'fast', direction: 'in' });
    expect(registry.getSingleMetric('chat_messages_total')).toBeDefined();
    expect(
      registry.getSingleMetric('llm_request_duration_seconds'),
    ).toBeDefined();
  });

  it('never exports prompt text or a hard-coded model id', async () => {
    const seen: string[] = [];
    const exporter = createGenAiExporter(
      { endpoint: 'http://127.0.0.1:4318', serviceName: 'agent' },
      (async (_url, init) => {
        seen.push(String(init?.body));
        return new Response(null, { status: 200 });
      }) as typeof fetch,
    );
    const span: GenAiSpan = {
      route: 'local-fast',
      operation: 'chat',
      startedAt: 1,
      endedAt: 2,
      status: 'ok',
      inputTokens: 12,
      outputTokens: 8,
    };
    await exporter.exportSpan(span);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('gen_ai.request.model');
    expect(seen[0]).toContain('local-fast');
    expect(seen[0]).not.toMatch(/gpt-|claude-|gemini-/i);
  });

  it('fails closed when the OTLP endpoint is not http(s)', () => {
    expect(
      loadOtelConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: 'ftp://bad' }).endpoint,
    ).toBe('');
  });
});
