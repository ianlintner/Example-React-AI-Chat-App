# Azure Monitor Tracing (OTLP Collector Path)

This document supplements `tracing.md` with Azure-specific guidance for exporting OpenTelemetry traces to Application Insights through an in-cluster OpenTelemetry Collector.

## Flow

`Application Code -> OTLP HTTP -> OpenTelemetry Collector -> Azure Monitor / Application Insights`

## Backend Configuration

Environment variables (production / AKS):

```
ENABLE_TRACING=true
TRACING_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces
OTEL_SERVICE_NAME=ai-goal-seeking-backend
OTEL_TRACES_SAMPLER_RATIO=0.1
AZURE_MONITOR_CONNECTION_STRING=InstrumentationKey=...;IngestionEndpoint=...
```

Local development keeps using Zipkin (`TRACING_EXPORTER=zipkin`).

## Collector Deployment

Apply manifest: `k8s/observability/otel-collector.yaml`

Components:
- ConfigMap: collector configuration (`azuremonitor`, `zipkin`, `debug` exporters)
- Secret: `azure-monitor-conn` with connection string
- Deployment & Service: collector receives OTLP on 4317 (gRPC) & 4318 (HTTP)

## Sampling

ParentBased + TraceIdRatio (10% default in production). Adjust via `OTEL_TRACES_SAMPLER_RATIO` to control cost.

## Query Examples (Kusto)

By conversation:
```kusto
traces
| where customDimensions["conversation.id"] == "<conversation-id>"
| order by timestamp desc
```

By agent type:
```kusto
traces
| where customDimensions["agent.type"] == "trivia"
| summarize count() by bin(timestamp, 10m)
```

Latency distribution:
```kusto
traces
| where name startswith "agent." and customDimensions["agent.type"] == "joke"
| summarize avg(duration) by bin(timestamp, 5m)
```

## Troubleshooting

| Symptom | Resolution |
|---------|------------|
| No spans visible | Verify collector Service DNS `otel-collector` resolves; check pod logs for exporter errors |
| High ingestion cost | Lower `OTEL_TRACES_SAMPLER_RATIO` to 0.05 or 0.02 |
| Missing attributes | Confirm use of helper span functions in `tracer.ts` (e.g. `createAgentSpan`) |
| 429 throttling in Azure | Reduce sampling further; batch processor handles retries |
| Connection string invalid | Copy full connection string (InstrumentationKey + IngestionEndpoint) |

## Migration Checklist

- [x] OTLP exporter code path added (`TRACING_EXPORTER=otlp`)
- [x] Sampling ratio env introduced
- [x] Collector manifest created
- [x] Azure Monitor exporter configured in collector
- [x] Documentation updated (this file)

## Next Enhancements

1. Add OTLP metrics pipeline to Azure Monitor (currently Prometheus only)
2. Centralize logs via OTLP log exporter
3. Add adaptive sampling based on span attributes (e.g., full sample on validation failures)
