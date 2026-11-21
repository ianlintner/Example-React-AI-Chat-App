import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  trace,
  context,
  Span,
  SpanKind,
  SpanStatusCode,
  Attributes,
} from '@opentelemetry/api';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { tracingContextManager } from './contextManager';

// Single OTLP/HTTP trace exporter (Prometheus/Grafana-friendly collectors,
// e.g. the OpenTelemetry Collector in docker-compose).
const createTraceExporter = (): OTLPTraceExporter => {
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://localhost:4318/v1/traces';
  console.log('🔗 Using OTLP HTTP trace exporter:', endpoint);
  return new OTLPTraceExporter({ url: endpoint });
};

// Add console exporter for debugging
const createConsoleExporter = (): ConsoleSpanExporter => {
  console.log('🔍 Adding console exporter for debugging');
  return new ConsoleSpanExporter();
};

// Create span processors for direct OTLP export without buffering
const createSpanProcessors = (): SimpleSpanProcessor[] => {
  const processors = [];

  // Always add console exporter for debugging
  console.log('🔍 Adding console span processor for debugging');
  processors.push(new SimpleSpanProcessor(createConsoleExporter()));

  // Add main exporter
  const mainExporter = createTraceExporter();
  console.log('🔍 Adding span processor for primary exporter');
  processors.push(new SimpleSpanProcessor(mainExporter as any));

  return processors;
};

// Create and configure the Node SDK with adjustable sampling
const createSDK = (): NodeSDK => {
  const serviceName =
    process.env.OTEL_SERVICE_NAME || 'ai-goal-seeking-backend';
  console.log('🔍 Creating Node SDK with service name:', serviceName);
  // Determine sampling ratio: production defaults to 0.1 unless overridden
  const ratioStr =
    process.env.OTEL_TRACES_SAMPLER_RATIO ||
    (process.env.NODE_ENV === 'production' ? '0.1' : '1');
  let ratio = parseFloat(ratioStr);
  if (Number.isNaN(ratio) || ratio <= 0 || ratio > 1) {
    console.warn(
      `⚠️ Invalid OTEL_TRACES_SAMPLER_RATIO='${ratioStr}', falling back to 1.0`,
    );
    ratio = 1;
  }
  console.log(
    `🔍 Configuring ParentBased TraceIdRatio sampler (ratio=${ratio})`,
  );

  return new NodeSDK({
    serviceName: serviceName,
    // ParentBased ensures child spans follow parent sampling decision
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(ratio),
    }),
    spanProcessors: createSpanProcessors(),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Enable more detailed HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          requestHook: (span, request) => {
            console.log(
              '🔍 HTTP request instrumented:',
              (request as any).method,
              (request as any).url,
            );
          },
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-socket.io': {
          enabled: true,
        },
        // Disable problematic auto-instrumentations
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });
};

const sdk = createSDK();

// Initialize the SDK with enhanced error handling
export const initializeTracing = (): void => {
  try {
    console.log('🔍 Starting OpenTelemetry SDK initialization...');
    sdk.start();
    console.log('✅ OpenTelemetry tracing initialized successfully');
    console.log(
      '🔍 Sampling ratio:',
      process.env.OTEL_TRACES_SAMPLER_RATIO ||
        (process.env.NODE_ENV === 'production' ? '0.1' : '1'),
    );

    // Create a test span to verify tracing is working
    createTestSpan();
  } catch (error) {
    console.error('❌ Error initializing OpenTelemetry tracing:', error);
    console.error('Stack trace:', (error as Error).stack);
  }
};

// Create a test span to verify tracing is working
const createTestSpan = (): void => {
  try {
    console.log('🔍 Creating test span...');
    const testTracer = trace.getTracer('test-tracer', '1.0.0');
    const span = testTracer.startSpan('tracer_initialization_test');

    span.setAttributes({
      'test.type': 'initialization',
      'test.timestamp': Date.now(),
      'service.name':
        process.env.OTEL_SERVICE_NAME || 'ai-goal-seeking-backend',
    });

    span.addEvent('tracer_initialization_completed', {
      timestamp: Date.now(),
    });

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    console.log('✅ Test span created successfully');
  } catch (error) {
    console.error('❌ Failed to create test span:', error);
  }
};

