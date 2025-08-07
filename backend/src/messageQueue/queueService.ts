import { Server as SocketServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { MessageQueue, QUEUE_NAMES, createMessageQueue } from './messageQueue';
import { 
  QueueMessage, 
  ChatMessagePayload, 
  AgentResponsePayload, 
  ProactiveActionPayload, 
  StreamChunkPayload 
} from './types';

export class QueueService {
  private messageQueue: MessageQueue;
  private io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
    this.messageQueue = createMessageQueue();
  }

  async initialize(): Promise<void> {
    await this.messageQueue.connect();
    console.log('📨 Queue Service initialized with provider:', this.messageQueue.getProviderType());
    
    // Set up queue handlers
    await this.setupQueueHandlers();
    
    // Listen for dead letter queue events
    this.messageQueue.on('deadLetter', ({ queueName, message, error }) => {
      console.error(`💀 Dead letter message in ${queueName}:`, message.id, error);
      // You could integrate with external monitoring systems here
    });
  }

  async shutdown(): Promise<void> {
    await this.messageQueue.disconnect();
    console.log('📨 Queue Service shut down');
  }

  private async setupQueueHandlers(): Promise<void> {
    // Chat message processing
    await this.messageQueue.subscribe(QUEUE_NAMES.CHAT_MESSAGES, async (message: QueueMessage) => {
      const payload = message.payload as ChatMessagePayload;
      console.log(`🔄 Processing chat message from queue: ${message.id}`);
      
      // This is where you'd integrate with your existing agent service
      // For now, we'll just emit to the socket as an example
      this.io.to(payload.conversationId).emit('queue_processed_chat', {
        messageId: message.id,
        userId: payload.userId,
        message: payload.message,
        timestamp: message.timestamp
      });
    });

    // Agent response processing
    await this.messageQueue.subscribe(QUEUE_NAMES.AGENT_RESPONSES, async (message: QueueMessage) => {
      const payload = message.payload as AgentResponsePayload;
      console.log(`🤖 Processing agent response from queue: ${message.id}`);
      
      this.io.to(payload.conversationId).emit('queue_processed_agent_response', {
        messageId: payload.messageId,
        content: payload.content,
        agentUsed: payload.agentUsed,
        confidence: payload.confidence,
        timestamp: message.timestamp
      });
    });

    // Proactive action processing  
    await this.messageQueue.subscribe(QUEUE_NAMES.PROACTIVE_ACTIONS, async (message: QueueMessage) => {
      const payload = message.payload as ProactiveActionPayload;
      console.log(`🎯 Processing proactive action from queue: ${message.id} (${payload.actionType})`);
      
      // Emit proactive action to specific user
      this.io.to(payload.conversationId).emit('queue_processed_proactive_action', {
        actionType: payload.actionType,
        agentType: payload.agentType,
        message: payload.message,
        priority: message.priority,
        timestamp: message.timestamp
      });
    });

    // Stream chunk processing
    await this.messageQueue.subscribe(QUEUE_NAMES.STREAM_CHUNKS, async (message: QueueMessage) => {
      const payload = message.payload as StreamChunkPayload;
      console.log(`📝 Processing stream chunk from queue: ${message.id}`);
      
      this.io.to(payload.conversationId).emit('queue_processed_stream_chunk', {
        messageId: payload.messageId,
        content: payload.content,
        isComplete: payload.isComplete,
        timestamp: message.timestamp
      });
    });

    console.log('📨 Queue handlers set up for all queues');
  }

  // Public methods to enqueue different types of messages

  async enqueueChatMessage(
    userId: string, 
    conversationId: string, 
    message: string, 
    forceAgent?: string,
    priority?: number
  ): Promise<string> {
    const queueMessage = this.messageQueue.createMessage(
      'chat_message',
      {
        message,
        userId,
        conversationId,
        forceAgent,
        timestamp: new Date()
      } as ChatMessagePayload,
      {
        userId,
        conversationId,
        priority: priority || 5
      }
    );

    await this.messageQueue.enqueue(QUEUE_NAMES.CHAT_MESSAGES, queueMessage);
    console.log(`📨 Enqueued chat message: ${queueMessage.id}`);
    return queueMessage.id;
  }

  async enqueueAgentResponse(
    content: string,
    agentUsed: string,
    confidence: number,
    userId: string,
    conversationId: string,
    messageId: string,
    priority?: number
  ): Promise<string> {
    const queueMessage = this.messageQueue.createMessage(
      'agent_response',
      {
        content,
        agentUsed,
        confidence,
        userId,
        conversationId,
        messageId,
        timestamp: new Date()
      } as AgentResponsePayload,
      {
        userId,
        conversationId,
        priority: priority || 6 // Agent responses have higher priority
      }
    );

    await this.messageQueue.enqueue(QUEUE_NAMES.AGENT_RESPONSES, queueMessage);
    console.log(`📨 Enqueued agent response: ${queueMessage.id}`);
    return queueMessage.id;
  }

  async enqueueProactiveAction(
    actionType: string,
    agentType: string,
    message: string,
    userId: string,
    conversationId: string,
    timing: 'immediate' | 'delayed' = 'immediate',
    delayMs?: number,
    priority?: number
  ): Promise<string> {
    const queueMessage = this.messageQueue.createMessage(
      'proactive_action',
      {
        actionType,
        agentType,
        message,
        userId,
        conversationId,
        timing,
        delayMs,
        priority: priority || 7 // Proactive actions have high priority
      } as ProactiveActionPayload,
      {
        userId,
        conversationId,
        priority: priority || 7,
        delayMs: timing === 'delayed' ? delayMs : undefined
      }
    );

    await this.messageQueue.enqueue(QUEUE_NAMES.PROACTIVE_ACTIONS, queueMessage);
    console.log(`📨 Enqueued proactive action: ${queueMessage.id} (${timing})`);
    return queueMessage.id;
  }

  async enqueueStreamChunk(
    messageId: string,
    conversationId: string,
    content: string,
    isComplete: boolean,
    userId: string,
    priority?: number
  ): Promise<string> {
    const queueMessage = this.messageQueue.createMessage(
      'stream_chunk',
      {
        messageId,
        conversationId,
        content,
        isComplete,
        userId
      } as StreamChunkPayload,
      {
        userId,
        conversationId,
        priority: priority || 8 // Stream chunks have very high priority for real-time feel
      }
    );

    await this.messageQueue.enqueue(QUEUE_NAMES.STREAM_CHUNKS, queueMessage);
    return queueMessage.id;
  }

  // Queue management methods

  async getQueueStats(queueName?: string) {
    return await this.messageQueue.getStats(queueName);
  }

  async getQueueSize(queueName: string): Promise<number> {
    return await this.messageQueue.getQueueSize(queueName);
  }

  async purgeQueue(queueName: string): Promise<void> {
    await this.messageQueue.purgeQueue(queueName);
    console.log(`🧹 Purged queue: ${queueName}`);
  }

  async isHealthy(): Promise<boolean> {
    return await this.messageQueue.isHealthy();
  }

  // Demo methods to show queue functionality

  async demonstrateQueueFeatures(userId: string, conversationId: string): Promise<void> {
    console.log('🎭 Demonstrating message queue features...');

    // Enqueue messages with different priorities
    await this.enqueueChatMessage(userId, conversationId, 'Low priority message', undefined, 3);
    await this.enqueueChatMessage(userId, conversationId, 'High priority message', undefined, 9);
    await this.enqueueChatMessage(userId, conversationId, 'Normal priority message', undefined, 5);

    // Enqueue delayed proactive action (will be processed after delay)
    await this.enqueueProactiveAction(
      'delayed_greeting',
      'general',
      'This is a delayed proactive message!',
      userId,
      conversationId,
      'delayed',
      5000, // 5 second delay
      8
    );

    // Enqueue immediate proactive action
    await this.enqueueProactiveAction(
      'immediate_notification',
      'general',
      'This is an immediate notification!',
      userId,
      conversationId,
      'immediate',
      undefined,
      9
    );

    console.log('🎭 Demo messages enqueued. Check the processing order!');
  }

  // Get queue provider type for configuration purposes
  getProviderType() {
    return this.messageQueue.getProviderType();
  }

  // Method to switch providers (useful for testing)
  async switchProvider(providerType: 'memory' | 'redis', redisUrl?: string): Promise<void> {
    console.log(`🔄 Switching from ${this.messageQueue.getProviderType()} to ${providerType}`);
    
    // Gracefully shutdown current provider
    await this.messageQueue.disconnect();
    
    // Create new provider
    this.messageQueue = createMessageQueue({
      provider: providerType,
      redis: { url: redisUrl }
    });
    
    // Initialize new provider
    await this.messageQueue.connect();
    await this.setupQueueHandlers();
    
    console.log(`✅ Successfully switched to ${providerType} provider`);
  }
}

// Create singleton instance
let queueServiceInstance: QueueService | null = null;

export function createQueueService(io: SocketServer): QueueService {
  if (!queueServiceInstance) {
    queueServiceInstance = new QueueService(io);
  }
  return queueServiceInstance;
}

export function getQueueService(): QueueService | null {
  return queueServiceInstance;
}
