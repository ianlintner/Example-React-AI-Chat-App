import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ChatScreen from '../../components/ChatScreen';
import { socketService } from '../../services/socketService';
import type { Conversation, Message } from '../../types';

// Mock socketService
jest.mock('../../services/socketService', () => ({
  socketService: {
    onAgentStatusUpdate: jest.fn(),
    removeListener: jest.fn(),
    isSocketConnected: jest.fn(() => false),
  },
}));

// Mock WebBrowser
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: {
    FULL_SCREEN: 'full_screen',
  },
}));

describe('ChatScreen', () => {
  const mockConversation: Conversation = {
    id: '1',
    title: 'Test Conversation',
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2023-01-01T10:00:00Z'),
      } as Message,
      {
        id: '2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date('2023-01-01T10:01:00Z'),
        agentUsed: 'general',
      } as Message,
    ],
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-01-01T10:01:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should show empty state when no conversation provided', () => {
      render(<ChatScreen conversation={null} />);

      expect(screen.getByText('Welcome to AI Chat Assistant')).toBeTruthy();
      expect(
        screen.getByText(
          "Start a conversation by typing a message below. I'm here to help you with anything you need!",
        ),
      ).toBeTruthy();
    });

    it('should render conversation with messages', () => {
      render(<ChatScreen conversation={mockConversation} />);

      expect(screen.getByText('Test Conversation')).toBeTruthy();
      expect(screen.getByText('Hello')).toBeTruthy();
      expect(screen.getByText('Hi there!')).toBeTruthy();
    });

    it('should display conversation title in header', () => {
      render(<ChatScreen conversation={mockConversation} />);

      expect(screen.getByText('Test Conversation')).toBeTruthy();
    });

    it('should show message count in expanded header', () => {
      render(<ChatScreen conversation={mockConversation} />);

      expect(screen.getByText('2 messages')).toBeTruthy();
    });
  });

  describe('Message Display', () => {
    it('should display user messages correctly', () => {
      render(<ChatScreen conversation={mockConversation} />);

      expect(screen.getByText('Hello')).toBeTruthy();
    });

    it('should display assistant messages correctly', () => {
      render(<ChatScreen conversation={mockConversation} />);

      expect(screen.getByText('Hi there!')).toBeTruthy();
    });

    it('should display timestamps for messages', () => {
      render(<ChatScreen conversation={mockConversation} />);

      // Check for timestamp format - should show as 4:00 AM and 4:01 AM based on UTC-6 timezone conversion
      expect(screen.getByText(/04:00 AM/)).toBeTruthy();
      expect(screen.getByText(/04:01 AM/)).toBeTruthy();
    });

    it('should show agent name for assistant messages', () => {
      render(<ChatScreen conversation={mockConversation} />);

      // Use getAllByText since "AI Assistant" appears multiple times
      expect(screen.getAllByText('AI Assistant').length).toBeGreaterThan(0);
    });
  });

  describe('Agent Status', () => {
    it('should setup agent status listener on mount', () => {
      render(<ChatScreen conversation={mockConversation} />);

      expect(socketService.onAgentStatusUpdate).toHaveBeenCalled();
    });

    it('should cleanup listeners on unmount', () => {
      const { unmount } = render(
        <ChatScreen conversation={mockConversation} />,
      );

      unmount();

      expect(socketService.removeListener).toHaveBeenCalledWith(
        'agent_status_update',
      );
    });

    it('should check socket connection status', () => {
      render(<ChatScreen conversation={mockConversation} />);

      expect(socketService.isSocketConnected).toHaveBeenCalled();
    });
  });

  describe('Message Status', () => {
    it('should handle streaming messages', () => {
      const streamingConversation: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: 'Loading…',
            timestamp: new Date(),
            status: 'streaming',
          } as Message,
        ],
      };

      render(<ChatScreen conversation={streamingConversation} />);

      expect(screen.getByText('Loading…')).toBeTruthy();
    });

    it('should handle pending messages', () => {
      const pendingConversation: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            status: 'pending',
          } as Message,
        ],
      };

      render(<ChatScreen conversation={pendingConversation} />);

      expect(screen.getByText('Processing your request...')).toBeTruthy();
    });
  });

  describe('YouTube Embed', () => {
    it('should render YouTube embeds in messages', () => {
      const conversationWithYoutube: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: '```youtube\ntest123\nTest Video\n5:30\n```',
            timestamp: new Date(),
          } as Message,
        ],
      };

      render(<ChatScreen conversation={conversationWithYoutube} />);

      expect(screen.getByText('🎬 Test Video')).toBeTruthy();
      expect(screen.getByText('⏱️ 5:30')).toBeTruthy();
    });
  });

  describe('Agent Types', () => {
    it('should display correct agent info for different agent types', () => {
      const conversationWithJokeAgent: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: 'Here is a joke!',
            timestamp: new Date(),
            agentUsed: 'joke',
          } as Message,
        ],
      };

      render(<ChatScreen conversation={conversationWithJokeAgent} />);

      expect(screen.getByText('Comedy Bot')).toBeTruthy();
    });

    it('should display proactive indicator when message is proactive', () => {
      const conversationWithProactive: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: 'Proactive message',
            timestamp: new Date(),
            agentUsed: 'general',
            isProactive: true,
          } as Message,
        ],
      };

      render(<ChatScreen conversation={conversationWithProactive} />);

      expect(screen.getByText('🎯 Proactive')).toBeTruthy();
    });

    it('should display confidence score when available', () => {
      const conversationWithConfidence: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: 'Confident response',
            timestamp: new Date(),
            agentUsed: 'general',
            confidence: 0.95,
          } as Message,
        ],
      };

      render(<ChatScreen conversation={conversationWithConfidence} />);

      expect(screen.getByText('95% confidence')).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('should show feature chips in empty state', () => {
      render(<ChatScreen conversation={null} />);

      expect(screen.getByText('Ask questions')).toBeTruthy();
      expect(screen.getByText('Get coding help')).toBeTruthy();
      expect(screen.getByText('Creative writing')).toBeTruthy();
      expect(screen.getByText('Analysis & research')).toBeTruthy();
    });
  });

  describe('Markdown Rendering', () => {
    it('should render markdown content in messages', () => {
      const conversationWithMarkdown: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: '**Bold text** and *italic text*',
            timestamp: new Date(),
          } as Message,
        ],
      };

      render(<ChatScreen conversation={conversationWithMarkdown} />);

      // The markdown renderer should handle the formatting
      expect(screen.getByText(/Bold text/)).toBeTruthy();
      expect(screen.getByText(/italic text/)).toBeTruthy();
    });
  });

  describe('User Avatar Display', () => {
    it('should display user avatar image when available', () => {
      const conversationWithAvatar: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Hello with avatar',
            timestamp: new Date(),
            user: {
              name: 'Test User',
              email: 'test@example.com',
              avatar: 'https://github.com/avatar.png',
            },
          } as Message,
        ],
      };

      render(<ChatScreen conversation={conversationWithAvatar} />);

      // Check that Avatar.Image is rendered
      expect(screen.getByTestId('avatar-image')).toBeTruthy();

      // Check user info is displayed
      expect(screen.getByText('Test User')).toBeTruthy();
      expect(screen.getByText('test@example.com')).toBeTruthy();
    });

    it('should display text initials when avatar not available', () => {
      const conversationWithoutAvatar: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Hello without avatar',
            timestamp: new Date(),
            user: {
              name: 'Test User',
              email: 'test@example.com',
            },
          } as Message,
        ],
      };

      render(<ChatScreen conversation={conversationWithoutAvatar} />);

      // Check for text avatar with initials "TE"
      expect(screen.getByText('TE')).toBeTruthy();
      expect(screen.getByText('Test User')).toBeTruthy();
      expect(screen.getByText('test@example.com')).toBeTruthy();
    });

    it('should display text initials when user has no avatar', () => {
      const conversationWithUser: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Test message',
            timestamp: new Date(),
            user: {
              name: 'John Doe',
              email: 'john@doe.com',
            },
          } as Message,
        ],
      };

      render(<ChatScreen conversation={conversationWithUser} />);

      // Should show first 2 letters uppercase
      expect(screen.getByText('JO')).toBeTruthy();
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('john@doe.com')).toBeTruthy();
    });

    it('should handle missing user data gracefully', () => {
      const conversationNoUser: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Message without user data',
            timestamp: new Date(),
          } as Message,
        ],
      };

      render(<ChatScreen conversation={conversationNoUser} />);

      // Should show default "U" for user
      expect(screen.getByText('U')).toBeTruthy();
    });

    it('should only show avatars for user messages, not assistant', () => {
      const mixedConversation: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'User message',
            timestamp: new Date(),
            user: {
              name: 'Test User',
              email: 'test@example.com',
              avatar: 'https://github.com/avatar.png',
            },
          } as Message,
          {
            id: '2',
            role: 'assistant',
            content: 'Assistant message',
            timestamp: new Date(),
            agentUsed: 'general',
          } as Message,
        ],
      };

      render(<ChatScreen conversation={mixedConversation} />);

      // Should have user avatar image and user info
      expect(screen.getByTestId('avatar-image')).toBeTruthy();
      expect(screen.getByText('Test User')).toBeTruthy();
      expect(screen.getByText('test@example.com')).toBeTruthy();

      // Assistant should have icon-based avatar (robot icon)
      expect(screen.getByTestId('avatar-icon')).toBeTruthy();
      expect(screen.getAllByText('AI Assistant').length).toBeGreaterThan(0);
    });

    it('should render multiple user messages with different avatars', () => {
      const multiUserConversation: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'First user message',
            timestamp: new Date(),
            user: {
              name: 'Alice',
              email: 'alice@example.com',
              avatar: 'https://github.com/alice.png',
            },
          } as Message,
          {
            id: '2',
            role: 'user',
            content: 'Second user message',
            timestamp: new Date(),
            user: {
              name: 'Bob',
              email: 'bob@example.com',
            },
          } as Message,
        ],
      };

      render(<ChatScreen conversation={multiUserConversation} />);

      // First user has avatar and info
      expect(screen.getByTestId('avatar-image')).toBeTruthy();
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.getByText('alice@example.com')).toBeTruthy();

      // Second user has text initials and info
      expect(screen.getByText('BO')).toBeTruthy();
      expect(screen.getByText('Bob')).toBeTruthy();
      expect(screen.getByText('bob@example.com')).toBeTruthy();
    });

    it('should work when email is not provided', () => {
      const conversationNoEmail: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Message without email',
            timestamp: new Date(),
            user: {
              name: 'Test User',
              avatar: 'https://github.com/avatar.png',
            },
          } as Message,
        ],
      };

      render(<ChatScreen conversation={conversationNoEmail} />);

      // Should display name and avatar but not email
      expect(screen.getByText('Test User')).toBeTruthy();
      expect(screen.getByTestId('avatar-image')).toBeTruthy();
    });
  });
});
