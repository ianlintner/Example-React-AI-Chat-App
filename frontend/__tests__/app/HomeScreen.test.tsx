import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import HomeScreen from '../../app/(tabs)/index';
import { socketService } from '../../services/socketService';
import type { Message, Conversation, StreamChunk } from '../../types';

// Mock dependencies
jest.mock('../../services/socketService');
jest.mock('../../components/ChatScreen', () => {
  const MockChatScreen = ({
    conversation,
  }: {
    conversation: Conversation | null;
  }) => {
    const React = jest.requireActual('react');
    return React.createElement(
      'View',
      { testID: 'chat-screen' },
      React.createElement(
        'Text',
        null,
        conversation
          ? `Conversation: ${conversation.title}`
          : 'No conversation',
      ),
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
      React.createElement(
        'Text',
        null,
        disabled ? 'Input disabled' : 'Input enabled',
      ),
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
        React.createElement('Text', null, 'Send Test Message'),
      ),
    );
  };
  return MockMessageInput;
});

const mockSocketService = socketService as jest.Mocked<typeof socketService>;

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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

  describe('Initialization', () => {
    it('should show loading state initially', () => {
      render(<HomeScreen />);

      expect(screen.getByText('Connecting to AI Assistant...')).toBeTruthy();
      expect(screen.getByTestId('activity-indicator')).toBeTruthy();
    });

    it('should connect to socket service on mount', async () => {
      render(<HomeScreen />);

      await waitFor(
        () => {
          expect(mockSocketService.connect).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );
    });

    it('should show chat screen after successful connection', async () => {
      render(<HomeScreen />);

      await waitFor(
        () => {
          expect(screen.getByTestId('chat-screen')).toBeTruthy();
          expect(screen.getByTestId('message-input')).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it('should setup socket event listeners', async () => {
      render(<HomeScreen />);

      await waitFor(
        () => {
          expect(mockSocketService.onNewMessage).toHaveBeenCalled();
          expect(mockSocketService.onStreamStart).toHaveBeenCalled();
          expect(mockSocketService.onStreamChunk).toHaveBeenCalled();
          expect(mockSocketService.onStreamComplete).toHaveBeenCalled();
          expect(mockSocketService.onProactiveMessage).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );
    });
  });

  describe('Error Handling', () => {
    it('should show error state when connection fails', async () => {
      mockSocketService.connect.mockRejectedValue(
        new Error('Connection failed'),
      );

      render(<HomeScreen />);

      await waitFor(
        () => {
          expect(screen.getByText('Connection Error')).toBeTruthy();
          expect(
            screen.getByText(
              'Failed to connect to server. Please check your connection.',
            ),
          ).toBeTruthy();
          expect(
            screen.getByText(
              'Please check your connection and restart the app.',
            ),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  describe('Message Handling', () => {
    let onNewMessage: (message: Message) => void;
    let onStreamStart: (data: {
      messageId: string;
      conversationId: string;
    }) => void;
    let _onStreamChunk: (chunk: StreamChunk) => void;
    let _onStreamComplete: (data: {
      messageId: string;
      conversationId: string;
      conversation: Conversation;
      agentUsed?: string;
      confidence?: number;
    }) => void;
    let onProactiveMessage: (data: {
      message: Message;
      actionType: string;
      agentUsed: string;
      confidence: number;
    }) => void;

    beforeEach(async () => {
      render(<HomeScreen />);

      await waitFor(
        () => {
          expect(mockSocketService.onNewMessage).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );

      // Capture the event handlers
      onNewMessage = mockSocketService.onNewMessage.mock.calls[0][0];
      onStreamStart = mockSocketService.onStreamStart.mock.calls[0][0];
      _onStreamChunk = mockSocketService.onStreamChunk.mock.calls[0][0];
      _onStreamComplete = mockSocketService.onStreamComplete.mock.calls[0][0];
      onProactiveMessage =
        mockSocketService.onProactiveMessage.mock.calls[0][0];
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

      await waitFor(
        () => {
          expect(
            screen.getByText('Conversation: AI Assistant Chat'),
          ).toBeTruthy();
        },
        { timeout: 3000 },
      );
    });

    it('should handle stream start and create pending message', async () => {
      act(() => {
        onStreamStart({ messageId: 'msg-1', conversationId: 'conv-1' });
      });

      await waitFor(
        () => {
          expect(
            screen.getByText('Conversation: AI Assistant Chat'),
          ).toBeTruthy();
        },
        { timeout: 3000 },
      );
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

      await waitFor(
        () => {
          expect(
            screen.getByText('Conversation: AI Assistant Chat'),
          ).toBeTruthy();
        },
        { timeout: 3000 },
      );
    });
  });

  describe('Message Sending', () => {
    it('should handle message sent from input', async () => {
      render(<HomeScreen />);

      await waitFor(
        () => {
          expect(screen.getByTestId('send-message-button')).toBeTruthy();
        },
        { timeout: 5000 },
      );

      const sendButton = screen.getByTestId('send-message-button');

      act(() => {
        sendButton.props.onPress();
      });

      await waitFor(
        () => {
          expect(
            screen.getByText('Conversation: AI Assistant Chat'),
          ).toBeTruthy();
        },
        { timeout: 3000 },
      );
    });
  });

  describe('App State Handling', () => {
    it('should reconnect when app becomes active and socket is disconnected', async () => {
      mockSocketService.isSocketConnected.mockReturnValue(false);

      render(<HomeScreen />);

      await waitFor(
        () => {
          expect(mockSocketService.connect).toHaveBeenCalledTimes(1);
        },
        { timeout: 5000 },
      );

      // Clear mock calls and setup for reconnection
      mockSocketService.connect.mockClear();
      mockSocketService.connect.mockResolvedValue();

      // Simulate app state change to active
      act(() => {
        const appStateListener = (AppState.addEventListener as jest.Mock).mock
          .calls[0][1];
        appStateListener('active');
      });

      await waitFor(
        () => {
          expect(mockSocketService.connect).toHaveBeenCalledTimes(1);
        },
        { timeout: 3000 },
      );
    });
  });

  describe('Connection Status', () => {
    it('should show input as enabled when connected', async () => {
      render(<HomeScreen />);

      await waitFor(
        () => {
          expect(screen.getByText('Input enabled')).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  describe('Cleanup', () => {
    it('should cleanup socket listeners on unmount', async () => {
      const { unmount } = render(<HomeScreen />);

      await waitFor(
        () => {
          expect(mockSocketService.onNewMessage).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );

      unmount();

      expect(mockSocketService.removeListener).toHaveBeenCalledWith(
        'new_message',
      );
      expect(mockSocketService.removeListener).toHaveBeenCalledWith(
        'stream_start',
      );
      expect(mockSocketService.removeListener).toHaveBeenCalledWith(
        'stream_chunk',
      );
      expect(mockSocketService.removeListener).toHaveBeenCalledWith(
        'stream_complete',
      );
      expect(mockSocketService.removeListener).toHaveBeenCalledWith(
        'proactive_message',
      );
      expect(mockSocketService.disconnect).toHaveBeenCalled();
    });
  });
});
