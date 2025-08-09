import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  createConversationSpan,
  createGoalSeekingSpan,
  createAgentSpan,
  createValidationSpan,
  endSpan,
  setSpanStatus,
  addSpanEvent,
  tracer,
  initializeTracing,
} from '../tracer';

// Mock OpenTelemetry
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => ({
        setAttributes: jest.fn(),
        setStatus: jest.fn(),
        addEvent: jest.fn(),
        end: jest.fn(),
      })),
    })),
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
}));

// Mock the context manager
jest.mock('../contextManager', () => ({
  tracingContextManager: {
    createSpanName: jest.fn((prefix, operation) => `${prefix}.${operation}`),
    addStandardAttributes: jest.fn(),
    logCurrentTrace: jest.fn(),
  },
}));

// Mock the SDK
jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
  })),
}));

jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: jest.fn(() => []),
}));

jest.mock('@opentelemetry/exporter-zipkin', () => ({
  ZipkinExporter: jest.fn().mockImplementation(() => ({
    export: jest.fn(),
  })),
}));

describe('Tracer Integration Tests', () => {
  let mockTracer: any;
  let mockSpan: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSpan = {
      setAttributes: jest.fn(),
      setStatus: jest.fn(),
      addEvent: jest.fn(),
      end: jest.fn(),
    };

    mockTracer = {
      startSpan: jest.fn(() => mockSpan),
    };

    (trace.getTracer as jest.Mock).mockReturnValue(mockTracer);
  });

  describe('Span Creation Functions', () => {
    it('should create conversation span with correct parameters', () => {
      const span = createConversationSpan('test-conversation', 'process', 'user123');

      expect(mockTracer.startSpan).toHaveBeenCalledWith('conversation.process', {
        kind: 1, // SpanKind.SERVER
        attributes: {
          'conversation.id': 'test-conversation',
          'conversation.operation': 'process',
        },
      });
      expect(span).toBe(mockSpan);
    });

    it('should create goal-seeking span with user state', () => {
      const userState = {
        state: 'active',
        engagement: 0.8,
        satisfaction: 0.9,
      };
      
      const span = createGoalSeekingSpan('test-conversation', userState, 'user123');

      expect(mockTracer.startSpan).toHaveBeenCalledWith('goal_seeking.process', {
        kind: 0, // SpanKind.INTERNAL
        attributes: {
          'conversation.id': 'test-conversation',
          'goal_seeking.operation': 'process',
          'user.state': 'active',
          'user.engagement': 0.8,
          'user.satisfaction': 0.9,
        },
      });
      expect(span).toBe(mockSpan);
    });

    it('should create agent span with correct attributes', () => {
      const span = createAgentSpan('joke', 'process_message', 'conv123', 'user123');

      expect(mockTracer.startSpan).toHaveBeenCalledWith('agent.joke.process_message', {
        kind: 0, // SpanKind.INTERNAL
        attributes: {
          'agent.type': 'joke',
          'agent.operation': 'process_message',
          'conversation.id': 'conv123',
        },
      });
      expect(span).toBe(mockSpan);
    });

    it('should create validation span with correct attributes', () => {
      const span = createValidationSpan('conv123', 'general', 'user123');

      expect(mockTracer.startSpan).toHaveBeenCalledWith('validation.validate_response', {
        kind: 0, // SpanKind.INTERNAL
        attributes: {
          'conversation.id': 'conv123',
          'validation.operation': 'validate_response',
          'agent.type': 'general',
        },
      });
      expect(span).toBe(mockSpan);
    });

    it('should create agent span without optional parameters', () => {
      const span = createAgentSpan('general', 'test_operation');

      expect(mockTracer.startSpan).toHaveBeenCalledWith('agent.general.test_operation', {
        kind: 0, // SpanKind.INTERNAL
        attributes: {
          'agent.type': 'general',
          'agent.operation': 'test_operation',
        },
      });
      expect(span).toBe(mockSpan);
    });

    it('should create validation span without optional parameters', () => {
      const span = createValidationSpan('conv123');

      expect(mockTracer.startSpan).toHaveBeenCalledWith('validation.validate_response', {
        kind: 0, // SpanKind.INTERNAL
        attributes: {
          'conversation.id': 'conv123',
          'validation.operation': 'validate_response',
        },
      });
      expect(span).toBe(mockSpan);
    });
  });

  describe('Span Utility Functions', () => {
    it('should end span safely when span exists', () => {
      const attributes = { test: 'value' };
      
      endSpan(mockSpan, attributes);
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(attributes);
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should end span without attributes', () => {
      endSpan(mockSpan);
      
      expect(mockSpan.setAttributes).not.toHaveBeenCalled();
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should handle null span gracefully', () => {
      expect(() => endSpan(null)).not.toThrow();
      expect(() => endSpan(undefined)).not.toThrow();
    });

    it('should set span status to OK for successful operations', () => {
      setSpanStatus(mockSpan, true, 'Operation completed successfully');
      
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.OK,
      });
    });

    it('should set span status to ERROR for failed operations', () => {
      setSpanStatus(mockSpan, false, 'Operation failed');
      
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Operation failed',
      });
    });

    it('should use default error message when none provided', () => {
      setSpanStatus(mockSpan, false);
      
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Operation failed',
      });
    });

    it('should handle null span in setSpanStatus', () => {
      expect(() => setSpanStatus(null, true)).not.toThrow();
      expect(() => setSpanStatus(undefined, false)).not.toThrow();
    });

    it('should add event to span with attributes', () => {
      const attributes = { eventType: 'test', value: 123 };
      
      addSpanEvent(mockSpan, 'test_event', attributes);
      
      expect(mockSpan.addEvent).toHaveBeenCalledWith('test_event', {
        timestamp: expect.any(Number),
        eventType: 'test',
        value: 123,
      });
    });

    it('should add event to span without attributes', () => {
      addSpanEvent(mockSpan, 'simple_event');
      
      expect(mockSpan.addEvent).toHaveBeenCalledWith('simple_event', {
        timestamp: expect.any(Number),
      });
    });

    it('should handle null span in addSpanEvent', () => {
      expect(() => addSpanEvent(null, 'test_event')).not.toThrow();
      expect(() => addSpanEvent(undefined, 'test_event')).not.toThrow();
    });
  });

  describe('Tracer Instance', () => {
    it('should provide tracer instance', () => {
      expect(tracer).toBeDefined();
    });

    it('should initialize tracing without errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => initializeTracing()).not.toThrow();
      
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle goal-seeking span with null user state', () => {
      const span = createGoalSeekingSpan('test-conversation', null, 'user123');
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith('goal_seeking.process', {
        kind: 0,
        attributes: {
          'conversation.id': 'test-conversation',
          'goal_seeking.operation': 'process',
          'user.state': 'unknown',
          'user.engagement': 0,
          'user.satisfaction': 0,
        },
      });
    });

    it('should handle goal-seeking span with undefined user state', () => {
      const span = createGoalSeekingSpan('test-conversation', undefined, 'user123');
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith('goal_seeking.process', {
        kind: 0,
        attributes: {
          'conversation.id': 'test-conversation',
          'goal_seeking.operation': 'process',
          'user.state': 'unknown',
          'user.engagement': 0,
          'user.satisfaction': 0,
        },
      });
    });

    it('should handle very long conversation IDs', () => {
      const longId = 'a'.repeat(200);
      const span = createConversationSpan(longId, 'process');
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith('conversation.process', {
        kind: 1,
        attributes: {
          'conversation.id': longId,
          'conversation.operation': 'process',
        },
      });
    });

    it('should handle special characters in agent types', () => {
      const span = createAgentSpan('general/specialized', 'test-operation');
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith('agent.general/specialized.test-operation', {
        kind: 0,
        attributes: {
          'agent.type': 'general/specialized',
          'agent.operation': 'test-operation',
        },
      });
    });
  });

  describe('Context Manager Integration', () => {
    it('should call context manager methods for conversation spans', () => {
      const { tracingContextManager } = require('../contextManager');
      
      createConversationSpan('test-conv', 'process', 'user123');
      
      expect(tracingContextManager.createSpanName).toHaveBeenCalledWith('conversation', 'process');
      expect(tracingContextManager.addStandardAttributes).toHaveBeenCalledWith(mockSpan, {
        conversationId: 'test-conv',
        userId: 'user123',
        operation: 'conversation.process',
      });
      expect(tracingContextManager.logCurrentTrace).toHaveBeenCalledWith('conversation.process');
    });

    it('should call context manager methods for agent spans', () => {
      const { tracingContextManager } = require('../contextManager');
      
      createAgentSpan('joke', 'process', 'conv123', 'user123');
      
      expect(tracingContextManager.createSpanName).toHaveBeenCalledWith('agent', 'joke.process');
      expect(tracingContextManager.addStandardAttributes).toHaveBeenCalledWith(mockSpan, {
        agentType: 'joke',
        conversationId: 'conv123',
        userId: 'user123',
        operation: 'agent.joke.process',
      });
      expect(tracingContextManager.logCurrentTrace).toHaveBeenCalledWith('agent.joke.process');
    });
  });
});
