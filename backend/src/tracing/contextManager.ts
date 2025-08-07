import { trace, context, SpanContext, Span, propagation } from '@opentelemetry/api';

export interface TraceInfo {
  traceId: string;
  spanId: string;
  traceFlags: number;
  isRemote?: boolean;
}

export class TracingContextManager {
  private static instance: TracingContextManager;
  
  public static getInstance(): TracingContextManager {
    if (!TracingContextManager.instance) {
      TracingContextManager.instance = new TracingContextManager();
    }
    return TracingContextManager.instance;
  }

  /**
   * Extract trace information from current context
   */
  getCurrentTraceInfo(): TraceInfo | null {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) {
      return null;
    }

    const spanContext = activeSpan.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
      isRemote: spanContext.isRemote
    };
  }

  /**
   * Create a child span with proper context propagation
   */
  createChildSpan(name: string, parentContext?: any): Span {
    const tracer = trace.getTracer('ai-goal-seeking-system', '1.0.0');
    
    if (parentContext) {
      return tracer.startSpan(name, {}, parentContext);
    }
    
    return tracer.startSpan(name);
  }

  /**
   * Execute a function within a span context
   */
  async withSpan<T>(
    span: Span, 
    fn: (span: Span, context: any) => Promise<T> | T
  ): Promise<T> {
    return context.with(trace.setSpan(context.active(), span), async () => {
      const activeContext = context.active();
      const traceInfo = this.getCurrentTraceInfo();
      
      // Add trace info as span attributes
      if (traceInfo) {
        span.setAttributes({
          'trace.id': traceInfo.traceId,
          'span.id': traceInfo.spanId,
          'trace.flags': traceInfo.traceFlags.toString()
        });
      }

      try {
        const result = await fn(span, activeContext);
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ 
          code: 2, // ERROR
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Execute function with context propagation from parent span
   */
  async withContext<T>(
    contextToUse: any,
    fn: () => Promise<T> | T
  ): Promise<T> {
    return context.with(contextToUse || context.active(), fn);
  }

  /**
   * Extract context from headers (for HTTP requests)
   */
  extractContextFromHeaders(headers: Record<string, string>): any {
    return propagation.extract(context.active(), headers);
  }

  /**
   * Inject context into headers (for outgoing requests)
   */
  injectContextIntoHeaders(headers: Record<string, string> = {}): Record<string, string> {
    propagation.inject(context.active(), headers);
    return headers;
  }

  /**
   * Create a root span for a new trace
   */
  createRootSpan(name: string, attributes?: Record<string, any>): Span {
    const tracer = trace.getTracer('ai-goal-seeking-system', '1.0.0');
    const span = tracer.startSpan(name, {
      kind: 1, // SERVER
      attributes: attributes
    });

    // Log trace creation
    const spanContext = span.spanContext();
    console.log(`🔍 TRACE: Created root span '${name}' with trace ID: ${spanContext.traceId}, span ID: ${spanContext.spanId}`);
    
    return span;
  }

  /**
   * Create a linked span (for operations that should be connected but in separate traces)
   */
  createLinkedSpan(name: string, links: SpanContext[]): Span {
    const tracer = trace.getTracer('ai-goal-seeking-system', '1.0.0');
    return tracer.startSpan(name, {
      kind: 1, // SERVER
      links: links.map(link => ({ context: link }))
    });
  }

  /**
   * Get current span context for linking
   */
  getCurrentSpanContext(): SpanContext | null {
    const activeSpan = trace.getActiveSpan();
    return activeSpan ? activeSpan.spanContext() : null;
  }

  /**
   * Log trace information for debugging
   */
  logCurrentTrace(operation: string): void {
    const traceInfo = this.getCurrentTraceInfo();
    if (traceInfo) {
      console.log(`🔍 TRACE [${operation}]: trace=${traceInfo.traceId}, span=${traceInfo.spanId}, flags=${traceInfo.traceFlags}`);
    } else {
      console.log(`🔍 TRACE [${operation}]: No active trace context`);
    }
  }

  /**
   * Ensure trace persistence across async boundaries
   */
  bindTraceToFunction<T extends (...args: any[]) => any>(
    fn: T,
    span?: Span
  ): T {
    const currentContext = context.active();
    const contextToUse = span ? trace.setSpan(currentContext, span) : currentContext;
    
    return ((...args: any[]) => {
      return context.with(contextToUse, () => fn(...args));
    }) as T;
  }

  /**
   * Create consistent span names across the application
   */
  createSpanName(service: string, operation: string, details?: string): string {
    if (details) {
      return `${service}.${operation}.${details}`;
    }
    return `${service}.${operation}`;
  }

  /**
   * Add consistent span attributes
   */
  addStandardAttributes(span: Span, attributes: {
    userId?: string;
    conversationId?: string;
    agentType?: string;
    operation?: string;
    [key: string]: any;
  }): void {
    const standardAttrs: Record<string, any> = {
      'service.name': 'ai-goal-seeking-backend',
      'service.version': '1.0.0',
      timestamp: new Date().toISOString()
    };

    if (attributes.userId) standardAttrs['user.id'] = attributes.userId;
    if (attributes.conversationId) standardAttrs['conversation.id'] = attributes.conversationId;
    if (attributes.agentType) standardAttrs['agent.type'] = attributes.agentType;
    if (attributes.operation) standardAttrs['operation.name'] = attributes.operation;

    // Add all custom attributes
    Object.keys(attributes).forEach(key => {
      if (attributes[key] !== undefined) {
        standardAttrs[key] = attributes[key];
      }
    });

    span.setAttributes(standardAttrs);
  }
}

// Export singleton instance
export const tracingContextManager = TracingContextManager.getInstance();
