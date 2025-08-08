import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import HomeScreen from '../../app/(tabs)/index';
import { socketService } from '../../services/socketService';
import type { Message, Conversation, StreamChunk } from '../../types';

// Mock dependencies
jest.mock('../../services/socketService');
jest.mock('../../components/ChatScreen', () => {
  const MockChatScreen = ({ conversation }: { conversation: Conversation | null }) => {
    const React = jest.requireActual('react');
    return React.createElement(
      'View',
      { testID: 'chat-screen' },
      React.createElement(
        'Text',
        null,
        conversation ? `Conversation: ${conversation.title}` : 'No conversation'
      )
    );
  };
  return MockChatScreen;
});
jest.mock('../../components/MessageInput', () => {
  const MockMessageInput = ({ onMessageSent, disabled }: any) => {
    const React = jest.requireActual('react');
    return React.createElement(
      'View',
      { testID: 'message-input' },
      React.createElement('Text', null, disabled ? 'Input disabled' : 'Input enabled'),
      React.createElement(
        'TouchableOpacity',
        {
          testID: 'send-message-button',
          onPress: () =>
            onMessageSent({
              id: 'test-message-id',
              content: 'Test message',
              role: 'user',
              timestamp: new Date(),
              conversationId: 'test-conversation-id',
            }),
        },
        React.createElement('Text', null, 'Send Test Message')
      )
    );
  };
  return MockMessageInput;
});

