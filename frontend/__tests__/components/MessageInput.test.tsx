import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MessageInput from '../../components/MessageInput';
import { socketService } from '../../services/socketService';

// Mock dependencies
jest.mock('../../services/socketService');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

const mockSocketService = socketService as jest.Mocked<typeof socketService>;

describe('MessageInput', () => {
  const defaultProps = {
    onMessageSent: jest.fn(),
    conversationId: 'test-conv-id',
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketService.isSocketConnected.mockReturnValue(true);
    mockSocketService.sendStreamingMessage.mockImplementation(jest.fn());
    mockSocketService.startTyping.mockImplementation(jest.fn());
    mockSocketService.stopTyping.mockImplementation(jest.fn());
  });

  it('should render correctly with default props', () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    
    expect(getByPlaceholderText('Message #ai-assistant')).toBeTruthy();
  });

  it('should handle text input changes', () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    fireEvent.changeText(input, 'Hello world');
    
    expect(input.props.value).toBe('Hello world');
    expect(mockSocketService.startTyping).toHaveBeenCalledWith('test-conv-id');
  });

  it('should call onMessageSent when send button is pressed', async () => {
    const { getByPlaceholderText, getByTestId } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    const sendButton = getByTestId('send-button');
    
    fireEvent.changeText(input, 'Test message');
    fireEvent.press(sendButton);
    
    await waitFor(() => {
      expect(mockSocketService.sendStreamingMessage).toHaveBeenCalled();
      expect(defaultProps.onMessageSent).toHaveBeenCalled();
    });
  });

  it('should clear input after sending message', async () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    
    fireEvent.changeText(input, 'Test message');
    fireEvent(input, 'submitEditing');
    
    await waitFor(() => {
      expect(input.props.value).toBe('');
    });
  });

  it('should not send empty messages', () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    fireEvent(input, 'submitEditing');
    
    expect(mockSocketService.sendStreamingMessage).not.toHaveBeenCalled();
  });

  it('should not send whitespace-only messages', () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    
    fireEvent.changeText(input, '   ');
    fireEvent(input, 'submitEditing');
    
    expect(mockSocketService.sendStreamingMessage).not.toHaveBeenCalled();
  });

  it('should disable input when disabled prop is true', () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} disabled={true} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    expect(input.props.editable).toBe(false);
  });

  it('should handle multiline input', () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    const multilineText = 'Line 1\nLine 2\nLine 3';
    
    fireEvent.changeText(input, multilineText);
    
    expect(input.props.value).toBe(multilineText);
  });

  it('should handle very long messages', () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    const longText = 'a'.repeat(1000);
    
    fireEvent.changeText(input, longText);
    
    expect(input.props.value).toBe(longText);
  });

  it('should handle character count display', () => {
    const { getByPlaceholderText, getByText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    const longText = 'a'.repeat(1900);
    
    fireEvent.changeText(input, longText);
    
    expect(getByText('1900/2000')).toBeTruthy();
  });

  it('should show warning for character count near limit', () => {
    const { getByPlaceholderText, getByText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    const longText = 'a'.repeat(2000);
    
    fireEvent.changeText(input, longText);
    
    expect(getByText('2000/2000')).toBeTruthy();
  });

  it('should handle typing indicators', () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    
    fireEvent.changeText(input, 'Hello');
    expect(mockSocketService.startTyping).toHaveBeenCalledWith('test-conv-id');
    
    fireEvent.changeText(input, '');
    expect(mockSocketService.stopTyping).toHaveBeenCalledWith('test-conv-id');
  });

  it('should handle message sending with socket service', async () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    
    fireEvent.changeText(input, 'Test message');
    fireEvent(input, 'submitEditing');
    
    await waitFor(() => {
      expect(mockSocketService.sendStreamingMessage).toHaveBeenCalledWith({
        message: 'Test message',
        conversationId: 'test-conv-id',
        stream: true,
      });
    });
  });

  it('should create user message on send', async () => {
    const { getByPlaceholderText } = render(<MessageInput {...defaultProps} />);
    
    const input = getByPlaceholderText('Message #ai-assistant');
    
    fireEvent.changeText(input, 'Test message');
    fireEvent(input, 'submitEditing');
    
    await waitFor(() => {
      expect(defaultProps.onMessageSent).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Test message',
          role: 'user',
          conversationId: 'test-conv-id',
          status: 'complete',
        })
      );
    });
  });
});
