import { socketService } from '../../services/socketService';
import { io } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client');

const mockIo = io as jest.MockedFunction<typeof io>;
const mockSocket = {
  id: 'test-socket-id',
  connected: true,
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(),
};

describe('SocketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIo.mockReturnValue(mockSocket as any);
  });

  afterEach(() => {
    socketService.disconnect();
  });

  describe('connect', () => {
    it('should connect to socket server successfully', async () => {
      // Simulate successful connection
      mockSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });

      const connectPromise = socketService.connect();
      await connectPromise;

      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: true,
        }),
      );
      expect(socketService.isSocketConnected()).toBe(true);
    });

    it('should handle connection error', async () => {
      const testError = new Error('Connection failed');

      mockSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(testError), 0);
        }
      });

      await expect(socketService.connect()).rejects.toThrow(
        'Connection failed',
      );
    });

    it('should use environment variable for API URL', async () => {
      const originalEnv = process.env.EXPO_PUBLIC_API_URL;
      process.env.EXPO_PUBLIC_API_URL = 'http://custom-url:3000';

      mockSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });

      await socketService.connect();

      expect(mockIo).toHaveBeenCalledWith(
        'http://custom-url:3000',
        expect.any(Object),
      );

      process.env.EXPO_PUBLIC_API_URL = originalEnv;
    });
  });

  describe('disconnect', () => {
    it('should disconnect socket when connected', () => {
      // First connect
      socketService.connect();

      socketService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(socketService.isSocketConnected()).toBe(false);
    });
  });

  describe('conversation management', () => {
    beforeEach(async () => {
      mockSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      await socketService.connect();
    });

    it('should join conversation', () => {
      const conversationId = 'test-conversation-id';

      socketService.joinConversation(conversationId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'join_conversation',
        conversationId,
      );
    });

    it('should leave conversation', () => {
      const conversationId = 'test-conversation-id';

      socketService.leaveConversation(conversationId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'leave_conversation',
        conversationId,
      );
    });
  });

  describe('streaming chat', () => {
    beforeEach(async () => {
      mockSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      await socketService.connect();
    });

    it('should send streaming message', () => {
      const request = {
        message: 'test message',
        conversationId: 'test-conversation',
        userId: 'test-user',
      };

      socketService.sendStreamingMessage(request);

      expect(mockSocket.emit).toHaveBeenCalledWith('stream_chat', request);
    });
  });

  describe('event listeners', () => {
    beforeEach(async () => {
      mockSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      await socketService.connect();
    });

    it('should set up new message listener', () => {
      const callback = jest.fn();

      socketService.onNewMessage(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('new_message', callback);
    });

    it('should set up stream start listener', () => {
      const callback = jest.fn();

      socketService.onStreamStart(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('stream_start', callback);
    });

    it('should set up stream chunk listener', () => {
      const callback = jest.fn();

      socketService.onStreamChunk(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('stream_chunk', callback);
    });

    it('should set up stream complete listener', () => {
      const callback = jest.fn();

      socketService.onStreamComplete(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('stream_complete', callback);
    });

    it('should set up stream error listener', () => {
      const callback = jest.fn();

      socketService.onStreamError(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('stream_error', callback);
    });

    it('should set up proactive message listener', () => {
      const callback = jest.fn();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      socketService.onProactiveMessage(callback);

      expect(mockSocket.on).toHaveBeenCalledWith(
        'proactive_message',
        expect.any(Function),
      );

      consoleSpy.mockRestore();
    });

    it('should set up agent status update listener', () => {
      const callback = jest.fn();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      socketService.onAgentStatusUpdate(callback);

      expect(mockSocket.on).toHaveBeenCalledWith(
        'agent_status_update',
        expect.any(Function),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('typing indicators', () => {
    beforeEach(async () => {
      mockSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      await socketService.connect();
    });

    it('should start typing', () => {
      const conversationId = 'test-conversation';
      const userName = 'test-user';

      socketService.startTyping(conversationId, userName);

      expect(mockSocket.emit).toHaveBeenCalledWith('typing_start', {
        conversationId,
        userName,
      });
    });

    it('should stop typing', () => {
      const conversationId = 'test-conversation';

      socketService.stopTyping(conversationId);

      expect(mockSocket.emit).toHaveBeenCalledWith('typing_stop', {
        conversationId,
      });
    });
  });

  describe('message status', () => {
    beforeEach(async () => {
      mockSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      await socketService.connect();
    });

    it('should mark message as read', () => {
      const conversationId = 'test-conversation';
      const messageId = 'test-message';

      socketService.markMessageAsRead(conversationId, messageId);

      expect(mockSocket.emit).toHaveBeenCalledWith('message_read', {
        conversationId,
        messageId,
      });
    });
  });

  describe('listener management', () => {
    beforeEach(async () => {
      mockSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      await socketService.connect();
    });

    it('should remove all listeners', () => {
      socketService.removeAllListeners();

      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    });

    it('should remove specific listener', () => {
      const event = 'test_event';

      socketService.removeListener(event);

      expect(mockSocket.off).toHaveBeenCalledWith(event);
    });
  });

  describe('connection state', () => {
    it('should return false when not connected', () => {
      expect(socketService.isSocketConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      mockSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });

      await socketService.connect();

      expect(socketService.isSocketConnected()).toBe(true);
    });
  });
});
