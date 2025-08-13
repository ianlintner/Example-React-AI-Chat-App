import { Server } from 'socket.io';
import { setupSocketHandlers } from '../socketHandlers';
import { storage } from '../../storage/memoryStorage';
import { agentService } from '../../agents/agentService';
import { metrics } from '../../metrics/prometheus';
import * as tracer from '../../tracing/tracer';
import { tracingContextManager } from '../../tracing/contextManager';

// Mock dependencies
jest.mock('../../storage/memoryStorage');
jest.mock('../../agents/agentService');
jest.mock('../../metrics/prometheus');
jest.mock('../../tracing/tracer');
jest.mock('../../tracing/contextManager');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

// Ensure tests never hang indefinitely
const TEST_TIMEOUT = 10000;
jest.setTimeout(TEST_TIMEOUT);

// Utility to fail fast if a promise doesn't resolve
const withTimeout = <T>(p: Promise<T>, ms = TEST_TIMEOUT - 1000): Promise<T> => {
  let timer: NodeJS.Timeout;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Test timed out')), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
};

describe('Socket Handlers', () => {
  let mockIo: jest.Mocked<Server>;
  let mockSocket: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    
    // Mock socket
    mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      on: jest.fn(),
    };

    // Mock io
    mockIo = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    // Mock storage
    (storage.getConversation as jest.Mock).mockReturnValue(null);
    (storage.addConversation as jest.Mock).mockImplementation();

    // Mock agent service
    (agentService.initializeUserGoals as jest.Mock).mockImplementation();
    (agentService.initializeConversation as jest.Mock).mockImplementation();
    (agentService.getActiveAgentInfo as jest.Mock).mockReturnValue(null);
    (agentService.getConversationContext as jest.Mock).mockReturnValue(null);
    (agentService.getUserGoalState as jest.Mock).mockReturnValue(null);
    (agentService.getCurrentAgent as jest.Mock).mockReturnValue('general');
    (agentService.getAvailableAgents as jest.Mock).mockReturnValue(['general', 'joke']);
    (agentService.getQueuedActions as jest.Mock).mockResolvedValue([]);
    (agentService.executeProactiveAction as jest.Mock).mockResolvedValue({
      content: 'Proactive response',
      agentUsed: 'joke',
      confidence: 0.9,
    });
    (agentService.processMessageWithBothSystems as jest.Mock).mockResolvedValue({
      content: 'Test response',
      agentUsed: 'general',
      confidence: 0.8,
      proactiveActions: [],
    });

    // Mock metrics
    (metrics.activeConnections as any) = {
      inc: jest.fn(),
      dec: jest.fn(),
    };
    (metrics.chatMessagesTotal as any) = {
      inc: jest.fn(),
    };
    (metrics.agentResponseTime as any) = {
      observe: jest.fn(),
    };

    // Mock tracer
    (tracer.createConversationSpan as jest.Mock).mockReturnValue('mock-span');
    (tracer.createGoalSeekingSpan as jest.Mock).mockReturnValue('mock-goal-span');
    (tracer.addSpanEvent as jest.Mock).mockImplementation();
    (tracer.setSpanStatus as jest.Mock).mockImplementation();
    (tracer.endSpan as jest.Mock).mockImplementation();

    // Mock tracing context manager
    (tracingContextManager.withSpan as jest.Mock).mockImplementation(
      (span, callback) => {
        try {
          return Promise.resolve(callback(span, {}));
        } catch (error) {
          return Promise.reject(error);
        }
      }
    );

    // Set up environment
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    // Ensure we trigger disconnect to clear any setInterval/setTimeout created by the connection handler
    try {
      if (mockSocket && jest.isMockFunction(mockSocket.on)) {
        const disconnectCall = (mockSocket.on as jest.Mock).mock.calls.find(
          (call: any) => call[0] === 'disconnect'
        );
        if (disconnectCall) {
          const disconnectHandler = disconnectCall[1];
          disconnectHandler();
        }
      }
    } catch {
      // no-op
    }


    jest.clearAllMocks();
    jest.useRealTimers();
    
    // Cleanup any console spy if it exists
    if (jest.isMockFunction(console.log)) {
      (console.log as jest.Mock).mockRestore();
    }
    if (jest.isMockFunction(console.error)) {
      (console.error as jest.Mock).mockRestore();
    }
  });

  describe('setupSocketHandlers', () => {
    it('should set up socket handlers and return helper functions', () => {
      const result = setupSocketHandlers(mockIo);
      
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(result).toHaveProperty('emitToConversation');
      expect(typeof result.emitToConversation).toBe('function');
    });

    it('should log OpenAI API key status', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      setupSocketHandlers(mockIo);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'OpenAI API Key status:',
        'Present'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Connection Handler', () => {
    let connectionHandler: Function;
    
    beforeEach(() => {
      setupSocketHandlers(mockIo);
      
      // Get the connection handler
      connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      
      // Call the connection handler
      connectionHandler(mockSocket);
    });

    it('should handle new socket connection', () => {
      expect(metrics.activeConnections.inc).toHaveBeenCalled();
      expect(agentService.initializeUserGoals).toHaveBeenCalledWith('test-socket-id');
    });

    it('should set up socket event handlers', () => {
      expect(mockSocket.on).toHaveBeenCalledWith('join_conversation', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('leave_conversation', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('typing_start', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('typing_stop', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('message_read', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('stream_chat', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should set up periodic timers', () => {
      // Verify that socket connection setup is complete
      expect(agentService.initializeUserGoals).toHaveBeenCalledWith('test-socket-id');
      expect(metrics.activeConnections.inc).toHaveBeenCalled();
    });

    it('should properly clean up on disconnect', () => {
      // Get disconnect handler
      const disconnectCall = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      );
      const disconnectHandler = disconnectCall[1];
      
      // Simulate disconnect
      disconnectHandler();
      
      // Verify metrics are updated
      expect(metrics.activeConnections.dec).toHaveBeenCalled();
    });
  });

  describe('Join/Leave Conversation Handlers', () => {
    let joinHandler: Function;
    let leaveHandler: Function;

    beforeEach(() => {
      setupSocketHandlers(mockIo);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket);

      // Get handlers
      const joinCall = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'join_conversation'
      );
      const leaveCall = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'leave_conversation'
      );

      joinHandler = joinCall[1];
      leaveHandler = leaveCall[1];
    });

    it('should handle join_conversation event', () => {
      const conversationId = 'test-conversation-id';
      
      joinHandler(conversationId);
      
      expect(mockSocket.join).toHaveBeenCalledWith(conversationId);
    });

    it('should handle leave_conversation event', () => {
      const conversationId = 'test-conversation-id';
      
      leaveHandler(conversationId);
      
      expect(mockSocket.leave).toHaveBeenCalledWith(conversationId);
    });
  });

  describe('Typing Handlers', () => {
    let typingStartHandler: Function;
    let typingStopHandler: Function;

    beforeEach(() => {
      setupSocketHandlers(mockIo);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket);

      const typingStartCall = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'typing_start'
      );
      const typingStopCall = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'typing_stop'
      );

      typingStartHandler = typingStartCall[1];
      typingStopHandler = typingStopCall[1];
    });

    it('should handle typing_start event', () => {
      const data = { conversationId: 'test-conv', userName: 'TestUser' };
      
      typingStartHandler(data);
      
      expect(mockSocket.to).toHaveBeenCalledWith('test-conv');
      expect(mockSocket.emit).toHaveBeenCalledWith('user_typing', {
        userId: 'test-socket-id',
        userName: 'TestUser',
        isTyping: true,
      });
    });

    it('should handle typing_start event without userName', () => {
      const data = { conversationId: 'test-conv' };
      
      typingStartHandler(data);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('user_typing', {
        userId: 'test-socket-id',
        userName: 'Anonymous',
        isTyping: true,
      });
    });

    it('should handle typing_stop event', () => {
      const data = { conversationId: 'test-conv' };
      
      typingStopHandler(data);
      
      expect(mockSocket.to).toHaveBeenCalledWith('test-conv');
      expect(mockSocket.emit).toHaveBeenCalledWith('user_typing', {
        userId: 'test-socket-id',
        isTyping: false,
      });
    });
  });

  describe('Message Read Handler', () => {
    let messageReadHandler: Function;

    beforeEach(() => {
      setupSocketHandlers(mockIo);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket);

      const messageReadCall = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message_read'
      );
      messageReadHandler = messageReadCall[1];
    });

    it('should handle message_read event', () => {
      const data = { conversationId: 'test-conv', messageId: 'test-msg' };
      
      messageReadHandler(data);
      
      expect(mockSocket.to).toHaveBeenCalledWith('test-conv');
      expect(mockSocket.emit).toHaveBeenCalledWith('message_status', {
        messageId: 'test-msg',
        status: 'read',
        readBy: 'test-socket-id',
      });
    });
  });

  describe('Stream Chat Handler', () => {
    let streamChatHandler: Function;

    beforeEach(async () => {
      jest.useRealTimers();
      setupSocketHandlers(mockIo);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'connection'
      )[1];
      await connectionHandler(mockSocket);

      const streamChatCall = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'stream_chat'
      );
      streamChatHandler = streamChatCall[1];
    });

    afterEach(() => {
      // Get disconnect handler and call it to clean up timers
      const disconnectCall = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'disconnect'
      );
      if (disconnectCall) {
        const disconnectHandler = disconnectCall[1];
        disconnectHandler();
      }
    });

    it('should handle empty message', async () => {
      const data = { message: '', conversationId: 'test-conv' };
      
      await withTimeout(streamChatHandler(data));

      expect(mockSocket.emit).toHaveBeenCalledWith('stream_error', {
        message: 'Message is required',
        code: 'INVALID_REQUEST',
      });
    });

    it('should handle conversation not found', async () => {
      const data = { message: 'test message', conversationId: 'non-existent' };
      (storage.getConversation as jest.Mock).mockReturnValue(null);
      
      await withTimeout(streamChatHandler(data));

      expect(mockSocket.emit).toHaveBeenCalledWith('stream_error', {
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    });

    it('should create new conversation when no conversationId provided', async () => {
      const data = { message: 'test message' };
      
      await withTimeout(streamChatHandler(data));

      expect(storage.addConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mock-uuid',
          title: 'test message',
          messages: expect.any(Array),
        })
      );
      expect(mockSocket.join).toHaveBeenCalledWith('mock-uuid');
    });

    it('should use existing conversation when conversationId provided', async () => {
      const existingConversation = {
        id: 'existing-conv',
        title: 'Existing',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (storage.getConversation as jest.Mock).mockReturnValue(existingConversation);
      
      const data = { message: 'test message', conversationId: 'existing-conv' };
      
      await withTimeout(streamChatHandler(data));

      expect(storage.getConversation).toHaveBeenCalledWith('existing-conv');
      expect(agentService.processMessageWithBothSystems).toHaveBeenCalled();
    });

    it('should process message and emit streaming response', async () => {
      const data = { message: 'test message' };
      
      await withTimeout(streamChatHandler(data));

      expect(agentService.processMessageWithBothSystems).toHaveBeenCalledWith(
        'test-socket-id',
        'test message',
        [],
        'mock-uuid',
        undefined
      );
      
      expect(mockIo.to).toHaveBeenCalledWith('mock-uuid');
      expect(mockIo.emit).toHaveBeenCalledWith('stream_start', expect.any(Object));
      expect(mockIo.emit).toHaveBeenCalledWith('stream_chunk', expect.any(Object));
      expect(mockIo.emit).toHaveBeenCalledWith('stream_complete', expect.any(Object));
    });

    it('should handle agent service errors', async () => {
      const data = { message: 'test message' };
      (agentService.processMessageWithBothSystems as jest.Mock).mockRejectedValue(
        new Error('Agent service error')
      );
      
      // Suppress console.error during this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await withTimeout(streamChatHandler(data));

      expect(mockSocket.emit).toHaveBeenCalledWith('stream_error', {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle proactive actions', async () => {
      const data = { message: 'test message' };
      const proactiveActions = [
        {
          type: 'entertainment',
          timing: 'immediate',
          agentType: 'joke',
          message: 'Want to hear a joke?',
        },
      ];
      
      (agentService.processMessageWithBothSystems as jest.Mock).mockResolvedValue({
        content: 'Test response',
        agentUsed: 'general',
        confidence: 0.8,
        proactiveActions,
      });
      
      (agentService.executeProactiveAction as jest.Mock).mockResolvedValue({
        content: 'Here is a joke!',
        agentUsed: 'joke',
        confidence: 0.9,
      });
      
      await withTimeout(streamChatHandler(data));

      expect(agentService.executeProactiveAction).toHaveBeenCalledWith(
        'test-socket-id',
        proactiveActions[0],
        expect.any(Array)
      );
    });

    it('should track metrics during message processing', async () => {
      const data = { message: 'test message' };
      
      await withTimeout(streamChatHandler(data));

      expect(metrics.chatMessagesTotal.inc).toHaveBeenCalledWith({
        type: 'user',
        agent_type: 'incoming',
      });
      expect(metrics.chatMessagesTotal.inc).toHaveBeenCalledWith({
        type: 'assistant',
        agent_type: 'general',
      });
      expect(metrics.agentResponseTime.observe).toHaveBeenCalledWith(
        { agent_type: 'general', success: 'true' },
        expect.any(Number)
      );
    });
  });

  describe('Disconnect Handler', () => {
    let disconnectHandler: Function;

    beforeEach(() => {
      setupSocketHandlers(mockIo);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket);

      const disconnectCall = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      );
      disconnectHandler = disconnectCall[1];
    });

    it('should handle socket disconnection', () => {
      disconnectHandler();
      
      expect(metrics.activeConnections.dec).toHaveBeenCalled();
    });
  });

  describe('Error Handler', () => {
    let errorHandler: Function;

    beforeEach(() => {
      setupSocketHandlers(mockIo);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket);

      const errorCall = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'error'
      );
      errorHandler = errorCall[1];
    });

    it('should handle socket errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Socket error');
      
      errorHandler(error);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Socket error from test-socket-id:',
        error
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Helper Functions', () => {
    it('should provide emitToConversation helper', () => {
      const { emitToConversation } = setupSocketHandlers(mockIo);
      
      emitToConversation('test-conv', 'test-event', { data: 'test' });
      
      expect(mockIo.to).toHaveBeenCalledWith('test-conv');
      expect(mockIo.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });
  });
});
