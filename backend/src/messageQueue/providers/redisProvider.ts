import {
  MessageQueueProvider,
  QueueMessage,
  MessageHandler,
  QueueOptions,
  QueueStats,
} from '../types';
import { EventEmitter } from 'events';
import { createClient, RedisClientType } from 'redis';

const MESSAGE_PROCESSING_EXPIRY_SECONDS = 300; // 5 minutes

interface RedisQueueData {
  subscribers: Map<string, MessageHandler>;
  stats: {
    totalMessages: number;
    pendingMessages: number;
    processingMessages: number;
    completedMessages: number;
    failedMessages: number;
    processingTimes: number[];
  };
}

const DEFAULT_PRIORITY = 5;

export class RedisMessageQueueProvider
  extends EventEmitter
  implements MessageQueueProvider
{
  private client: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private queues = new Map<string, RedisQueueData>();
  private processingMessages = new Map<string, QueueMessage>();
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private isConnected = false;
  private readonly redisUrl: string;

  constructor(redisUrl?: string) {
    super();
    const urlToUse =
      redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    const redisUrlPattern =
      /^redis:\/\/([^\s:@]+(:[^\s:@]*)?@)?([^\s:@]+)(:\d+)?(\/\d+)?$/;
    if (!redisUrlPattern.test(urlToUse)) {
      throw new Error(`Invalid Redis connection string: ${urlToUse}`);
    }
    this.redisUrl = urlToUse;
  }

  async connect(): Promise<void> {
    try {
      // Create main client
      this.client = createClient({ url: this.redisUrl });
      await this.client.connect();

      // Create subscriber client (Redis requires separate connection for pub/sub)
      this.subscriber = createClient({ url: this.redisUrl });
      await this.subscriber.connect();

      this.isConnected = true;
      console.log('📨 Redis Message Queue connected to', this.redisUrl);
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;

    // Clear all retry timeouts
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.retryTimeouts.clear();

    // Disconnect clients
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }

    if (this.subscriber) {
      await this.subscriber.disconnect();
      this.subscriber = null;
    }

    // Clear local state
    this.queues.clear();
    this.processingMessages.clear();

    console.log('📨 Redis Message Queue disconnected');
  }

  private ensureQueue(queueName: string): RedisQueueData {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, {
        subscribers: new Map(),
        stats: {
          totalMessages: 0,
          pendingMessages: 0,
          processingMessages: 0,
          completedMessages: 0,
          failedMessages: 0,
          processingTimes: [],
        },
      });
    }
    return this.queues.get(queueName)!;
  }

  private getRedisKeys(queueName: string) {
    return {
      queue: `mq:${queueName}:queue`,
      processing: `mq:${queueName}:processing`,
      stats: `mq:${queueName}:stats`,
      notify: `mq:${queueName}:notify`,
    };
  }

  async enqueue(
    queueName: string,
    message: QueueMessage,
    options?: QueueOptions,
  ): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    const queue = this.ensureQueue(queueName);
    const keys = this.getRedisKeys(queueName);

    // Apply options to message
    if (options) {
      if (options.maxRetries !== undefined)
        message.maxRetries = options.maxRetries;
      if (options.priority !== undefined) message.priority = options.priority;
    }
    message.maxRetries = message.maxRetries || 3;
    message.priority = message.priority || DEFAULT_PRIORITY;

    const messageData = JSON.stringify(message);

    if (message.delayMs && message.delayMs > 0) {
      // Schedule delayed message using Redis sorted set with timestamp
      const executeAt = Date.now() + message.delayMs;
      await this.client.zAdd(`${keys.queue}:delayed`, {
        score: executeAt,
        value: messageData,
      });

      // Schedule processing of delayed messages
      setTimeout(() => {
        this.processDelayedMessages(queueName);
      }, message.delayMs);

      // Update stats for delayed message
      await this.client.hIncrBy(keys.stats, 'totalMessages', 1);
      await this.client.hIncrBy(keys.stats, 'pendingMessages', 1);
    } else {
      // Add to priority queue using sorted set (higher priority = higher score)
      await this.client.zAdd(keys.queue, {
        score: message.priority || DEFAULT_PRIORITY,
        value: messageData,
      });

      // Update stats
      await this.client.hIncrBy(keys.stats, 'totalMessages', 1);
      await this.client.hIncrBy(keys.stats, 'pendingMessages', 1);

      // Notify subscribers
      await this.client.publish(keys.notify, 'new_message');
    }

    console.log(
      `📨 Enqueued message ${message.id} to Redis queue ${queueName} (priority: ${message.priority})`,
    );
  }

  private async processDelayedMessages(queueName: string): Promise<void> {
    if (!this.client) return;

    const keys = this.getRedisKeys(queueName);
    const now = Date.now();

    try {
      // Get messages that are ready to be processed
      const delayedMessages = await this.client.zRangeByScore(
        `${keys.queue}:delayed`,
        0,
        now,
      );

      for (const messageData of delayedMessages) {
        const message = JSON.parse(messageData);

        // Move from delayed to main queue
        await this.client.zRem(`${keys.queue}:delayed`, messageData);
        await this.client.zAdd(keys.queue, {
          score: message.priority || 5,
          value: messageData,
        });

        // Update stats
        await this.client.hIncrBy(keys.stats, 'totalMessages', 1);
        await this.client.hIncrBy(keys.stats, 'pendingMessages', 1);

        // Notify subscribers
        await this.client.publish(keys.notify, 'new_message');
      }
    } catch (error) {
      console.error(
        `Error processing delayed messages for ${queueName}:`,
        error,
      );
    }
  }

  async dequeue(queueName: string): Promise<QueueMessage | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    const keys = this.getRedisKeys(queueName);

    try {
      // Get highest priority message (atomic pop)
      const result = await this.client.zPopMax(keys.queue);
      if (!result) {
        return null;
      }

      // Parse the message from the Redis result
      const message: QueueMessage = JSON.parse(result.value);

      // Move to processing set with expiry (for reliability)
      await this.client.setEx(
        `${keys.processing}:${message.id}`,
        MESSAGE_PROCESSING_EXPIRY_SECONDS,
        JSON.stringify(message),
      );

      // Update stats
      await this.client.hIncrBy(keys.stats, 'pendingMessages', -1);
      await this.client.hIncrBy(keys.stats, 'processingMessages', 1);

      this.processingMessages.set(message.id, message);

      console.log(
        `📨 Dequeued message ${message.id} from Redis queue ${queueName}`,
      );
      return message;
    } catch (error) {
      console.error(`Error dequeuing from ${queueName}:`, error);
      return null;
    }
  }

  async peek(queueName: string): Promise<QueueMessage | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    const keys = this.getRedisKeys(queueName);

    try {
      const result = await this.client.zRange(keys.queue, -1, -1);
      if (result.length === 0) {
        return null;
      }

      return JSON.parse(result[0]);
    } catch (error) {
      console.error(`Error peeking queue ${queueName}:`, error);
      return null;
    }
  }

  async subscribe(queueName: string, handler: MessageHandler): Promise<void> {
    if (!this.subscriber || !this.isConnected) {
      throw new Error('Redis subscriber is not connected');
    }

    const queue = this.ensureQueue(queueName);
    const keys = this.getRedisKeys(queueName);

    const handlerId = Math.random().toString(36).substring(7);
    queue.subscribers.set(handlerId, handler);

    // Subscribe to notifications for this queue
    await this.subscriber.subscribe(
      keys.notify,
      async (message: string, channel: string) => {
        if (message === 'new_message') {
          await this.processNextMessage(queueName);
        }
      },
    );

    console.log(
      `📨 Subscribed to Redis queue ${queueName} (${queue.subscribers.size} subscribers)`,
    );

    // Process any existing messages
    this.processNextMessage(queueName);
  }

  async unsubscribe(queueName: string): Promise<void> {
    if (!this.subscriber) return;

    const queue = this.queues.get(queueName);
    if (queue) {
      queue.subscribers.clear();

      const keys = this.getRedisKeys(queueName);
      await this.subscriber.unsubscribe(keys.notify);

      console.log(`📨 Unsubscribed from Redis queue ${queueName}`);
    }
  }

  private async processNextMessage(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.subscribers.size === 0) {
      return;
    }

    const message = await this.dequeue(queueName);
    if (!message) return;

    const startTime = Date.now();
    const keys = this.getRedisKeys(queueName);

    try {
      // Process with all subscribers
      const handlers = Array.from(queue.subscribers.values());
      await Promise.all(handlers.map(handler => handler(message)));

      const processingTime = Date.now() - startTime;
      queue.stats.processingTimes.push(processingTime);

      // Keep only last 100 processing times
      if (queue.stats.processingTimes.length > 100) {
        queue.stats.processingTimes = queue.stats.processingTimes.slice(-100);
      }

      // Update stats and clean up
      if (this.client) {
        await this.client.hIncrBy(keys.stats, 'processingMessages', -1);
        await this.client.hIncrBy(keys.stats, 'completedMessages', 1);
        await this.client.del(`${keys.processing}:${message.id}`);
      }

      this.processingMessages.delete(message.id);

      console.log(
        `✅ Successfully processed message ${message.id} from Redis queue ${queueName} (${processingTime}ms)`,
      );
    } catch (error) {
      console.error(
        `❌ Error processing message ${message.id} from Redis queue ${queueName}:`,
        error,
      );

      if (this.client) {
        await this.client.hIncrBy(keys.stats, 'processingMessages', -1);
        await this.client.del(`${keys.processing}:${message.id}`);
      }

      this.processingMessages.delete(message.id);

      // Handle retry logic
      message.retryCount = (message.retryCount || 0) + 1;

      if (message.retryCount < (message.maxRetries || 3)) {
        console.log(
          `🔄 Retrying message ${message.id} (attempt ${message.retryCount + 1}/${message.maxRetries})`,
        );

        // Exponential backoff
        const retryDelay = Math.min(
          1000 * Math.pow(2, message.retryCount - 1),
          30000,
        );

        const timeout = setTimeout(async () => {
          await this.enqueue(queueName, message);
          this.retryTimeouts.delete(message.id);
        }, retryDelay);

        this.retryTimeouts.set(message.id, timeout);
      } else {
        console.error(
          `💀 Message ${message.id} failed permanently after ${message.retryCount} retries`,
        );

        if (this.client) {
          await this.client.hIncrBy(keys.stats, 'failedMessages', 1);
        }

        // Emit dead letter event
        this.emit('deadLetter', { queueName, message, error });
      }
    }
  }

  async getQueueSize(queueName: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    const keys = this.getRedisKeys(queueName);
    try {
      return await this.client.zCard(keys.queue);
    } catch (error) {
      console.error(`Error getting queue size for ${queueName}:`, error);
      return 0;
    }
  }

  async purgeQueue(queueName: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    const keys = this.getRedisKeys(queueName);

    try {
      await this.client.del(keys.queue);
      await this.client.del(`${keys.queue}:delayed`);
      await this.client.hSet(keys.stats, 'pendingMessages', 0);

      console.log(`🧹 Purged Redis queue ${queueName}`);
    } catch (error) {
      console.error(`Error purging queue ${queueName}:`, error);
    }
  }

  async deleteQueue(queueName: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    const keys = this.getRedisKeys(queueName);

    try {
      // Delete all queue data
      await this.client.del(keys.queue);
      await this.client.del(`${keys.queue}:delayed`);
      await this.client.del(keys.stats);

      // Clean up processing messages
      const processingKeys = await this.client.keys(`${keys.processing}:*`);
      if (processingKeys.length > 0) {
        await this.client.del(processingKeys);
      }

      // Clean up local state
      this.queues.delete(queueName);

      console.log(`🗑️ Deleted Redis queue ${queueName}`);
    } catch (error) {
      console.error(`Error deleting queue ${queueName}:`, error);
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  async getStats(queueName?: string): Promise<QueueStats> {
    if (!this.client || !this.isConnected) {
      return {
        totalMessages: 0,
        pendingMessages: 0,
        processingMessages: 0,
        completedMessages: 0,
        failedMessages: 0,
        avgProcessingTime: 0,
        queues: [],
      };
    }

    if (queueName) {
      const keys = this.getRedisKeys(queueName);
      const queue = this.queues.get(queueName);

      try {
        const stats = await this.client.hGetAll(keys.stats);
        const avgProcessingTime = queue?.stats.processingTimes.length
          ? queue.stats.processingTimes.reduce((a, b) => a + b, 0) /
            queue.stats.processingTimes.length
          : 0;

        return {
          totalMessages: parseInt(stats.totalMessages || '0'),
          pendingMessages: parseInt(stats.pendingMessages || '0'),
          processingMessages: parseInt(stats.processingMessages || '0'),
          completedMessages: parseInt(stats.completedMessages || '0'),
          failedMessages: parseInt(stats.failedMessages || '0'),
          avgProcessingTime,
          queues: [queueName],
        };
      } catch (error) {
        console.error(`Error getting stats for ${queueName}:`, error);
        return {
          totalMessages: 0,
          pendingMessages: 0,
          processingMessages: 0,
          completedMessages: 0,
          failedMessages: 0,
          avgProcessingTime: 0,
          queues: [],
        };
      }
    }

    // Get all queue names and aggregate stats
    try {
      const queueKeys = await this.client.keys('mq:*:stats');
      const queues = queueKeys.map((key: string) => key.split(':')[1]);

      let totalMessages = 0;
      let pendingMessages = 0;
      let processingMessages = 0;
      let completedMessages = 0;
      let failedMessages = 0;
      let allProcessingTimes: number[] = [];

      for (const qName of queues) {
        const keys = this.getRedisKeys(qName);
        const stats = await this.client.hGetAll(keys.stats);
        const queue = this.queues.get(qName);

        totalMessages += parseInt(stats.totalMessages || '0');
        pendingMessages += parseInt(stats.pendingMessages || '0');
        processingMessages += parseInt(stats.processingMessages || '0');
        completedMessages += parseInt(stats.completedMessages || '0');
        failedMessages += parseInt(stats.failedMessages || '0');

        if (queue?.stats.processingTimes) {
          allProcessingTimes.push(...queue.stats.processingTimes);
        }
      }

      const avgProcessingTime =
        allProcessingTimes.length > 0
          ? allProcessingTimes.reduce((a, b) => a + b, 0) /
            allProcessingTimes.length
          : 0;

      return {
        totalMessages,
        pendingMessages,
        processingMessages,
        completedMessages,
        failedMessages,
        avgProcessingTime,
        queues,
      };
    } catch (error) {
      console.error('Error getting aggregate stats:', error);
      return {
        totalMessages: 0,
        pendingMessages: 0,
        processingMessages: 0,
        completedMessages: 0,
        failedMessages: 0,
        avgProcessingTime: 0,
        queues: [],
      };
    }
  }
}
