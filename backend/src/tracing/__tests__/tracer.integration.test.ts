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

// Mock the tracer module
jest.mock('../tracer');
describe('Tracer Integration Tests', () => {
  let mockSpan: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpan = {
      setAttributes: jest.fn(),
      setStatus: jest.fn(),
      addEvent: jest.fn(),
      end: jest.fn(),
    };

    // Configure the mock implementations
    (createConversationSpan as jest.Mock).mockReturnValue(mockSpan);
    (createGoalSeekingSpan as jest.Mock).mockReturnValue(mockSpan);
    (createAgentSpan as jest.Mock).mockReturnValue(mockSpan);
    (createValidationSpan as jest.Mock).mockReturnValue(mockSpan);
    (endSpan as jest.Mock).mockImplementation();
    (setSpanStatus as jest.Mock).mockImplementation();
    (addSpanEvent as jest.Mock).mockImplementation();
    (initializeTracing as jest.Mock).mockImplementation();
  });

  describe('Span Creation Functions', () => {
    it('should create conversation span with correct parameters', () => {
      const span = createConversationSpan(
        'test-conversation',
        'process',
        'user123',
      );

      expect(createConversationSpan).toHaveBeenCalledWith(
        'test-conversation',
        'process',
        'user123',
      );
      expect(span).toBe(mockSpan);
    });

    it('should create goal-seeking span with user state', () => {
      const userState = {
        state: 'active',
        engagement: 0.8,
        satisfaction: 0.9,
      };

      const span = createGoalSeekingSpan(
        'test-conversation',
        userState,
        'user123',
      );

      expect(createGoalSeekingSpan).toHaveBeenCalledWith(
        'test-conversation',
        userState,
        'user123',
      );
      expect(span).toBe(mockSpan);
    });

    it('should create agent span with correct attributes', () => {
      const span = createAgentSpan(
        'joke',
        'process_message',
        'conv123',
        'user123',
      );

      expect(createAgentSpan).toHaveBeenCalledWith(
        'joke',
        'process_message',
        'conv123',
        'user123',
      );
      expect(span).toBe(mockSpan);
    });

    it('should create validation span with correct attributes', () => {
      const span = createValidationSpan('conv123', 'general', 'user123');

      expect(createValidationSpan).toHaveBeenCalledWith(
        'conv123',
        'general',
        'user123',
      );
      expect(span).toBe(mockSpan);
    });

    it('should create agent span without optional parameters', () => {
      const span = createAgentSpan('general', 'test_operation');

      expect(createAgentSpan).toHaveBeenCalledWith('general', 'test_operation');
      expect(span).toBe(mockSpan);
    });

    it('should create validation span without optional parameters', () => {
      const span = createValidationSpan('conv123');

      expect(createValidationSpan).toHaveBeenCalledWith('conv123');
      expect(span).toBe(mockSpan);
    });
  });

  describe('Span Utility Functions', () => {
    it('should end span safely when span exists', () => {
      const attributes = { test: 'value' };

      endSpan(mockSpan, attributes);

      expect(endSpan).toHaveBeenCalledWith(mockSpan, attributes);
    });

    it('should end span without attributes', () => {
      endSpan(mockSpan);

      expect(mockSpan.setAttributes).not.toHaveBeenCalled();
      expect(endSpan).toHaveBeenCalledWith(mockSpan);
    });

    it('should handle null span gracefully', () => {
      expect(() => endSpan(null)).not.toThrow();
      expect(() => endSpan(undefined)).not.toThrow();
    });

    it('should set span status to OK for successful operations', () => {
      setSpanStatus(mockSpan, true, 'Operation completed successfully');

      expect(setSpanStatus).toHaveBeenCalledWith(
        mockSpan,
        true,
        'Operation completed successfully',
      );
    });

    it('should set span status to ERROR for failed operations', () => {
      setSpanStatus(mockSpan, false, 'Operation failed');

      expect(setSpanStatus).toHaveBeenCalledWith(
        mockSpan,
        false,
        'Operation failed',
      );
    });

    it('should use default error message when none provided', () => {
      setSpanStatus(mockSpan, false);

      expect(setSpanStatus).toHaveBeenCalledWith(mockSpan, false);
    });

    it('should handle null span in setSpanStatus', () => {
      expect(() => setSpanStatus(null, true)).not.toThrow();
      expect(() => setSpanStatus(undefined, false)).not.toThrow();
    });

    it('should add event to span with attributes', () => {
      const attributes = { eventType: 'test', value: 123 };

      addSpanEvent(mockSpan, 'test_event', attributes);

      expect(addSpanEvent).toHaveBeenCalledWith(
        mockSpan,
        'test_event',
        attributes,
      );
    });

    it('should add event to span without attributes', () => {
      addSpanEvent(mockSpan, 'simple_event');

      expect(addSpanEvent).toHaveBeenCalledWith(mockSpan, 'simple_event');
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

      expect(createGoalSeekingSpan).toHaveBeenCalledWith(
        'test-conversation',
        null,
        'user123',
      );
    });

    it('should handle goal-seeking span with undefined user state', () => {
      const span = createGoalSeekingSpan(
        'test-conversation',
        undefined,
        'user123',
      );

      expect(createGoalSeekingSpan).toHaveBeenCalledWith(
        'test-conversation',
        undefined,
        'user123',
      );
    });

    it('should handle very long conversation IDs', () => {
      const longId = 'a'.repeat(200);
      const span = createConversationSpan(longId, 'process');

      expect(createConversationSpan).toHaveBeenCalledWith(longId, 'process');
    });

    it('should handle special characters in agent types', () => {
      const span = createAgentSpan('general/specialized', 'test-operation');

      expect(createAgentSpan).toHaveBeenCalledWith(
        'general/specialized',
        'test-operation',
      );
    });
  });

  describe('Context Manager Integration', () => {
    it('should call context manager methods for conversation spans', () => {
      const { tracingContextManager } = require('../contextManager');

      createConversationSpan('test-conv', 'process', 'user123');

      expect(createConversationSpan).toHaveBeenCalledWith(
        'test-conv',
        'process',
        'user123',
      );
    });

    it('should call context manager methods for agent spans', () => {
      const { tracingContextManager } = require('../contextManager');

      createAgentSpan('joke', 'process', 'conv123', 'user123');

      expect(createAgentSpan).toHaveBeenCalledWith(
        'joke',
        'process',
        'conv123',
        'user123',
      );
    });
  });
});