// Get the tracer instance
export const tracer = trace.getTracer('ai-goal-seeking-system', '1.0.0');

// Enhanced helper functions for conversation tracing with proper context propagation
export const createConversationSpan = (
  conversationId: string,
  operation: string,
  userId?: string,
): Span => {
  const spanName = tracingContextManager.createSpanName(
    'conversation',
    operation,
  );
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.SERVER,
    attributes: {
      'conversation.id': conversationId,
      'conversation.operation': operation,
    },
  });

  // Add standard attributes and ensure trace context is logged
  tracingContextManager.addStandardAttributes(span, {
    conversationId,
    userId,
    operation: `conversation.${operation}`,
  });

  // Log trace creation for debugging
  tracingContextManager.logCurrentTrace(`conversation.${operation}`);

  return span;
};

export const createAgentSpan = (
  agentType: string,
  operation: string,
  conversationId?: string,
  userId?: string,
): Span => {
  const spanName = tracingContextManager.createSpanName(
    'agent',
    `${agentType}.${operation}`,
  );
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'agent.type': agentType,
      'agent.operation': operation,
      ...(conversationId && { 'conversation.id': conversationId }),
    },
  });

  // Add standard attributes and ensure proper context propagation
  tracingContextManager.addStandardAttributes(span, {
    agentType,
    conversationId,
    userId,
    operation: `agent.${agentType}.${operation}`,
  });

  // Log trace context for debugging
  tracingContextManager.logCurrentTrace(`agent.${agentType}.${operation}`);

  return span;
};

export const createValidationSpan = (
  conversationId: string,
  agentType?: string,
  userId?: string,
): Span => {
  const spanName = tracingContextManager.createSpanName(
    'validation',
    'validate_response',
  );
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'conversation.id': conversationId,
      'validation.operation': 'validate_response',
      ...(agentType && { 'agent.type': agentType }),
    },
  });

  // Add standard attributes
  tracingContextManager.addStandardAttributes(span, {
    conversationId,
    agentType,
    userId,
    operation: 'validation.validate_response',
  });

  // Log trace context
  tracingContextManager.logCurrentTrace('validation.validate_response');

  return span;
};

export const createGoalSeekingSpan = (
  conversationId: string,
  userState: unknown,
  userId?: string,
): Span => {
  const spanName = tracingContextManager.createSpanName(
    'goal_seeking',
    'process',
  );

  const userStateObj = userState as any;
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'conversation.id': conversationId,
      'goal_seeking.operation': 'process',
      'user.state': userStateObj?.state || 'unknown',
      'user.engagement': userStateObj?.engagement || 0,
      'user.satisfaction': userStateObj?.satisfaction || 0,
    },
  });

  // Add standard attributes
  tracingContextManager.addStandardAttributes(span, {
    conversationId,
    userId,
    operation: 'goal_seeking.process',
    'user.state': userStateObj?.state,
    'user.engagement': userStateObj?.engagement,
    'user.satisfaction': userStateObj?.satisfaction,
  });

  // Log trace context
  tracingContextManager.logCurrentTrace('goal_seeking.process');

  return span;
};

// Helper function to add span events
export const addSpanEvent = (
  span: Span | null | undefined,
  name: string,
  attributes?: Attributes,
): void => {
  if (!span) {
    return;
  }
  span.addEvent(name, {
    timestamp: Date.now(),
    ...(attributes && attributes),
  });
};

// Helper function to set span status
export const setSpanStatus = (
  span: Span | null | undefined,
  success: boolean,
  message?: string,
): void => {
  if (!span) {
    return;
  }
  if (success) {
    span.setStatus({ code: SpanStatusCode.OK });
  } else {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: message || 'Operation failed',
    });
  }
};

// Helper function to safely end span
export const endSpan = (
  span: Span | null | undefined,
  attributes?: Attributes,
): void => {
  if (!span) {
    return;
  }
  if (attributes) {
    span.setAttributes(attributes);
  }
  span.end();
};

export { context };
