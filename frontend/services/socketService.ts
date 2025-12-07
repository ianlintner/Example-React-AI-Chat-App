import { io, Socket } from 'socket.io-client';
import type { Manager } from 'socket.io-client';
import type {
  Message,
  Conversation,
  StreamChunk,
  ChatRequest,
  AgentStatus,
} from '../types';
import { logger } from './logger';
import authService from './authService';

// Type definitions for stored callbacks
type StreamStartCallback = (data: {
  messageId: string;
  conversationId: string;
}) => void;
type StreamChunkCallback = (chunk: StreamChunk) => void;
type StreamCompleteCallback = (data: {
  messageId: string;
  conversationId: string;
  conversation: Conversation;
}) => void;
type NewMessageCallback = (message: Message) => void;
type ProactiveMessageCallback = (data: { message: Message }) => void;
type StreamErrorCallback = (error: { code: string; message: string }) => void;
type AgentStatusCallback = (status: AgentStatus) => void;

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  // Store callbacks so we can re-register them on reconnect
  private storedCallbacks: {
    stream_start?: StreamStartCallback;
    stream_chunk?: StreamChunkCallback;
    stream_complete?: StreamCompleteCallback;
    new_message?: NewMessageCallback;
    proactive_message?: ProactiveMessageCallback;
    stream_error?: StreamErrorCallback;
    agent_status_update?: AgentStatusCallback;
  } = {};

  // Callbacks for connection events
  public disconnectCallback?: (reason: string) => void;
  public connectErrorCallback?: (err: Error) => void;

  // Register all stored callbacks on the current socket
  private registerStoredCallbacks(): void {
    if (!this.socket) return;
    console.log(
      '[DEBUG] Registering stored callbacks on socket',
      this.socket.id,
    );

    for (const [event, callback] of Object.entries(this.storedCallbacks)) {
      if (callback) {
        console.log('[DEBUG] Re-registering callback for event:', event);
        this.socket.on(event, callback as (...args: unknown[]) => void);
      }
    }
  }

  async connect(): Promise<void> {
    // Try to get authentication token (may be null with oauth2-proxy)
    const token = await authService.getToken();

    return new Promise((resolve, reject) => {
      // Resolve API base URL - prefer explicit env var for local dev
      const isBrowser = typeof window !== 'undefined' && !!window.location;
      const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

      // Use explicit env URL if set, otherwise use window origin for production/port-forwarded scenarios
      // Local development (Expo web) should use the env var to connect to the separate backend server
      const apiBase =
        envApiUrl ||
        (isBrowser ? window.location.origin : 'http://localhost:5001');

      // Socket.IO path is always /api/socket.io to match backend configuration
      const socketPath = '/api/socket.io';

      console.log(
        '[DEBUG] socketService resolved apiBase=',
        apiBase,
        'socketPath=',
        socketPath,
        'envApiUrl=',
        envApiUrl,
      );
      logger.info(
        'Connecting to socket server at:',
        apiBase,
        'path:',
        socketPath,
      );

      // Build auth object - include token if available, otherwise rely on cookies
      const authConfig: { token?: string } = {};
      if (token) {
        authConfig.token = token;
      }

      this.socket = io(apiBase, {
        path: socketPath,
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        withCredentials: true, // Send cookies for oauth2-proxy session
        auth: authConfig,
      });

      this.socket.on('connect', () => {
        logger.info('Socket connected:', this.socket?.id);
        console.log('[DEBUG] Socket connected with id:', this.socket?.id);
        this.isConnected = true;
        // Re-register any stored callbacks when socket connects/reconnects
        this.registerStoredCallbacks();
        resolve();
      });

      // Register stored disconnect and error callbacks if they exist
      if (this.disconnectCallback) {
        this.socket.on('disconnect', this.disconnectCallback);
      }
      if (this.connectErrorCallback) {
        this.socket.on('connect_error', this.connectErrorCallback);
      }

      this.socket.on('error', err => {
        logger.error('⚠️ Socket error event:', err);
      });

      this.socket.on('disconnect', reason => {
        logger.warn('Socket disconnected:', reason);
      });

      this.socket.on('disconnect', () => {
        logger.info('Socket disconnected');
        this.isConnected = false;
      });

      this.socket.on('connect_error', error => {
        const e = error as Error &
          Partial<{ description?: string; context?: unknown; type?: string }>;
        logger.error('❌ Socket connection error:', {
          message: e.message,
          name: e.name,
          description: e.description,
          context: e.context,
          type: e.type,
          stack: e.stack,
        });
        if (this.socket) {
          try {
            const ioManager = (this.socket as unknown as { io?: Manager }).io;
            logger.error('🔍 Socket details:', {
              id: this.socket.id,
              connected: this.socket.connected,
              manager: ioManager as unknown,
            });
          } catch {
            // No-op in tests or when manager shape differs
          }
        }
        this.isConnected = false;
        reject(error);
      });

      // Guard in case the mock socket in tests doesn't provide a Manager (`.io`)
      const manager = (this.socket as unknown as { io?: Manager }).io;
      if (manager?.on) {
        manager.on('reconnect_attempt', (attempt: unknown) => {
          logger.info('🔄 Socket reconnect attempt:', attempt);
        });
        manager.on('reconnect_failed', () => {
          logger.error('❌ Socket reconnect failed');
        });
        manager.on('error', (err: unknown) => {
          logger.error('⚠️ Socket.io manager error:', err);
        });
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // Conversation management
  joinConversation(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('join_conversation', conversationId);
    }
  }

  leaveConversation(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('leave_conversation', conversationId);
    }
  }

  // Streaming chat
  sendStreamingMessage(request: ChatRequest): void {
    if (this.socket) {
      const start = Date.now();
      logger.info('📤 Emitting stream_chat request', {
        hasConversationId: !!request.conversationId,
        messageLength: request.message?.length || 0,
      });
      try {
        this.socket.emit('stream_chat', request, (ack?: unknown) => {
          const ms = Date.now() - start;
          logger.info('✅ Ack for stream_chat', { latencyMs: ms, ack });
        });
      } catch (err) {
        logger.error('❌ Failed to emit stream_chat', err);
      }
    } else {
      logger.error('❌ Cannot emit stream_chat - socket not initialized');
    }
  }

  // Event listeners - callbacks are stored and re-registered on reconnect
  onNewMessage(callback: (message: Message) => void): void {
    this.storedCallbacks.new_message = callback;
    if (this.socket) {
      console.log(
        '[DEBUG] Registering new_message listener on socket',
        this.socket.id,
      );
      this.socket.on('new_message', callback);
    } else {
      console.log(
        '[DEBUG] Storing new_message callback for later registration',
      );
    }
  }

  onStreamStart(
    callback: (data: { messageId: string; conversationId: string }) => void,
  ): void {
    // Wrap callback to add debug logging
    const wrappedCallback: StreamStartCallback = data => {
      console.log(
        '[DEBUG] stream_start callback invoked with:',
        JSON.stringify(data),
      );
      callback(data);
    };
    this.storedCallbacks.stream_start = wrappedCallback;
    if (this.socket) {
      console.log(
        '[DEBUG] Registering stream_start listener on socket',
        this.socket.id,
      );
      this.socket.on('stream_start', wrappedCallback);
    } else {
      console.log(
        '[DEBUG] Storing stream_start callback for later registration',
      );
    }
  }

  onStreamChunk(callback: (chunk: StreamChunk) => void): void {
    this.storedCallbacks.stream_chunk = callback;
    if (this.socket) {
      console.log(
        '[DEBUG] Registering stream_chunk listener on socket',
        this.socket.id,
      );
      this.socket.on('stream_chunk', callback);
    } else {
      console.log(
        '[DEBUG] Storing stream_chunk callback for later registration',
      );
    }
  }

  onStreamComplete(
    callback: (data: {
      messageId: string;
      conversationId: string;
      conversation: Conversation;
      agentUsed?: string;
      confidence?: number;
    }) => void,
  ): void {
    this.storedCallbacks.stream_complete = callback as StreamCompleteCallback;
    if (this.socket) {
      console.log(
        '[DEBUG] Registering stream_complete listener on socket',
        this.socket.id,
      );
      this.socket.on('stream_complete', callback);
    } else {
      console.log(
        '[DEBUG] Storing stream_complete callback for later registration',
      );
    }
  }

  onStreamError(
    callback: (error: { message: string; code: string }) => void,
  ): void {
    this.storedCallbacks.stream_error = callback as StreamErrorCallback;
    if (this.socket) {
      this.socket.on('stream_error', callback);
    }
  }

  onUserTyping(
    callback: (data: {
      userId: string;
      userName?: string;
      isTyping: boolean;
    }) => void,
  ): void {
    if (this.socket) {
      this.socket.on('user_typing', callback);
    }
  }

  onMessageStatus(
    callback: (data: {
      messageId: string;
      status: string;
      readBy: string;
    }) => void,
  ): void {
    if (this.socket) {
      this.socket.on('message_status', callback);
    }
  }

  // Goal-seeking system proactive messages
  onProactiveMessage(
    callback: (data: {
      message: Message;
      actionType: string;
      agentUsed: string;
      confidence: number;
    }) => void,
  ): void {
    this.storedCallbacks.proactive_message =
      callback as ProactiveMessageCallback;
    if (this.socket) {
      console.log(
        '[DEBUG] Registering proactive_message listener on socket',
        this.socket.id,
      );
      this.socket.on('proactive_message', data => {
        logger.info(
          '🎁 Proactive message received in mobile socket service:',
          data,
        );
        callback(data);
      });
    } else {
      console.log(
        '[DEBUG] Storing proactive_message callback for later registration',
      );
    }
  }

  onProactiveError(
    callback: (data: {
      message: string;
      actionType: string;
      error: string;
    }) => void,
  ): void {
    if (this.socket) {
      this.socket.on('proactive_error', callback);
    }
  }

  // Agent status updates
  onAgentStatusUpdate(callback: (status: AgentStatus) => void): void {
    const wrappedCallback: AgentStatusCallback = status => {
      logger.info('📊 Agent status update received:', status);
      callback(status);
    };
    this.storedCallbacks.agent_status_update = wrappedCallback;
    if (this.socket) {
      console.log(
        '[DEBUG] Registering agent_status_update listener on socket',
        this.socket.id,
      );
      this.socket.on('agent_status_update', wrappedCallback);
    } else {
      console.log(
        '[DEBUG] Storing agent_status_update callback for later registration',
      );
    }
  }

  // Typing indicators
  startTyping(conversationId: string, userName?: string): void {
    if (this.socket) {
      this.socket.emit('typing_start', { conversationId, userName });
    }
  }

  stopTyping(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('typing_stop', { conversationId });
    }
  }

  // Message status
  markMessageAsRead(conversationId: string, messageId: string): void {
    if (this.socket) {
      this.socket.emit('message_read', { conversationId, messageId });
    }
  }

  // Remove event listeners
  removeAllListeners(): void {
    // Clear stored callbacks
    this.storedCallbacks = {};
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  removeListener(event: string): void {
    // Clear stored callback for this event
    delete this.storedCallbacks[event as keyof typeof this.storedCallbacks];
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

// Create singleton instance
export const socketService = new SocketService();
export default socketService;
