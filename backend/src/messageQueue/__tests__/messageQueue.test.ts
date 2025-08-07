import { createInMemoryQueue, createMessageQueue } from '../messageQueue';
import { InMemoryMessageQueueProvider } from '../providers/inMemoryProvider';

describe('Message Queue System', () => {
  let queue: any;

  beforeEach(async () => {
    queue = createInMemoryQueue();
    await queue.connect();
  });

  afterEach(async () => {
    await queue.disconnect();
  });

  describe('Basic Queue Operations', () => {
    test('should enqueue and dequeue messages', async () => {
      const message = queue.createMessage('test', { content: 'Hello' });

      await queue.enqueue('test_queue', message);
      const size = await queue.getQueueSize('test_queue');
      expect(size).toBe(1);

      const dequeued = await queue.dequeue('test_queue');
      expect(dequeued).toBeDefined();
      expect(dequeued.payload.content).toBe('Hello');
    });

    test('should handle priority ordering', async () => {
      const lowPriorityMsg = queue.createMessage(
        'test',
        { order: 1 },
        { priority: 3 }
      );
      const highPriorityMsg = queue.createMessage(
        'test',
        { order: 2 },
        { priority: 9 }
      );
      const medPriorityMsg = queue.createMessage(
        'test',
        { order: 3 },
        { priority: 6 }
      );

      // Enqueue in random order
      await queue.enqueue('priority_test', lowPriorityMsg);
      await queue.enqueue('priority_test', highPriorityMsg);
      await queue.enqueue('priority_test', medPriorityMsg);

      // Should dequeue in priority order (highest first)
      const first = await queue.dequeue('priority_test');
      const second = await queue.dequeue('priority_test');
      const third = await queue.dequeue('priority_test');

      expect(first.payload.order).toBe(2); // Highest priority
      expect(second.payload.order).toBe(3); // Medium priority
      expect(third.payload.order).toBe(1); // Lowest priority
    });

    test('should peek at messages without removing them', async () => {
      const message = queue.createMessage('test', { content: 'Peek me' });
      await queue.enqueue('peek_test', message);

      const peeked = await queue.peek('peek_test');
      expect(peeked.payload.content).toBe('Peek me');

      const size = await queue.getQueueSize('peek_test');
      expect(size).toBe(1); // Message still in queue
    });

    test('should handle empty queue operations', async () => {
      const dequeued = await queue.dequeue('empty_queue');
      expect(dequeued).toBeNull();

      const peeked = await queue.peek('empty_queue');
      expect(peeked).toBeNull();

      const size = await queue.getQueueSize('empty_queue');
      expect(size).toBe(0);
    });
  });

  describe('Message Processing', () => {
    test('should process messages with subscribers', async () => {
      const processedMessages: any[] = [];

      // Subscribe to queue
      await queue.subscribe('sub_test', async (message: any) => {
        processedMessages.push(message);
      });

      // Enqueue a message
      const message = queue.createMessage('test', { content: 'Process me' });
      await queue.enqueue('sub_test', message);

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(processedMessages).toHaveLength(1);
      expect(processedMessages[0].payload.content).toBe('Process me');
    });

    test('should handle multiple subscribers', async () => {
      const subscriber1Messages: any[] = [];
      const subscriber2Messages: any[] = [];

      // Multiple subscribers
      await queue.subscribe('multi_test', async (message: any) => {
        subscriber1Messages.push(message);
      });
      await queue.subscribe('multi_test', async (message: any) => {
        subscriber2Messages.push(message);
      });

      const message = queue.createMessage('test', { content: 'Broadcast me' });
      await queue.enqueue('multi_test', message);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(subscriber1Messages).toHaveLength(1);
      expect(subscriber2Messages).toHaveLength(1);
    });
  });

  describe('Error Handling and Retries', () => {
    test('should retry failed messages', async () => {
      let attempts = 0;

      await queue.subscribe('retry_test', async (message: any) => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Simulated failure');
        }
        // Success on third attempt
      });

      const message = queue.createMessage(
        'test',
        { content: 'Retry me' },
        { maxRetries: 5 }
      );
      await queue.enqueue('retry_test', message);

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 5000));

      expect(attempts).toBe(3); // Should succeed on third attempt
    });

    test('should emit dead letter events for permanently failed messages', async () => {
      const deadLetters: any[] = [];

      queue.on('deadLetter', (data: any) => {
        deadLetters.push(data);
      });

      await queue.subscribe('dead_test', async (message: any) => {
        throw new Error('Always fails');
      });

      const message = queue.createMessage(
        'test',
        { content: 'Kill me' },
        { maxRetries: 2 }
      );
      await queue.enqueue('dead_test', message);

      // Wait for all retry attempts
      await new Promise(resolve => setTimeout(resolve, 8000));

      expect(deadLetters).toHaveLength(1);
      expect(deadLetters[0].message.payload.content).toBe('Kill me');
    });
  });

  describe('Queue Management', () => {
    test('should get queue statistics', async () => {
      // Add some messages
      const msg1 = queue.createMessage('test', { id: 1 });
      const msg2 = queue.createMessage('test', { id: 2 });

      await queue.enqueue('stats_test', msg1);
      await queue.enqueue('stats_test', msg2);

      const stats = await queue.getStats('stats_test');

      expect(stats.totalMessages).toBeGreaterThanOrEqual(2);
      expect(stats.pendingMessages).toBeGreaterThanOrEqual(0);
      expect(stats.queues).toContain('stats_test');
    });

    test('should purge queues', async () => {
      // Add messages
      await queue.enqueue('purge_test', queue.createMessage('test', { id: 1 }));
      await queue.enqueue('purge_test', queue.createMessage('test', { id: 2 }));

      let size = await queue.getQueueSize('purge_test');
      expect(size).toBe(2);

      await queue.purgeQueue('purge_test');
      size = await queue.getQueueSize('purge_test');
      expect(size).toBe(0);
    });

    test('should delete queues', async () => {
      await queue.enqueue(
        'delete_test',
        queue.createMessage('test', { id: 1 })
      );

      let size = await queue.getQueueSize('delete_test');
      expect(size).toBe(1);

      await queue.deleteQueue('delete_test');
      size = await queue.getQueueSize('delete_test');
      expect(size).toBe(0);
    });
  });

  describe('Health and Connection', () => {
    test('should report healthy when connected', async () => {
      const healthy = await queue.isHealthy();
      expect(healthy).toBe(true);
    });

    test('should report unhealthy when disconnected', async () => {
      await queue.disconnect();
      const healthy = await queue.isHealthy();
      expect(healthy).toBe(false);
    });
  });

  describe('Delayed Messages', () => {
    test('should process delayed messages after delay', async () => {
      const processedMessages: any[] = [];

      await queue.subscribe('delay_test', async (message: any) => {
        processedMessages.push({
          content: message.payload.content,
          processedAt: Date.now(),
        });
      });

      const startTime = Date.now();
      const message = queue.createMessage(
        'test',
        { content: 'Delayed message' },
        { delayMs: 1000 } // 1 second delay
      );

      await queue.enqueue('delay_test', message);

      // Should not be processed immediately
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(processedMessages).toHaveLength(0);

      // Should be processed after delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(processedMessages).toHaveLength(1);

      const processedAt = processedMessages[0].processedAt;
      const actualDelay = processedAt - startTime;
      expect(actualDelay).toBeGreaterThanOrEqual(1000); // At least 1 second delay
    });
  });

  describe('Provider Configuration', () => {
    test('should create memory provider by default', () => {
      const memQueue = createMessageQueue();
      expect(memQueue.getProviderType()).toBe('memory');
    });

    test('should create memory provider explicitly', () => {
      const memQueue = createInMemoryQueue();
      expect(memQueue.getProviderType()).toBe('memory');
    });

    test('should respect environment configuration', () => {
      process.env.MESSAGE_QUEUE_PROVIDER = 'memory';
      const envQueue = createMessageQueue();
      expect(envQueue.getProviderType()).toBe('memory');
    });
  });
});

describe('Message Creation', () => {
  test('should create messages with all properties', () => {
    const queue = createInMemoryQueue();

    const message = queue.createMessage(
      'test_type',
      { content: 'Test payload' },
      {
        userId: 'user123',
        conversationId: 'conv456',
        priority: 7,
        maxRetries: 5,
        delayMs: 2000,
        metadata: { source: 'test' },
      }
    );

    expect(message.type).toBe('test_type');
    expect(message.payload.content).toBe('Test payload');
    expect(message.userId).toBe('user123');
    expect(message.conversationId).toBe('conv456');
    expect(message.priority).toBe(7);
    expect(message.maxRetries).toBe(5);
    expect(message.delayMs).toBe(2000);
    expect(message.metadata?.source).toBe('test');
    expect(message.id).toBeDefined();
    expect(message.timestamp).toBeInstanceOf(Date);
    expect(message.retryCount).toBe(0);
  });

  test('should apply default values', () => {
    const queue = createInMemoryQueue();

    const message = queue.createMessage('test', { data: 'test' });

    expect(message.priority).toBe(5); // Default priority
    expect(message.maxRetries).toBe(3); // Default max retries
    expect(message.retryCount).toBe(0);
  });
});
