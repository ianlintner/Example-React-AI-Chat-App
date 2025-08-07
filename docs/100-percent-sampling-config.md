# 100% Trace Sampling Configuration Summary

This document outlines all configurations that ensure 100% trace sampling across the backend, OpenTelemetry Collector, and Docker Compose setup.

## Backend Tracer Configuration (`backend/src/tracing/tracer.ts`)

### Key Changes Made:
- ✅ **AlwaysOnSampler**: Explicitly configured `new AlwaysOnSampler()` in the NodeSDK
- ✅ **Immediate Export**: BatchSpanProcessor configured with:
  - `maxExportBatchSize: 1` - Export every single span immediately
  - `scheduledDelayMillis: 500` - Check for export every 500ms
  - `exportTimeoutMillis: 1000` - Fast export timeout
- ✅ **Console + Remote Export**: Both console debugging and remote export configured
- ✅ **Enhanced Logging**: Detailed debug logs for trace export verification

### Code Verification:
```typescript
return new NodeSDK({
  serviceName: serviceName,
  sampler: new AlwaysOnSampler(), // 100% sampling
  spanProcessors: createSpanProcessors(),
  // ... rest of config
});
```

## Environment Variables

### Backend Environment (`backend/.env`):
```bash
# Tracing Configuration - 100% Sampling
ENABLE_TRACING=true
OTEL_TRACES_SAMPLER=always_on
OTEL_TRACES_SAMPLER_ARG=1.0
OTEL_SERVICE_NAME=ai-goal-seeking-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

### Docker Compose Environment (`docker-compose.yml`):
```yaml
environment:
  - OTEL_TRACES_SAMPLER=always_on
  - OTEL_TRACES_SAMPLER_ARG=1.0
  - OTEL_RESOURCE_ATTRIBUTES=service.name=ai-goal-seeking-backend,service.version=1.0.0,deployment.environment=docker,sampling.enabled=true,sampling.rate=1.0
  - ENABLE_TRACING=true
```

## OpenTelemetry Collector Configuration (`otel-collector-config.yaml`)

### Resource Processor:
```yaml
resource:
  attributes:
    - key: deployment.environment
      value: "development"
      action: upsert
    - key: sampling.enabled
      value: "true"
      action: upsert
    - key: sampling.rate
      value: "1.0"
      action: upsert
```

### Service Pipeline:
```yaml
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, resource, batch]
      exporters: [zipkin, debug]
  telemetry:
    logs:
      level: "debug"  # Enhanced logging
```

## Verification Steps

### 1. Backend Logs to Monitor:
Look for these log messages when the backend starts:
- `🔍 Configuring 100% trace sampling (AlwaysOnSampler)`
- `🔍 Adding batch span processor for main exporter`
- `✅ Test span created successfully`
- `🔍 OTLP EXPORT: Attempting to send X spans to...`
- `✅ OTLP EXPORT: Successfully sent spans to collector`

### 2. Collector Logs:
- Monitor collector logs for incoming traces
- Verify debug output shows all received spans
- Check for successful exports to Zipkin

### 3. Zipkin UI Verification:
- Access Zipkin at `http://localhost:9411`
- Verify all traces are visible
- Check trace completion rates (should be 100%)

### 4. Console Output:
The backend will output every span to console for debugging:
```
📊 Span 1: conversation.process
  - Trace ID: abc123...
  - Span ID: def456...
  - Status: {"code":"OK"}
```

## Sampling Rate Verification Commands

### Check Environment Variables:
```bash
# In running backend container
echo $OTEL_TRACES_SAMPLER          # Should be: always_on
echo $OTEL_TRACES_SAMPLER_ARG      # Should be: 1.0
```

### Test Trace Generation:
```bash
# Generate test traces
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "conversationId": "test-123"}'
```

## Expected Behavior

With 100% sampling configured:

1. **Every HTTP request** generates traces
2. **Every agent operation** creates spans
3. **Every database operation** is traced
4. **Every validation step** is captured
5. **All spans are exported** to Zipkin via the collector

## Troubleshooting

If traces are missing:

1. **Check Backend Logs**: Ensure `AlwaysOnSampler` is configured
2. **Verify Environment Variables**: Confirm sampling settings
3. **Monitor Export Success**: Look for export error messages
4. **Check Collector Health**: Verify collector is receiving traces
5. **Zipkin Connectivity**: Ensure Zipkin is accessible and storing traces

## Performance Considerations

With 100% sampling:
- **Increased CPU usage** due to trace processing
- **Higher memory usage** for span storage
- **Network overhead** from trace export
- **Storage requirements** in Zipkin

This configuration prioritizes **complete observability** over performance optimization.
