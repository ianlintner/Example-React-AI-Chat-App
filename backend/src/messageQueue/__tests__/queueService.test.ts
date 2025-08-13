import { Server as SocketServer } from 'socket.io';
import { QueueService, createQueueService, getQueueService } from '../queueService';
import { MessageQueue, QUEUE_NAMES } from '../messageQueue';
import { QueueMessage, ChatMessagePayload, AgentResponsePayload, ProactiveActionPayload, StreamChunkPayload } from '../types';

// Mock the messageQueue module
jest.mock('../messageQueue');

// Mock socket.io
const mockSocketServer = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
} as any;

const mockMessageQueue = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getProviderType: jest.fn().mockReturnValue('memory'),
  subscribe: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  createMessage: jest.fn(),
  enqueue: jest.fn().mockResolvedValue(undefined),
  getStats: jest.fn().mockResolvedValue({}),
  getQueueSize: jest.fn().mockResolvedValue(0),
  purgeQueue: jest.fn().mockResolvedValue(undefined),
  isHealthy: jest.fn().mockResolvedValue(true),
} as any;

const mockCreateMessageQueue = jest.fn().mockReturnValue(mockMessageQueue);

// Mock the createMessageQueue function
(require('../messageQueue') as any).createMessageQueue = mockCreateMessageQueue;

