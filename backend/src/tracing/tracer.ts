import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';

// Configure the trace exporter based on environment
const createTraceExporter = () => {
  // Use OpenTelemetry Collector if OTLP endpoint is configured
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-http');
    return new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/traces',
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? 
        JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {},
    });
  }
  
  // Fallback to Jaeger direct export
  return new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  });
};

// Create and configure the Node SDK
const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'ai-goal-seeking-system',
  traceExporter: createTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

// Initialize the SDK
export const initializeTracing = () => {
  try {
    sdk.start();
    console.log('🔍 OpenTelemetry tracing initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing OpenTelemetry tracing:', error);
  }
};

// Get the tracer instance
export const tracer = trace.getTracer('ai-goal-seeking-system', '1.0.0');

// Helper functions for conversation tracing
export const createConversationSpan = (conversationId: string, operation: string) => {
  return tracer.startSpan(`conversation.${operation}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'conversation.id': conversationId,
      'conversation.operation': operation,
    },
  });
};

export const createAgentSpan = (agentType: string, operation: string, conversationId?: string) => {
  return tracer.startSpan(`agent.${agentType}.${operation}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'agent.type': agentType,
      'agent.operation': operation,
      ...(conversationId && { 'conversation.id': conversationId }),
    },
  });
};

export const createValidationSpan = (conversationId: string, agentType?: string) => {
  return tracer.startSpan('validation.validate_response', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'conversation.id': conversationId,
      'validation.operation': 'validate_response',
      ...(agentType && { 'agent.type': agentType }),
    },
  });
};

export const createGoalSeekingSpan = (conversationId: string, userState: any) => {
  return tracer.startSpan('goal_seeking.process', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'conversation.id': conversationId,
      'goal_seeking.operation': 'process',
      'user.state': userState.state,
      'user.engagement': userState.engagement,
      'user.satisfaction': userState.satisfaction,
    },
  });
};

// Helper function to add span events
export const addSpanEvent = (span: any, name: string, attributes?: Record<string, any>) => {
  span.addEvent(name, {
    timestamp: Date.now(),
    ...(attributes && attributes),
  });
};

// Helper function to set span status
export const setSpanStatus = (span: any, success: boolean, message?: string) => {
  if (success) {
    span.setStatus({ code: SpanStatusCode.OK });
  } else {
    span.setStatus({ 
      code: SpanStatusCode.ERROR, 
      message: message || 'Operation failed' 
    });
  }
};

// Helper function to safely end span
export const endSpan = (span: any, attributes?: Record<string, any>) => {
  if (attributes) {
    span.setAttributes(attributes);
  }
  span.end();
};

export { context };
