import {
  MessageQueueProvider,
  QueueMessage,
  MessageHandler,
  QueueOptions,
  QueueStats,
} from './types';
import { InMemoryMessageQueueProvider } from './providers/inMemoryProvider';
import { RedisMessageQueueProvider } from './providers/redisProvider';

export type QueueProviderType = 'memory' | 'redis';

interface MessageQueueConfig {
  provider: QueueProviderType;
  redis?: {
    url?: string;
  };
}

export class MessageQueue {
  private provider: MessageQueueProvider;
  private config: MessageQueueConfig;

  constructor(config: MessageQueueConfig) {
    this.config = config;
    this.provider = this.createProvider();
  }

  private createProvider(): MessageQueueProvider {
    switch (this.config.provider) {
      case 'memory':
        return new InMemoryMessageQueueProvider();

      case 'redis':
        return new RedisMessageQueueProvider(this.config.redis?.url);

      default:
        throw new Error(`Unknown queue provider: ${this.config.provider}`);
    }
  }

  // Provider lifecycle methods
  async connect(): Promise<void> {
    await this.provider.connect();
  }

  async disconnect(): Promise<void> {
    await this.provider.disconnect();
  }

  async isHealthy(): Promise<boolean> {
    return await this.provider.isHealthy();
  }

  // Core queue operations
  async enqueue(
    queueName: string,
    message: QueueMessage,
    options?: QueueOptions
  ): Promise<void> {
    return await this.provider.enqueue(queueName, message, options);
  }

  async dequeue(queueName: string): Promise<QueueMessage | null> {
    return await this.provider.dequeue(queueName);
  }

  async peek(queueName: string): Promise<QueueMessage | null> {
    return await this.provider.peek(queueName);
  }

  // Consumer operations
  async subscribe(queueName: string, handler: MessageHandler): Promise<void> {
    return await this.provider.subscribe(queueName, handler);
  }

  async unsubscribe(queueName: string): Promise<void> {
    return await this.provider.unsubscribe(queueName);
  }

  // Queue management
  async getQueueSize(queueName: string): Promise<number> {
    return await this.provider.getQueueSize(queueName);
  }

  async purgeQueue(queueName: string): Promise<void> {
    return await this.provider.purgeQueue(queueName);
  }

  async deleteQueue(queueName: string): Promise<void> {
    return await this.provider.deleteQueue(queueName);
  }

  // Monitoring and stats
  async getStats(queueName?: string): Promise<QueueStats> {
    return await this.provider.getStats(queueName);
  }

  // Event handling
  on(event: string, listener: (...args: any[]) => void): this {
    this.provider.on(event, listener);
    return this;
  }

  off(event: string, listener: (...args: any[]) => void): this {
    this.provider.off(event, listener);
    return this;
  }

  // Get provider type for debugging
  getProviderType(): QueueProviderType {
    return this.config.provider;
  }

  // Helper methods for creating messages
  createMessage(
    type: string,
    payload: any,
    options?: {
      userId?: string;
      conversationId?: string;
      priority?: number;
      delayMs?: number;
      maxRetries?: number;
      metadata?: Record<string, any>;
    }
  ): QueueMessage {
    return {
      id: this.generateMessageId(),
      type,
      payload,
      timestamp: new Date(),
      userId: options?.userId,
      conversationId: options?.conversationId,
      priority: options?.priority || 5,
      delayMs: options?.delayMs,
      maxRetries: options?.maxRetries || 3,
      retryCount: 0,
      metadata: options?.metadata,
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

// Factory function for easy creation
export function createMessageQueue(
  config?: Partial<MessageQueueConfig>
): MessageQueue {
  const defaultConfig: MessageQueueConfig = {
    provider:
      (process.env.MESSAGE_QUEUE_PROVIDER as QueueProviderType) || 'memory',
    redis: {
      url: process.env.REDIS_URL,
    },
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new MessageQueue(finalConfig);
}

// Pre-configured instances for common use cases
export function createInMemoryQueue(): MessageQueue {
  return createMessageQueue({ provider: 'memory' });
}

export function createRedisQueue(redisUrl?: string): MessageQueue {
  return createMessageQueue({
    provider: 'redis',
    redis: { url: redisUrl },
  });
}

// Queue names constants
export const QUEUE_NAMES = {
  CHAT_MESSAGES: 'chat_messages',
  AGENT_RESPONSES: 'agent_responses',
  PROACTIVE_ACTIONS: 'proactive_actions',
  STREAM_CHUNKS: 'stream_chunks',
  STATUS_UPDATES: 'status_updates',
  VALIDATION_REQUESTS: 'validation_requests',
  GOAL_SEEKING_UPDATES: 'goal_seeking_updates',
  CONVERSATION_EVENTS: 'conversation_events',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
