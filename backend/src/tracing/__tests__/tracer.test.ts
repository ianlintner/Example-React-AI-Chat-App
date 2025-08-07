// Mock OpenTelemetry dependencies before importing
const mockSpan = {
  setAttributes: jest.fn(),
  setStatus: jest.fn(),
  addEvent: jest.fn(),
  end: jest.fn(),
};

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => mockSpan),
    })),
  },
  context: {
    active: jest.fn(() => ({})),
    with: jest.fn((ctx, fn) => fn()),
  },
  createContextKey: jest.fn(() => ({
    ROOT_CONTEXT: {},
  })),
  ROOT_CONTEXT: {},
  SpanKind: {
    SERVER: 1,
    INTERNAL: 2,
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
}));

jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: jest.fn(() => []),
}));

jest.mock('@opentelemetry/exporter-zipkin', () => ({
  ZipkinExporter: jest.fn().mockImplementation(() => ({
    export: jest.fn(),
  })),
}));

jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
  })),
}));

jest.mock('@opentelemetry/sdk-trace-base', () => ({
  ConsoleSpanExporter: jest.fn(),
  BatchSpanProcessor: jest.fn(),
  SimpleSpanProcessor: jest.fn(),
  AlwaysOnSampler: jest.fn(),
}));

// Mock the context manager
jest.mock('../contextManager', () => ({
  tracingContextManager: {
    createSpanName: jest.fn((type, operation) => `${type}.${operation}`),
    addStandardAttributes: jest.fn(),
    logCurrentTrace: jest.fn(),
  },
}));

import {
  tracer,
  createConversationSpan,
  createAgentSpan,
  endSpan,
  setSpanStatus,
  addSpanEvent,
} from '../tracer';

describe('Tracer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock span functions
    mockSpan.setAttributes.mockClear();
    mockSpan.setStatus.mockClear();
    mockSpan.addEvent.mockClear();
    mockSpan.end.mockClear();
  });

  describe('createConversationSpan', () => {
    it('should create a span with conversation context', () => {
      const span = createConversationSpan('conv-123', 'process_message');
      
      expect(span).toBeDefined();
      expect(span.setAttributes).toBeDefined();
      expect(span.end).toBeDefined();
    });

    it('should handle span creation with different operations', () => {
      const spans = [
        createConversationSpan('conv-1', 'create'),
        createConversationSpan('conv-2', 'update'),
        createConversationSpan('conv-3', 'delete'),
      ];

      spans.forEach(span => {
        expect(span).toBeDefined();
        expect(typeof span.setAttributes).toBe('function');
      });
    });
  });

  describe('createAgentSpan', () => {
    it('should create a span with agent context', () => {
      const span = createAgentSpan('joke', 'process_message', 'conv-123');
      
      expect(span).toBeDefined();
      expect(span.setAttributes).toBeDefined();
      expect(span.end).toBeDefined();
    });

    it('should handle different agent types', () => {
      const spans = [
        createAgentSpan('joke', 'generate', 'conv-1'),
        createAgentSpan('trivia', 'search', 'conv-2'),
        createAgentSpan('gif', 'find', 'conv-3'),
      ];

      spans.forEach(span => {
        expect(span).toBeDefined();
        expect(typeof span.setAttributes).toBe('function');
      });
    });
  });

  describe('span operations', () => {
    it('should end span without error', () => {
      const span = createConversationSpan('conv-1', 'test');
      
      expect(() => endSpan(span)).not.toThrow();
      expect(span.end).toHaveBeenCalled();
    });

    it('should set span status', () => {
      const span = createConversationSpan('conv-1', 'test');
      
      setSpanStatus(span, true);
      expect(span.setStatus).toHaveBeenCalled();

      setSpanStatus(span, false, 'Error message');
      expect(span.setStatus).toHaveBeenCalledTimes(2);
    });

    it('should add span events', () => {
      const span = createConversationSpan('conv-1', 'test');
      const eventData = { key: 'value', count: 123 };
      
      addSpanEvent(span, 'test.event', eventData);
      expect(span.addEvent).toHaveBeenCalledWith('test.event', {
        timestamp: expect.any(Number),
        ...eventData,
      });
    });
  });

  describe('error handling', () => {
    it('should handle missing span gracefully', () => {
      expect(() => endSpan(null as any)).not.toThrow();
      expect(() => setSpanStatus(null as any, true)).not.toThrow();
      expect(() => addSpanEvent(null as any, 'event', {})).not.toThrow();
    });
  });
});
