import {
  MessageQueueProvider,
  QueueMessage,
  MessageHandler,
  QueueOptions,
  QueueStats,
} from '../types';
import { EventEmitter } from 'events';

const DEFAULT_PRIORITY = 5;

interface QueueData {
  messages: QueueMessage[];
  subscribers: MessageHandler[];
  stats: {
    totalMessages: number;
    pendingMessages: number;
    processingMessages: number;
    completedMessages: number;
    failedMessages: number;
    processingTimes: number[];
  };
}

export class InMemoryMessageQueueProvider
  extends EventEmitter
  implements MessageQueueProvider
{
  private queues = new Map<string, QueueData>();
  private processingMessages = new Map<string, QueueMessage>();
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private isConnected = false;

  async connect(): Promise<void> {
    this.isConnected = true;
    console.log('📨 InMemory Message Queue connected');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;

    // Clear all retry timeouts
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.retryTimeouts.clear();

    // Clear all queues
    this.queues.clear();
    this.processingMessages.clear();

    console.log('📨 InMemory Message Queue disconnected');
  }

  private ensureQueue(queueName: string): QueueData {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, {
        messages: [],
        subscribers: [],
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

  async enqueue(
    queueName: string,
    message: QueueMessage,
    options?: QueueOptions,
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Message queue is not connected');
    }

    const queue = this.ensureQueue(queueName);

    // Apply options to message
    if (options) {
      if (options.maxRetries !== undefined)
        message.maxRetries = options.maxRetries;
      if (options.priority !== undefined) message.priority = options.priority;
      if (options.delayMs !== undefined) message.delayMs = options.delayMs;
    }

    // Set defaults
    message.retryCount = message.retryCount || 0;
    message.maxRetries = message.maxRetries || 3;
    message.priority = message.priority || DEFAULT_PRIORITY;

    if (message.delayMs && message.delayMs > 0) {
      // Schedule delayed message
      setTimeout(() => {
        this.addMessageToQueue(queueName, message);
      }, message.delayMs);
    } else {
      this.addMessageToQueue(queueName, message);
    }
  }

  private addMessageToQueue(queueName: string, message: QueueMessage): void {
    const queue = this.ensureQueue(queueName);

    // Insert message based on priority (higher priority first)
    let insertIndex = queue.messages.length;
    for (let i = 0; i < queue.messages.length; i++) {
      if (
        (queue.messages[i].priority || DEFAULT_PRIORITY) <
        (message.priority || DEFAULT_PRIORITY)
      ) {
        insertIndex = i;
        break;
      }
    }

    queue.messages.splice(insertIndex, 0, message);
    queue.stats.totalMessages++;
    queue.stats.pendingMessages++;

    console.log(
      `📨 Enqueued message ${message.id} to ${queueName} (priority: ${message.priority}, queue size: ${queue.messages.length})`,
    );

    // Notify subscribers immediately
    this.processNextMessage(queueName);
  }

  async dequeue(queueName: string): Promise<QueueMessage | null> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.messages.length === 0) {
      return null;
    }

    const message = queue.messages.shift()!;
    queue.stats.pendingMessages--;
    queue.stats.processingMessages++;

    this.processingMessages.set(message.id, message);

    console.log(`📨 Dequeued message ${message.id} from ${queueName}`);
    return message;
  }

  async peek(queueName: string): Promise<QueueMessage | null> {
    const queue = this.queues.get(queueName);
    return queue && queue.messages.length > 0 ? queue.messages[0] : null;
  }

  async subscribe(queueName: string, handler: MessageHandler): Promise<void> {
    const queue = this.ensureQueue(queueName);
    queue.subscribers.push(handler);

    console.log(
      `📨 Subscribed to queue ${queueName} (${queue.subscribers.length} subscribers)`,
    );

    // Process any existing messages
    this.processNextMessage(queueName);
  }

  async unsubscribe(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.subscribers = [];
      console.log(`📨 Unsubscribed from queue ${queueName}`);
    }
  }

  private async processNextMessage(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (
      !queue ||
      queue.subscribers.length === 0 ||
      queue.messages.length === 0
    ) {
      return;
    }

    // Use a small delay to allow batching
    setTimeout(async () => {
      const message = await this.dequeue(queueName);
      if (!message) return;

      const startTime = Date.now();

      try {
        // Process with all subscribers (fan-out pattern)
        await Promise.all(queue.subscribers.map(handler => handler(message)));

        const processingTime = Date.now() - startTime;
        queue.stats.processingTimes.push(processingTime);

        // Keep only last 100 processing times for average calculation
        if (queue.stats.processingTimes.length > 100) {
          queue.stats.processingTimes = queue.stats.processingTimes.slice(-100);
        }

        queue.stats.processingMessages--;
        queue.stats.completedMessages++;
        this.processingMessages.delete(message.id);

        console.log(
          `✅ Successfully processed message ${message.id} from ${queueName} (${processingTime}ms)`,
        );
      } catch (error) {
        console.error(
          `❌ Error processing message ${message.id} from ${queueName}:`,
          error,
        );

        queue.stats.processingMessages--;
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

          const timeout = setTimeout(() => {
            this.addMessageToQueue(queueName, message);
            this.retryTimeouts.delete(message.id);
          }, retryDelay);

          this.retryTimeouts.set(message.id, timeout);
        } else {
          console.error(
            `💀 Message ${message.id} failed permanently after ${message.retryCount} retries`,
          );
          queue.stats.failedMessages++;

          // Emit dead letter event
          this.emit('deadLetter', { queueName, message, error });
        }
      }

      // Process next message if available
      if (queue.messages.length > 0) {
        setImmediate(() => this.processNextMessage(queueName));
      }
    }, 1);
  }

  async getQueueSize(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName);
    return queue ? queue.messages.length : 0;
  }

  async purgeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.messages = [];
      queue.stats.pendingMessages = 0;
      console.log(`🧹 Purged queue ${queueName}`);
    }
  }

  async deleteQueue(queueName: string): Promise<void> {
    // Cancel any retry timeouts for this queue
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.messages.forEach(msg => {
        const timeout = this.retryTimeouts.get(msg.id);
        if (timeout) {
          clearTimeout(timeout);
          this.retryTimeouts.delete(msg.id);
        }
      });
    }

    this.queues.delete(queueName);
    console.log(`🗑️ Deleted queue ${queueName}`);
  }

  async isHealthy(): Promise<boolean> {
    return this.isConnected;
  }

  async getStats(queueName?: string): Promise<QueueStats> {
    if (queueName) {
      const queue = this.queues.get(queueName);
      if (!queue) {
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

      const avgProcessingTime =
        queue.stats.processingTimes.length > 0
          ? queue.stats.processingTimes.reduce((a, b) => a + b, 0) /
            queue.stats.processingTimes.length
          : 0;

      return {
        totalMessages: queue.stats.totalMessages,
        pendingMessages: queue.stats.pendingMessages,
        processingMessages: queue.stats.processingMessages,
        completedMessages: queue.stats.completedMessages,
        failedMessages: queue.stats.failedMessages,
        avgProcessingTime,
        queues: [queueName],
      };
    }

    // Aggregate stats for all queues
    let totalMessages = 0;
    let pendingMessages = 0;
    let processingMessages = 0;
    let completedMessages = 0;
    let failedMessages = 0;
    let allProcessingTimes: number[] = [];

    for (const queue of this.queues.values()) {
      totalMessages += queue.stats.totalMessages;
      pendingMessages += queue.stats.pendingMessages;
      processingMessages += queue.stats.processingMessages;
      completedMessages += queue.stats.completedMessages;
      failedMessages += queue.stats.failedMessages;
      allProcessingTimes.push(...queue.stats.processingTimes);
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
      queues: Array.from(this.queues.keys()),
    };
  }
}
