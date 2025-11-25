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

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    // Get authentication token
    const token = await authService.getToken();

    return new Promise((resolve, reject) => {
      if (!token) {
        reject(new Error('No authentication token available'));
        return;
      }

      // Resolve API base URL (prefer env for tests and local dev)
      const isBrowser = typeof window !== 'undefined' && !!window.location;
      const apiBase =
        process.env.EXPO_PUBLIC_API_URL ||
        process.env.API_URL ||
        (isBrowser ? window.location.origin : 'http://localhost:3000');

      // When using same-origin behind a gateway, route socket path via /api
      const socketPath = isBrowser ? '/api/socket.io' : '/socket.io';

      logger.info(
        'Connecting to socket server at:',
        apiBase,
        'path:',
        socketPath,
      );

      this.socket = io(apiBase, {
        path: socketPath,
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        auth: {
          token, // Send JWT token for authentication
        },
      });

      this.socket.on('connect', () => {
        logger.info('Socket connected:', this.socket?.id);
        this.isConnected = true;
        resolve();
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
      this.socket.emit('stream_chat', request);
    }
  }

  // Event listeners
  onNewMessage(callback: (message: Message) => void): void {
    if (this.socket) {
      this.socket.on('new_message', callback);
    }
  }

  onStreamStart(
    callback: (data: { messageId: string; conversationId: string }) => void,
  ): void {
    if (this.socket) {
      this.socket.on('stream_start', callback);
    }
  }

  onStreamChunk(callback: (chunk: StreamChunk) => void): void {
    if (this.socket) {
      this.socket.on('stream_chunk', callback);
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
    if (this.socket) {
      this.socket.on('stream_complete', callback);
    }
  }

  onStreamError(
    callback: (error: { message: string; code: string }) => void,
  ): void {
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
    if (this.socket) {
      this.socket.on('proactive_message', data => {
        logger.info(
          '🎁 Proactive message received in mobile socket service:',
          data,
        );
        callback(data);
      });
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
    if (this.socket) {
      this.socket.on('agent_status_update', status => {
        logger.info('📊 Agent status update received:', status);
        callback(status);
      });
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
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  removeListener(event: string): void {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

// Create singleton instance
export const socketService = new SocketService();
export default socketService;