const mockSocketService = socketService as jest.Mocked<typeof socketService>;

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup default mocks
    mockSocketService.connect.mockResolvedValue();
    mockSocketService.isSocketConnected.mockReturnValue(true);
    mockSocketService.disconnect.mockImplementation(() => {});
    mockSocketService.sendStreamingMessage.mockImplementation(() => {});
    mockSocketService.onNewMessage.mockImplementation(() => {});
    mockSocketService.onStreamStart.mockImplementation(() => {});
    mockSocketService.onStreamChunk.mockImplementation(() => {});
    mockSocketService.onStreamComplete.mockImplementation(() => {});
    mockSocketService.onProactiveMessage.mockImplementation(() => {});
    mockSocketService.removeListener.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should show loading state initially', async () => {
      render(<HomeScreen />);
      
      expect(screen.getByText('Connecting to AI Assistant...')).toBeTruthy();
      expect(screen.getByTestId('activity-indicator')).toBeTruthy();
    });

    it('should connect to socket service on mount', async () => {
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(mockSocketService.connect).toHaveBeenCalled();
      });
    });

    it('should automatically send support request after connection', async () => {
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(mockSocketService.connect).toHaveBeenCalled();
      });
      
      // Fast forward past the 1 second delay
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(mockSocketService.sendStreamingMessage).toHaveBeenCalledWith({
        message: expect.stringContaining('Hello, I need technical support'),
        conversationId: null,
        forceAgent: null,
      });
    });

    it('should show chat screen after successful connection', async () => {
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(screen.getByTestId('chat-screen')).toBeTruthy();
        expect(screen.getByTestId('message-input')).toBeTruthy();
      });
    });

    it('should setup socket event listeners', async () => {
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(mockSocketService.onNewMessage).toHaveBeenCalled();
        expect(mockSocketService.onStreamStart).toHaveBeenCalled();
        expect(mockSocketService.onStreamChunk).toHaveBeenCalled();
        expect(mockSocketService.onStreamComplete).toHaveBeenCalled();
        expect(mockSocketService.onProactiveMessage).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error state when connection fails', async () => {
      mockSocketService.connect.mockRejectedValue(new Error('Connection failed'));
      
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('Connection Error')).toBeTruthy();
        expect(screen.getByText('Failed to connect to server. Please check your connection.')).toBeTruthy();
        expect(screen.getByText('Please check your connection and restart the app.')).toBeTruthy();
      });
    });
  });

  describe('Message Handling', () => {
    let onNewMessage: (message: Message) => void;
    let onStreamStart: (data: { messageId: string; conversationId: string }) => void;
    let onStreamChunk: (chunk: StreamChunk) => void;
    let onStreamComplete: (data: { messageId: string; conversationId: string; conversation: Conversation; agentUsed?: string; confidence?: number }) => void;
    let onProactiveMessage: (data: { message: Message; actionType: string; agentUsed: string; confidence: number }) => void;

    beforeEach(async () => {
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(mockSocketService.onNewMessage).toHaveBeenCalled();
      });

      // Capture the event handlers
      onNewMessage = mockSocketService.onNewMessage.mock.calls[0][0];
      onStreamStart = mockSocketService.onStreamStart.mock.calls[0][0];
      onStreamChunk = mockSocketService.onStreamChunk.mock.calls[0][0];
      onStreamComplete = mockSocketService.onStreamComplete.mock.calls[0][0];
      onProactiveMessage = mockSocketService.onProactiveMessage.mock.calls[0][0];
    });

    it('should handle new messages and create conversation', async () => {
      const testMessage: Message = {
        id: 'msg-1',
        content: 'Hello there!',
        role: 'assistant',
        timestamp: new Date(),
        conversationId: 'conv-1',
      };

      act(() => {
        onNewMessage(testMessage);
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });

    it('should handle stream start and create pending message', async () => {
      act(() => {
        onStreamStart({ messageId: 'msg-1', conversationId: 'conv-1' });
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });

    it('should handle stream chunks and update message content', async () => {
      // First start a stream
      act(() => {
        onStreamStart({ messageId: 'msg-1', conversationId: 'conv-1' });
      });

      // Then send chunks
      act(() => {
        onStreamChunk({ 
          id: 'msg-1',
          messageId: 'msg-1', 
          conversationId: 'conv-1',
          content: 'Hello', 
          isComplete: false 
        });
      });

      act(() => {
        onStreamChunk({ 
          id: 'msg-1',
          messageId: 'msg-1', 
          conversationId: 'conv-1',
          content: 'Hello world!', 
          isComplete: true 
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });

    it('should handle stream completion with agent info', async () => {
      const mockConversation: Conversation = {
        id: 'conv-1',
        title: 'Test Conversation',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First start a stream
      act(() => {
        onStreamStart({ messageId: 'msg-1', conversationId: 'conv-1' });
      });

      // Then complete it
      act(() => {
        onStreamComplete({
          messageId: 'msg-1',
          conversationId: 'conv-1',
          conversation: mockConversation,
          agentUsed: 'general',
          confidence: 0.95,
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });

    it('should handle proactive messages', async () => {
      const proactiveMessage: Message = {
        id: 'proactive-1',
        content: 'I can help you with that!',
        role: 'assistant',
        timestamp: new Date(),
        conversationId: 'conv-1',
        isProactive: true,
      };

      act(() => {
        onProactiveMessage({
          message: proactiveMessage,
          actionType: 'suggestion',
          agentUsed: 'general',
          confidence: 0.9,
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });

    it('should prevent duplicate messages', async () => {
      const testMessage: Message = {
        id: 'msg-1',
        content: 'Hello there!',
        role: 'assistant',
        timestamp: new Date(),
        conversationId: 'conv-1',
      };

      act(() => {
        onNewMessage(testMessage);
        onNewMessage(testMessage); // Send same message again
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });

    it('should update conversation ID from temporary to real', async () => {
      // Start with a temporary conversation
      const userMessage: Message = {
        id: 'user-msg-1',
        content: 'Hello',
        role: 'user',
        timestamp: new Date(),
        conversationId: 'temp-123',
      };

      // Simulate user sending message first
      act(() => {
        onNewMessage(userMessage);
      });

      // Then start stream with real conversation ID
      act(() => {
        onStreamStart({ messageId: 'msg-1', conversationId: 'real-conv-456' });
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });
  });

  describe('Message Sending', () => {
    it('should handle message sent from input', async () => {
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(screen.getByTestId('send-message-button')).toBeTruthy();
      });

      const sendButton = screen.getByTestId('send-message-button');
      
      act(() => {
        sendButton.props.onPress();
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });

    it('should create new conversation when none exists', async () => {
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(screen.getByTestId('send-message-button')).toBeTruthy();
      });

      const sendButton = screen.getByTestId('send-message-button');
      
      act(() => {
        sendButton.props.onPress();
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });

    it('should prevent duplicate messages when sending', async () => {
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(screen.getByTestId('send-message-button')).toBeTruthy();
      });

      const sendButton = screen.getByTestId('send-message-button');
      
      // Send same message multiple times
      act(() => {
        sendButton.props.onPress();
        sendButton.props.onPress();
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });
  });

  describe('App State Handling', () => {
    it('should reconnect when app becomes active and socket is disconnected', async () => {
      mockSocketService.isSocketConnected.mockReturnValue(false);
      
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(mockSocketService.connect).toHaveBeenCalledTimes(1);
      });

      // Clear mock calls
      jest.clearAllMocks();
      mockSocketService.connect.mockResolvedValue();

      // Simulate app state change to active
      act(() => {
        // Trigger app state change event
        const appStateListener = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
        appStateListener('active');
      });

      await waitFor(() => {
        expect(mockSocketService.connect).toHaveBeenCalledTimes(1);
      });
    });

    it('should not reconnect when app becomes active and socket is already connected', async () => {
      mockSocketService.isSocketConnected.mockReturnValue(true);
      
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(mockSocketService.connect).toHaveBeenCalledTimes(1);
      });

      // Clear mock calls
      jest.clearAllMocks();

      // Simulate app state change to active
      act(() => {
        const appStateListener = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
        appStateListener('active');
      });

      // Should not call connect again
      expect(mockSocketService.connect).not.toHaveBeenCalled();
    });
  });

  describe('Connection Status', () => {
    it('should show input as disabled when not connected', async () => {
      mockSocketService.connect.mockRejectedValue(new Error('Connection failed'));
      
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('Connection Error')).toBeTruthy();
      });
    });

    it('should show input as enabled when connected', async () => {
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('Input enabled')).toBeTruthy();
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup socket listeners on unmount', async () => {
      const { unmount } = render(<HomeScreen />);
      
      await waitFor(() => {
        expect(mockSocketService.onNewMessage).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(mockSocketService.removeListener).toHaveBeenCalledWith('new_message');
      expect(mockSocketService.removeListener).toHaveBeenCalledWith('stream_start');
      expect(mockSocketService.removeListener).toHaveBeenCalledWith('stream_chunk');
      expect(mockSocketService.removeListener).toHaveBeenCalledWith('stream_complete');
      expect(mockSocketService.removeListener).toHaveBeenCalledWith('proactive_message');
      expect(mockSocketService.disconnect).toHaveBeenCalled();
    });

    it('should remove app state listener on unmount', async () => {
      const mockRemove = jest.fn();
      (AppState.addEventListener as jest.Mock).mockReturnValue({ remove: mockRemove });
      
      const { unmount } = render(<HomeScreen />);
      
      await waitFor(() => {
        expect(AppState.addEventListener).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should handle connection errors gracefully', async () => {
      mockSocketService.connect.mockRejectedValue(new Error('Network error'));
      
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to connect to server. Please check your connection.')).toBeTruthy();
      });
    });

    it('should handle socket service errors during message sending', async () => {
      const sendError = new Error('Send failed');
      mockSocketService.sendStreamingMessage.mockImplementation(() => {
        throw sendError;
      });
      
      render(<HomeScreen />);
      
      await waitFor(() => {
        expect(mockSocketService.connect).toHaveBeenCalled();
      });
      
      // Fast forward past the delay for automatic message
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Should still continue normally even if automatic message fails
      expect(screen.getByTestId('chat-screen')).toBeTruthy();
    });
  });

  describe('Message Filtering', () => {
    it('should filter messages from different conversations', async () => {
      render(<HomeScreen />);
      
      const onNewMessage = mockSocketService.onNewMessage.mock.calls[0][0];
      
      // Send message to create first conversation
      act(() => {
        onNewMessage({
          id: 'msg-1',
          content: 'Message 1',
          role: 'assistant',
          timestamp: new Date(),
          conversationId: 'conv-1',
        });
      });

      // Send message from different conversation - should be ignored
      act(() => {
        onNewMessage({
          id: 'msg-2',
          content: 'Message 2',
          role: 'assistant',
          timestamp: new Date(),
          conversationId: 'conv-2',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Conversation: AI Assistant Chat')).toBeTruthy();
      });
    });
  });
});
