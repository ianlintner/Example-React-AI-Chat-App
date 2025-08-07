export interface QueueMessage {
  id: string;
  type: string;
  payload: any;
  userId?: string;
  conversationId?: string;
  timestamp: Date;
  retryCount?: number;
  maxRetries?: number;
  delayMs?: number;
  priority?: number; // 1-10, higher is more important
  metadata?: Record<string, any>;
}

export interface QueueOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  priority?: number;
  delayMs?: number;
  ttl?: number; // Time to live in milliseconds
}

export interface MessageHandler {
  (message: QueueMessage): Promise<void>;
}

export interface MessageQueueProvider {
  // Core queue operations
  enqueue(
    queueName: string,
    message: QueueMessage,
    options?: QueueOptions
  ): Promise<void>;
  dequeue(queueName: string): Promise<QueueMessage | null>;
  peek(queueName: string): Promise<QueueMessage | null>;

  // Consumer operations
  subscribe(queueName: string, handler: MessageHandler): Promise<void>;
  unsubscribe(queueName: string): Promise<void>;

  // Queue management
  getQueueSize(queueName: string): Promise<number>;
  purgeQueue(queueName: string): Promise<void>;
  deleteQueue(queueName: string): Promise<void>;

  // Health and monitoring
  isHealthy(): Promise<boolean>;
  getStats(queueName?: string): Promise<QueueStats>;

  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Event handling
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
}

export interface QueueStats {
  totalMessages: number;
  pendingMessages: number;
  processingMessages: number;
  completedMessages: number;
  failedMessages: number;
  avgProcessingTime: number;
  queues: string[];
}

export type MessageType =
  | 'chat_message'
  | 'agent_response'
  | 'proactive_action'
  | 'stream_chunk'
  | 'status_update'
  | 'validation_request'
  | 'goal_seeking_update'
  | 'conversation_event';

export interface ChatMessagePayload {
  message: string;
  userId: string;
  conversationId: string;
  forceAgent?: string;
  timestamp: Date;
}

export interface AgentResponsePayload {
  content: string;
  agentUsed: string;
  confidence: number;
  userId: string;
  conversationId: string;
  messageId: string;
  timestamp: Date;
}

export interface ProactiveActionPayload {
  actionType: string;
  agentType: string;
  message: string;
  userId: string;
  conversationId: string;
  timing: 'immediate' | 'delayed';
  delayMs?: number;
  priority: number;
}

export interface StreamChunkPayload {
  messageId: string;
  conversationId: string;
  content: string;
  isComplete: boolean;
  userId: string;
}
