import { io, Socket } from 'socket.io-client';
import type {
  Message,
  Conversation,
  StreamChunk,
  ChatRequest,
  AgentStatus,
} from '../types';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get API URL from environment variable or use default
      const apiUrl =
        process.env.EXPO_PUBLIC_API_URL ||
        process.env.API_URL ||
        'http://localhost:5001';
      console.log('Connecting to socket server at:', apiUrl);

      this.socket = io(apiUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id);
        this.isConnected = true;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
        this.isConnected = false;
      });

      this.socket.on('connect_error', error => {
        console.error('Socket connection error:', error);
        this.isConnected = false;
        reject(error);
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
    callback: (data: { messageId: string; conversationId: string }) => void
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
    }) => void
  ): void {
    if (this.socket) {
      this.socket.on('stream_complete', callback);
    }
  }

  onStreamError(
    callback: (error: { message: string; code: string }) => void
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
    }) => void
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
    }) => void
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
    }) => void
  ): void {
    if (this.socket) {
      this.socket.on('proactive_message', data => {
        console.log(
          '🎁 Proactive message received in mobile socket service:',
          JSON.stringify(data, null, 2)
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
    }) => void
  ): void {
    if (this.socket) {
      this.socket.on('proactive_error', callback);
    }
  }

  // Agent status updates
  onAgentStatusUpdate(callback: (status: AgentStatus) => void): void {
    if (this.socket) {
      this.socket.on('agent_status_update', status => {
        console.log('📊 Agent status update received:', status);
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
