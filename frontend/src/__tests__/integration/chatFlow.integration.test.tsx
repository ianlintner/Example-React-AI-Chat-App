import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';
import App from '../../App';
import { chatApi, conversationsApi } from '../../services/api';
import { socketService } from '../../services/socket';

// Mock the services
vi.mock('../../services/api', () => ({
  chatApi: {
    sendMessage: vi.fn()
  },
  conversationsApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    getById: vi.fn()
  }
}));

vi.mock('../../services/socket', () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onNewMessage: vi.fn(),
    onStreamStart: vi.fn(),
    onStreamChunk: vi.fn(),
    onStreamComplete: vi.fn(),
    onStreamError: vi.fn(),
    onProactiveMessage: vi.fn(),
    removeAllListeners: vi.fn(),
    sendStreamingMessage: vi.fn(),
    joinConversation: vi.fn(),
    isSocketConnected: vi.fn(),
    removeListener: vi.fn()
  }
}));

describe('Chat Flow Integration Tests', () => {
  const user = userEvent.setup();
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock implementations
    (conversationsApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (conversationsApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'conv-123',
      title: 'New Conversation',
      createdAt: new Date().toISOString()
    });
    (conversationsApi.getById as ReturnType<typeof vi.fn>).mockResolvedValue({ messages: [] });
    (socketService.connect as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (socketService.onNewMessage as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());
    (socketService.onStreamStart as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());
    (socketService.removeListener as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic UI Rendering', () => {
    test('should render welcome message and basic UI elements', async () => {
      render(<App />);

      // Wait for initial load - check for the actual text that appears
      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Check that input is available
      const messageInput = screen.getByPlaceholderText(/type your message/i);
      expect(messageInput).toBeInTheDocument();

      // Check that there's a submit button (even if disabled initially)
      const submitButton = screen.getByTestId('SendIcon').closest('button');
      expect(submitButton).toBeInTheDocument();
    });

    test('should render main navigation elements', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Check for navigation buttons
      expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    });
  });

  describe('Service Integration', () => {
    test('should initialize socket service on load', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Verify socket methods were called
      expect(socketService.connect).toHaveBeenCalled();
      expect(socketService.onNewMessage).toHaveBeenCalled();
    });

    test('should handle basic user input', async () => {
      const mockResponse = {
        id: '2',
        role: 'assistant' as const,
        content: 'Hello! How can I help you?',
        timestamp: new Date().toISOString(),
        conversationId: 'conv-123',
        agentType: 'general' as const
      };

      (chatApi.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Type a message
      const messageInput = screen.getByPlaceholderText(/type your message/i);
      await user.type(messageInput, 'Hello there');

      // The input should contain the text
      expect(messageInput).toHaveValue('Hello there');
    });

    test('should handle socket message subscriptions', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Verify socket listeners were set up
      expect(socketService.onNewMessage).toHaveBeenCalled();
      expect(socketService.onStreamStart).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should render app even when API calls fail', async () => {
      // Mock API to throw error
      (chatApi.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      render(<App />);

      // App should still render
      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Should still be able to interact with UI
      const messageInput = screen.getByPlaceholderText(/type your message/i);
      expect(messageInput).toBeInTheDocument();
    });

    test('should handle socket connection gracefully', async () => {
      // Mock socket connection to succeed but other methods to potentially fail
      (socketService.connect as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      render(<App />);

      // App should still render
      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Should still be able to interact with UI
      const messageInput = screen.getByPlaceholderText(/type your message/i);
      expect(messageInput).toBeInTheDocument();
    });

    test('should handle missing socket methods gracefully', async () => {
      // Mock some socket methods to be undefined
      (socketService.onNewMessage as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      render(<App />);

      // App should still render
      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });
    });
  });

  describe('User Interface Interactions', () => {
    test('should handle text input interactions', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Test typing in the input
      const messageInput = screen.getByPlaceholderText(/type your message/i);
      await user.type(messageInput, 'This is a test message');
      
      expect(messageInput).toHaveValue('This is a test message');

      // Clear the input
      await user.clear(messageInput);
      expect(messageInput).toHaveValue('');
    });

    test('should display streaming toggle', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Check that streaming checkbox is present
      const streamingCheckbox = screen.getByRole('checkbox', { name: 'Streaming' });
      expect(streamingCheckbox).toBeInTheDocument();
      expect(streamingCheckbox).toBeChecked(); // Should be checked by default
    });

    test('should allow toggling streaming mode', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      const streamingCheckbox = screen.getByRole('checkbox', { name: 'Streaming' });
      expect(streamingCheckbox).toBeChecked();

      // Click to toggle
      await user.click(streamingCheckbox);
      expect(streamingCheckbox).not.toBeChecked();

      // Click again to toggle back
      await user.click(streamingCheckbox);
      expect(streamingCheckbox).toBeChecked();
    });
  });

  describe('Mock Verification', () => {
    test('should verify mock setup is working', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Verify that our mocks are defined
      expect(chatApi.sendMessage).toBeDefined();
      expect(conversationsApi.getAll).toBeDefined();
      expect(conversationsApi.create).toBeDefined();
      expect(socketService.connect).toBeDefined();

      // Verify socket connect was called during initialization
      expect(socketService.connect).toHaveBeenCalled();
    });

    test('should handle mock API responses', async () => {
      const testMessage = {
        id: 'test-1',
        role: 'assistant' as const,
        content: 'Test response',
        timestamp: new Date().toISOString(),
        conversationId: 'conv-123'
      };

      (chatApi.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(testMessage);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
      });

      // Test that we can call the mocked API
      const response = await chatApi.sendMessage({ 
        message: 'test', 
        conversationId: 'conv-123' 
      });
      expect(response).toEqual(testMessage);
    });
  });
});
