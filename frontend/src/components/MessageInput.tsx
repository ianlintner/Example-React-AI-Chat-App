import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Send as SendIcon,
} from '@mui/icons-material';
import { chatApi } from '../services/api';
import { socketService } from '../services/socket';
import type { Conversation } from '../types';

interface MessageInputProps {
  conversationId?: string;
  onMessageSent: (conversation: Conversation) => void;
  onStreamingMessage?: (messageId: string) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  onMessageSent,
  onStreamingMessage,
}) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useStreaming, setUseStreaming] = useState(true);

  useEffect(() => {
    // Set up socket event listeners for streaming
    const handleStreamStart = (data: { messageId: string; conversationId: string }) => {
      if (onStreamingMessage) {
        onStreamingMessage(data.messageId);
      }
    };

    const handleStreamError = (error: { message: string; code: string }) => {
      console.error('Stream error:', error);
      setError(error.message);
      setIsLoading(false);
    };

    const handleStreamComplete = (data: { messageId: string; conversationId: string; conversation: Conversation }) => {
      setIsLoading(false);
      onMessageSent(data.conversation);
    };

    socketService.onStreamStart(handleStreamStart);
    socketService.onStreamError(handleStreamError);
    socketService.onStreamComplete(handleStreamComplete);

    return () => {
      socketService.removeListener('stream_start');
      socketService.removeListener('stream_error');
      socketService.removeListener('stream_complete');
    };
  }, [onMessageSent, onStreamingMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      if (useStreaming && socketService.isSocketConnected()) {
        // Use streaming via socket
        socketService.sendStreamingMessage({
          message: message.trim(),
          conversationId,
          stream: true,
        });
        
        // Clear the input immediately for streaming
        setMessage('');
      } else {
        // Fallback to regular API
        const response = await chatApi.sendMessage({
          message: message.trim(),
          conversationId,
        });

        // Update the conversation with the new message
        onMessageSent(response.conversation);
        
        // Clear the input
        setMessage('');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end',
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          variant="outlined"
          size="medium"
          sx={{
            '& .MuiOutlinedInput-root': {
              paddingRight: 0,
            },
          }}
        />
        
        <IconButton
          type="submit"
          disabled={!message.trim() || isLoading}
          color="primary"
          size="large"
          sx={{
            mb: 0.5,
            minWidth: 48,
            minHeight: 48,
          }}
        >
          {isLoading ? (
            <CircularProgress size={24} />
          ) : (
            <SendIcon />
          )}
        </IconButton>
      </Box>
      
      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Switch
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
              size="small"
            />
          }
          label="Streaming"
          sx={{ fontSize: '0.75rem' }}
        />
        <Box
          component="span"
          sx={{
            fontSize: '0.75rem',
            color: 'text.secondary',
            fontStyle: 'italic',
          }}
        >
          Press Enter to send • Shift+Enter for new line
        </Box>
      </Box>
    </Box>
  );
};

export default MessageInput;