describe('QueueService', () => {
  let queueService: QueueService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance before each test
    const queueServiceModule = require('../queueService');
    (queueServiceModule as any).queueServiceInstance = null;
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    queueService = new QueueService(mockSocketServer);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with socket server and message queue', () => {
      expect(queueService).toBeInstanceOf(QueueService);
      expect(mockCreateMessageQueue).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should connect to message queue and setup handlers', async () => {
      await queueService.initialize();

      expect(mockMessageQueue.connect).toHaveBeenCalled();
      expect(mockMessageQueue.on).toHaveBeenCalledWith('deadLetter', expect.any(Function));
      expect(mockMessageQueue.subscribe).toHaveBeenCalledTimes(4);
      expect(mockMessageQueue.subscribe).toHaveBeenCalledWith(QUEUE_NAMES.CHAT_MESSAGES, expect.any(Function));
      expect(mockMessageQueue.subscribe).toHaveBeenCalledWith(QUEUE_NAMES.AGENT_RESPONSES, expect.any(Function));
      expect(mockMessageQueue.subscribe).toHaveBeenCalledWith(QUEUE_NAMES.PROACTIVE_ACTIONS, expect.any(Function));
      expect(mockMessageQueue.subscribe).toHaveBeenCalledWith(QUEUE_NAMES.STREAM_CHUNKS, expect.any(Function));
      expect(consoleSpy).toHaveBeenCalledWith('📨 Queue Service initialized with provider:', 'memory');
    });

    it('should handle dead letter queue events', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await queueService.initialize();

      // Get the dead letter handler that was registered
      const deadLetterHandler = mockMessageQueue.on.mock.calls.find((call: any) => call[0] === 'deadLetter')[1];
      
      // Simulate a dead letter event
      const mockEvent = {
        queueName: 'test-queue',
        message: { id: 'test-msg-123' },
        error: new Error('Test error')
      };
      
      deadLetterHandler(mockEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '💀 Dead letter message in test-queue:',
        'test-msg-123',
        mockEvent.error
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('shutdown', () => {
    it('should disconnect from message queue', async () => {
      await queueService.shutdown();

      expect(mockMessageQueue.disconnect).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('📨 Queue Service shut down');
    });
  });

  describe('queue handlers', () => {
    beforeEach(async () => {
      await queueService.initialize();
    });

    it('should handle chat messages', async () => {
      const chatHandler = mockMessageQueue.subscribe.mock.calls.find(
        (call: any) => call[0] === QUEUE_NAMES.CHAT_MESSAGES
      )[1];

      const mockMessage: QueueMessage = {
        id: 'msg-123',
        type: 'chat_message',
        payload: {
          userId: 'user-123',
          conversationId: 'conv-123',
          message: 'Hello world'
        } as ChatMessagePayload,
        timestamp: new Date(),
        priority: 5,
        retryCount: 0,
        maxRetries: 3
      };

      await chatHandler(mockMessage);

      expect(mockSocketServer.to).toHaveBeenCalledWith('conv-123');
      expect(mockSocketServer.emit).toHaveBeenCalledWith('queue_processed_chat', {
        messageId: 'msg-123',
        userId: 'user-123',
        message: 'Hello world',
        timestamp: mockMessage.timestamp
      });
    });

    it('should handle agent responses', async () => {
      const agentHandler = mockMessageQueue.subscribe.mock.calls.find(
        (call: any) => call[0] === QUEUE_NAMES.AGENT_RESPONSES
      )[1];

      const mockMessage: QueueMessage = {
        id: 'msg-123',
        type: 'agent_response',
        payload: {
          conversationId: 'conv-123',
          messageId: 'orig-msg-123',
          content: 'Agent response',
          agentUsed: 'general',
          confidence: 0.95
        } as AgentResponsePayload,
        timestamp: new Date(),
        priority: 6,
        retryCount: 0,
        maxRetries: 3
      };

      await agentHandler(mockMessage);

      expect(mockSocketServer.to).toHaveBeenCalledWith('conv-123');
      expect(mockSocketServer.emit).toHaveBeenCalledWith('queue_processed_agent_response', {
        messageId: 'orig-msg-123',
        content: 'Agent response',
        agentUsed: 'general',
        confidence: 0.95,
        timestamp: mockMessage.timestamp
      });
    });

    it('should handle proactive actions', async () => {
      const proactiveHandler = mockMessageQueue.subscribe.mock.calls.find(
        (call: any) => call[0] === QUEUE_NAMES.PROACTIVE_ACTIONS
      )[1];

      const mockMessage: QueueMessage = {
        id: 'msg-123',
        type: 'proactive_action',
        payload: {
          conversationId: 'conv-123',
          actionType: 'greeting',
          agentType: 'general',
          message: 'Proactive message'
        } as ProactiveActionPayload,
        timestamp: new Date(),
        priority: 7,
        retryCount: 0,
        maxRetries: 3
      };

      await proactiveHandler(mockMessage);

      expect(mockSocketServer.to).toHaveBeenCalledWith('conv-123');
      expect(mockSocketServer.emit).toHaveBeenCalledWith('queue_processed_proactive_action', {
        actionType: 'greeting',
        agentType: 'general',
        message: 'Proactive message',
        priority: 7,
        timestamp: mockMessage.timestamp
      });
    });

    it('should handle stream chunks', async () => {
      const streamHandler = mockMessageQueue.subscribe.mock.calls.find(
        (call: any) => call[0] === QUEUE_NAMES.STREAM_CHUNKS
      )[1];

      const mockMessage: QueueMessage = {
        id: 'msg-123',
        type: 'stream_chunk',
        payload: {
          conversationId: 'conv-123',
          messageId: 'orig-msg-123',
          content: 'Stream chunk',
          isComplete: false
        } as StreamChunkPayload,
        timestamp: new Date(),
        priority: 8,
        retryCount: 0,
        maxRetries: 3
      };

      await streamHandler(mockMessage);

      expect(mockSocketServer.to).toHaveBeenCalledWith('conv-123');
      expect(mockSocketServer.emit).toHaveBeenCalledWith('queue_processed_stream_chunk', {
        messageId: 'orig-msg-123',
        content: 'Stream chunk',
        isComplete: false,
        timestamp: mockMessage.timestamp
      });
    });
  });

  describe('enqueue methods', () => {
    beforeEach(async () => {
      await queueService.initialize();
      mockMessageQueue.createMessage.mockReturnValue({ id: 'mock-msg-id' });
    });

    describe('enqueueChatMessage', () => {
      it('should enqueue chat message with default priority', async () => {
        const messageId = await queueService.enqueueChatMessage(
          'user-123',
          'conv-123',
          'Hello world'
        );

        expect(mockMessageQueue.createMessage).toHaveBeenCalledWith(
          'chat_message',
          {
            message: 'Hello world',
            userId: 'user-123',
            conversationId: 'conv-123',
            forceAgent: undefined,
            timestamp: expect.any(Date)
          },
          {
            userId: 'user-123',
            conversationId: 'conv-123',
            priority: 5
          }
        );

        expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
          QUEUE_NAMES.CHAT_MESSAGES,
          { id: 'mock-msg-id' }
        );

        expect(messageId).toBe('mock-msg-id');
      });

      it('should enqueue chat message with custom priority and force agent', async () => {
        await queueService.enqueueChatMessage(
          'user-123',
          'conv-123',
          'Hello world',
          'joke',
          8
        );

        expect(mockMessageQueue.createMessage).toHaveBeenCalledWith(
          'chat_message',
          expect.objectContaining({
            forceAgent: 'joke'
          }),
          expect.objectContaining({
            priority: 8
          })
        );
      });
    });

    describe('enqueueAgentResponse', () => {
      it('should enqueue agent response with higher default priority', async () => {
        const messageId = await queueService.enqueueAgentResponse(
          'Response content',
          'general',
          0.95,
          'user-123',
          'conv-123',
          'orig-msg-123'
        );

        expect(mockMessageQueue.createMessage).toHaveBeenCalledWith(
          'agent_response',
          {
            content: 'Response content',
            agentUsed: 'general',
            confidence: 0.95,
            userId: 'user-123',
            conversationId: 'conv-123',
            messageId: 'orig-msg-123',
            timestamp: expect.any(Date)
          },
          {
            userId: 'user-123',
            conversationId: 'conv-123',
            priority: 6
          }
        );

        expect(messageId).toBe('mock-msg-id');
      });

      it('should enqueue agent response with custom priority', async () => {
        await queueService.enqueueAgentResponse(
          'Response content',
          'general',
          0.95,
          'user-123',
          'conv-123',
          'orig-msg-123',
          9
        );

        expect(mockMessageQueue.createMessage).toHaveBeenCalledWith(
          'agent_response',
          expect.any(Object),
          expect.objectContaining({
            priority: 9
          })
        );
      });
    });

    describe('enqueueProactiveAction', () => {
      it('should enqueue immediate proactive action', async () => {
        const messageId = await queueService.enqueueProactiveAction(
          'greeting',
          'general',
          'Hello there!',
          'user-123',
          'conv-123'
        );

        expect(mockMessageQueue.createMessage).toHaveBeenCalledWith(
          'proactive_action',
          {
            actionType: 'greeting',
            agentType: 'general',
            message: 'Hello there!',
            userId: 'user-123',
            conversationId: 'conv-123',
            timing: 'immediate',
            delayMs: undefined,
            priority: 7
          },
          {
            userId: 'user-123',
            conversationId: 'conv-123',
            priority: 7,
            delayMs: undefined
          }
        );

        expect(messageId).toBe('mock-msg-id');
      });

      it('should enqueue delayed proactive action', async () => {
        await queueService.enqueueProactiveAction(
          'follow-up',
          'general',
          'Follow up message',
          'user-123',
          'conv-123',
          'delayed',
          5000,
          8
        );

        expect(mockMessageQueue.createMessage).toHaveBeenCalledWith(
          'proactive_action',
          expect.objectContaining({
            timing: 'delayed',
            delayMs: 5000,
            priority: 8
          }),
          expect.objectContaining({
            priority: 8,
            delayMs: 5000
          })
        );
      });
    });

    describe('enqueueStreamChunk', () => {
      it('should enqueue stream chunk with high priority', async () => {
        const messageId = await queueService.enqueueStreamChunk(
          'orig-msg-123',
          'conv-123',
          'Stream content',
          false,
          'user-123'
        );

        expect(mockMessageQueue.createMessage).toHaveBeenCalledWith(
          'stream_chunk',
          {
            messageId: 'orig-msg-123',
            conversationId: 'conv-123',
            content: 'Stream content',
            isComplete: false,
            userId: 'user-123'
          },
          {
            userId: 'user-123',
            conversationId: 'conv-123',
            priority: 8
          }
        );

        expect(messageId).toBe('mock-msg-id');
      });

      it('should enqueue stream chunk with custom priority', async () => {
        await queueService.enqueueStreamChunk(
          'orig-msg-123',
          'conv-123',
          'Stream content',
          true,
          'user-123',
          9
        );

        expect(mockMessageQueue.createMessage).toHaveBeenCalledWith(
          'stream_chunk',
          expect.objectContaining({
            isComplete: true
          }),
          expect.objectContaining({
            priority: 9
          })
        );
      });
    });
  });

  describe('queue management methods', () => {
    beforeEach(async () => {
      await queueService.initialize();
    });

    describe('getQueueStats', () => {
      it('should return stats for all queues when no queue name provided', async () => {
        const mockStats = { totalMessages: 10, processing: 2 };
        mockMessageQueue.getStats.mockResolvedValue(mockStats);

        const stats = await queueService.getQueueStats();

        expect(mockMessageQueue.getStats).toHaveBeenCalledWith(undefined);
        expect(stats).toBe(mockStats);
      });

      it('should return stats for specific queue when queue name provided', async () => {
        const mockStats = { totalMessages: 5, processing: 1 };
        mockMessageQueue.getStats.mockResolvedValue(mockStats);

        const stats = await queueService.getQueueStats(QUEUE_NAMES.CHAT_MESSAGES);

        expect(mockMessageQueue.getStats).toHaveBeenCalledWith(QUEUE_NAMES.CHAT_MESSAGES);
        expect(stats).toBe(mockStats);
      });
    });

    describe('getQueueSize', () => {
      it('should return queue size', async () => {
        mockMessageQueue.getQueueSize.mockResolvedValue(42);

        const size = await queueService.getQueueSize(QUEUE_NAMES.CHAT_MESSAGES);

        expect(mockMessageQueue.getQueueSize).toHaveBeenCalledWith(QUEUE_NAMES.CHAT_MESSAGES);
        expect(size).toBe(42);
      });
    });

    describe('purgeQueue', () => {
      it('should purge queue and log message', async () => {
        await queueService.purgeQueue(QUEUE_NAMES.CHAT_MESSAGES);

        expect(mockMessageQueue.purgeQueue).toHaveBeenCalledWith(QUEUE_NAMES.CHAT_MESSAGES);
        expect(consoleSpy).toHaveBeenCalledWith(`🧹 Purged queue: ${QUEUE_NAMES.CHAT_MESSAGES}`);
      });
    });

    describe('isHealthy', () => {
      it('should return health status', async () => {
        mockMessageQueue.isHealthy.mockResolvedValue(true);

        const isHealthy = await queueService.isHealthy();

        expect(mockMessageQueue.isHealthy).toHaveBeenCalled();
        expect(isHealthy).toBe(true);
      });
    });
  });

  describe('demonstrateQueueFeatures', () => {
    beforeEach(async () => {
      await queueService.initialize();
      mockMessageQueue.createMessage.mockReturnValue({ id: 'demo-msg-id' });
    });

    it('should enqueue demo messages with different priorities', async () => {
      await queueService.demonstrateQueueFeatures('user-123', 'conv-123');

      expect(mockMessageQueue.enqueue).toHaveBeenCalledTimes(5);
      expect(consoleSpy).toHaveBeenCalledWith('🎭 Demonstrating message queue features...');
      expect(consoleSpy).toHaveBeenCalledWith('🎭 Demo messages enqueued. Check the processing order!');
    });
  });

  describe('getProviderType', () => {
    it('should return provider type from message queue', () => {
      mockMessageQueue.getProviderType.mockReturnValue('redis');

      const providerType = queueService.getProviderType();

      expect(mockMessageQueue.getProviderType).toHaveBeenCalled();
      expect(providerType).toBe('redis');
    });
  });

  describe('switchProvider', () => {
    beforeEach(async () => {
      await queueService.initialize();
    });

    it('should switch from memory to redis provider', async () => {
      const newMockQueue = { ...mockMessageQueue };
      mockCreateMessageQueue.mockReturnValueOnce(newMockQueue);

      await queueService.switchProvider('redis', 'redis://localhost:6379');

      expect(mockMessageQueue.disconnect).toHaveBeenCalled();
      expect(mockCreateMessageQueue).toHaveBeenCalledWith({
        provider: 'redis',
        redis: { url: 'redis://localhost:6379' }
      });
      expect(newMockQueue.connect).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Switching from memory to redis');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Successfully switched to redis provider');
    });

    it('should switch to memory provider without redis URL', async () => {
      const newMockQueue = { ...mockMessageQueue };
      mockCreateMessageQueue.mockReturnValueOnce(newMockQueue);

      await queueService.switchProvider('memory');

      expect(mockCreateMessageQueue).toHaveBeenCalledWith({
        provider: 'memory',
        redis: { url: undefined }
      });
    });
  });
});

describe('QueueService singleton functions', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
    // Reset the singleton instance before each test
    const queueServiceModule = require('../queueService');
    (queueServiceModule as any).queueServiceInstance = null;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('createQueueService', () => {
    it('should create new instance if none exists', () => {
      const service1 = createQueueService(mockSocketServer);
      expect(service1).toBeInstanceOf(QueueService);
    });

    it('should return existing instance if already created', () => {
      const service1 = createQueueService(mockSocketServer);
      const service2 = createQueueService(mockSocketServer);
      expect(service1).toBe(service2);
    });
  });

  describe('getQueueService', () => {
    it('should return null if no instance exists', () => {
      expect(getQueueService()).toBeNull();
    });

    it('should return existing instance if created', () => {
      const createdService = createQueueService(mockSocketServer);
      const retrievedService = getQueueService();
      expect(retrievedService).toBe(createdService);
    });
  });
});
