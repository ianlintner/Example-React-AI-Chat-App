import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  Span,
} from '@opentelemetry/api';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import { tracingContextManager } from './contextManager';

// Configure the trace exporter - FORCED TO USE ZIPKIN
const createTraceExporter = () => {
  console.log('🔍 TRACING DEBUG - Environment variables:');
  console.log('  ZIPKIN_ENDPOINT:', process.env.ZIPKIN_ENDPOINT);
  console.log('  OTEL_SERVICE_NAME:', process.env.OTEL_SERVICE_NAME);
  console.log('  ENABLE_TRACING:', process.env.ENABLE_TRACING);
  console.log('  NODE_ENV:', process.env.NODE_ENV);

  // FORCE ZIPKIN USAGE - Bypassing OTLP
  const zipkinEndpoint =
    process.env.ZIPKIN_ENDPOINT || 'http://zipkin:9411/api/v2/spans';
  console.log('🔗 FORCED to use Zipkin exporter:', zipkinEndpoint);
  console.log('🔍 Testing Zipkin connection...');

  const zipkinExporter = new ZipkinExporter({
    url: zipkinEndpoint,
  });

  // Log when traces are being exported to Zipkin
  const originalExport = zipkinExporter.export.bind(zipkinExporter);
  zipkinExporter.export = (spans: any, resultCallback: any) => {
    console.log(
      `🔍 ZIPKIN EXPORT: Attempting to send ${spans.length} spans to ${zipkinEndpoint}`,
    );
    console.log(
      `🔍 ZIPKIN EXPORT: Current timestamp: ${new Date().toISOString()}`,
    );

    spans.forEach((span: any, index: number) => {
      console.log(`  📊 Span ${index + 1}: ${span.name}`);
      console.log(`    - Trace ID: ${span.traceId}`);
      console.log(`    - Span ID: ${span.spanId}`);
      console.log(`    - Status: ${JSON.stringify(span.status)}`);
      console.log(`    - Attributes: ${JSON.stringify(span.attributes)}`);
    });

    return originalExport(spans, (result: any) => {
      console.log(`🔍 ZIPKIN EXPORT: Export attempt completed`);
      console.log(`🔍 ZIPKIN EXPORT: Result code: ${result.code}`);

      if (result.code === 0) {
        console.log('✅ ZIPKIN EXPORT: Successfully sent spans to Zipkin');
      } else {
        console.error(
          '❌ ZIPKIN EXPORT: Failed to send spans:',
          result.error || result.message || 'Unknown error',
        );
        console.error(
          '❌ ZIPKIN EXPORT: Full result:',
          JSON.stringify(result, null, 2),
        );
      }
      resultCallback(result);
    });
  };

  return zipkinExporter;
};

// Add console exporter for debugging
const createConsoleExporter = () => {
  console.log('🔍 Adding console exporter for debugging');
  return new ConsoleSpanExporter();
};

// Create span processors for direct OTLP export without buffering
const createSpanProcessors = () => {
  const processors = [];

  // Always add console exporter for debugging
  console.log('🔍 Adding console span processor for debugging');
  processors.push(new SimpleSpanProcessor(createConsoleExporter()));

  // Add main exporter with direct processing (no buffering)
  const mainExporter = createTraceExporter();
  console.log(
    '🔍 Adding direct span processor for immediate Zipkin export (no buffering)',
  );
  processors.push(new SimpleSpanProcessor(mainExporter));

  return processors;
};

// Create and configure the Node SDK with 100% sampling
const createSDK = () => {
  const serviceName =
    process.env.OTEL_SERVICE_NAME || 'ai-goal-seeking-backend';
  console.log('🔍 Creating Node SDK with service name:', serviceName);
  console.log('🔍 Configuring 100% trace sampling (AlwaysOnSampler)');

  return new NodeSDK({
    serviceName: serviceName,
    sampler: new AlwaysOnSampler(), // 100% sampling
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
export const initializeTracing = () => {
  try {
    console.log('🔍 Starting OpenTelemetry SDK initialization...');
    sdk.start();
    console.log('✅ OpenTelemetry tracing initialized successfully');

    // Create a test span to verify tracing is working
    createTestSpan();
  } catch (error) {
    console.error('❌ Error initializing OpenTelemetry tracing:', error);
    console.error('Stack trace:', (error as Error).stack);
  }
};

// Create a test span to verify tracing is working
const createTestSpan = () => {
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
) => {
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
) => {
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
) => {
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
  userState: any,
  userId?: string,
) => {
  const spanName = tracingContextManager.createSpanName(
    'goal_seeking',
    'process',
  );
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'conversation.id': conversationId,
      'goal_seeking.operation': 'process',
      'user.state': userState?.state || 'unknown',
      'user.engagement': userState?.engagement || 0,
      'user.satisfaction': userState?.satisfaction || 0,
    },
  });

  // Add standard attributes
  tracingContextManager.addStandardAttributes(span, {
    conversationId,
    userId,
    operation: 'goal_seeking.process',
    'user.state': userState?.state,
    'user.engagement': userState?.engagement,
    'user.satisfaction': userState?.satisfaction,
  });

  // Log trace context
  tracingContextManager.logCurrentTrace('goal_seeking.process');

  return span;
};

// Helper function to add span events
export const addSpanEvent = (
  span: any,
  name: string,
  attributes?: Record<string, any>,
) => {
  if (!span) return;
  span.addEvent(name, {
    timestamp: Date.now(),
    ...(attributes && attributes),
  });
};

// Helper function to set span status
export const setSpanStatus = (
  span: any,
  success: boolean,
  message?: string,
) => {
  if (!span) return;
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
export const endSpan = (span: any, attributes?: Record<string, any>) => {
  if (!span) return;
  if (attributes) {
    span.setAttributes(attributes);
  }
  span.end();
};

export { context };
