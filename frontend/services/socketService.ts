import { io, Socket } from 'socket.io-client';
import type {
  Message,
  Conversation,
  StreamChunk,
  ChatRequest,
  AgentStatus,
} from '../types';
import { logger } from './logger';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Resolve API base URL
      const isBrowser = typeof window !== 'undefined' && !!window.location;
      const apiBase = 'wss://chat-backend.hugecat.net';

      // const apiBase =
      //   process.env.EXPO_PUBLIC_API_URL ||
      //   process.env.API_URL ||
      //   (isBrowser ? window.location.origin : 'http://chat-backend.hugecat.net');

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
        logger.error('❌ Socket connection error:', {
          message: error.message,
          name: error.name,
          description: (error as any).description,
          context: (error as any).context,
          type: (error as any).type,
          stack: error.stack,
        });
        if (this.socket) {
          logger.error('🔍 Socket details:', {
            id: this.socket.id,
            connected: this.socket.connected,
            uri: (this.socket.io as any).uri,
            opts: (this.socket.io as any).opts,
          });
        }
        this.isConnected = false;
        reject(error);
      });

      this.socket.io.on('reconnect_attempt', attempt => {
        logger.info('🔄 Socket reconnect attempt:', attempt);
      });

      this.socket.io.on('reconnect_failed', () => {
        logger.error('❌ Socket reconnect failed');
      });

      this.socket.io.on('error', err => {
        logger.error('⚠️ Socket.io manager error:', err);
      });
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
