import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Chip,
  keyframes,
} from '@mui/material';
import {
  Person as PersonIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { socketService } from '../services/socket';
import type { Conversation, Message, StreamChunk } from '../types';

// Pulsing animation for streaming messages
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
`;

interface ChatWindowProps {
  conversation: Conversation | null;
  isNewChatMode: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  isNewChatMode,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamingMessages, setStreamingMessages] = useState<Map<string, string>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingConversationId, setStreamingConversationId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages, streamingMessages]);

  useEffect(() => {
    // Set up socket event listeners for streaming
    const handleStreamStart = (data: { messageId: string; conversationId: string }) => {
      console.log('Stream start:', data);
      setIsStreaming(true);
      setStreamingConversationId(data.conversationId);
      setStreamingMessages(prev => new Map(prev.set(data.messageId, '')));
    };

    const handleStreamChunk = (chunk: StreamChunk) => {
      console.log('Stream chunk:', chunk.content.slice(-20), 'isComplete:', chunk.isComplete);
      
      // Store the full content from the chunk - display immediately
      setStreamingMessages(prev => new Map(prev.set(chunk.messageId, chunk.content)));
      
      if (chunk.isComplete) {
        setIsStreaming(false);
        setStreamingConversationId(null);
      }
    };

    const handleStreamComplete = (data: { messageId: string; conversationId: string }) => {
      console.log('Stream complete:', data);
      setIsStreaming(false);
      setStreamingConversationId(null);
      
      // Clean up streaming state
      setTimeout(() => {
        setStreamingMessages(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.messageId);
          return newMap;
        });
      }, 1000); // Short delay to ensure final content is seen
    };

    socketService.onStreamStart(handleStreamStart);
    socketService.onStreamChunk(handleStreamChunk);
    socketService.onStreamComplete(handleStreamComplete);

    return () => {
      socketService.removeListener('stream_start');
      socketService.removeListener('stream_chunk');
      socketService.removeListener('stream_complete');
    };
  }, []);


  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const MessageBubble: React.FC<{ 
    message: Message; 
    isStreamingMessage?: boolean;
  }> = ({ message, isStreamingMessage = false }) => {
    const isUser = message.role === 'user';
    
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          mb: 2,
          px: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            maxWidth: '70%',
            flexDirection: isUser ? 'row-reverse' : 'row',
          }}
        >
          {/* Avatar */}
          <Avatar
            sx={{
              width: 32,
              height: 32,
              mx: 1,
              bgcolor: isUser ? 'primary.main' : 'secondary.main',
              ...(isStreamingMessage && !isUser && {
                animation: `${pulse} 2s infinite`,
                boxShadow: (theme) => `0 0 8px ${theme.palette.primary.main}40`,
              }),
            }}
          >
            {isUser ? <PersonIcon /> : <BotIcon />}
          </Avatar>

          {/* Message Content */}
          <Box>
            <Paper
              elevation={isStreamingMessage ? 3 : 1}
              sx={{
                p: 2,
                bgcolor: isUser ? 'primary.main' : 'background.paper',
                color: isUser ? 'primary.contrastText' : 'text.primary',
                borderRadius: 2,
                borderTopLeftRadius: isUser ? 2 : 0.5,
                borderTopRightRadius: isUser ? 0.5 : 2,
                ...(isStreamingMessage && !isUser && {
                  boxShadow: (theme) => `0 0 15px ${theme.palette.primary.main}30`,
                  border: (theme) => `1px solid ${theme.palette.primary.main}20`,
                  transition: 'all 0.3s ease',
                  animation: `${pulse} 3s infinite`,
                }),
              }}
            >
              {isUser ? (
                <Typography variant="body1">{message.content}</Typography>
              ) : isStreamingMessage ? (
                <Box sx={{ '& > *': { mb: 1 }, '& > *:last-child': { mb: 0 } }}>
                  <ReactMarkdown>{message.content || 'AI is thinking...'}</ReactMarkdown>
                </Box>
              ) : (
                <Box sx={{ '& > *': { mb: 1 }, '& > *:last-child': { mb: 0 } }}>
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </Box>
              )}
            </Paper>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mt: 0.5,
                textAlign: isUser ? 'right' : 'left',
              }}
            >
              {formatTimestamp(message.timestamp)}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  };

  if (isNewChatMode || !conversation) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          p: 4,
          textAlign: 'center',
        }}
      >
        <BotIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          Welcome to AI Chat Assistant
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Start a conversation by typing a message below. I'm here to help you with anything you need!
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip label="Ask questions" variant="outlined" />
          <Chip label="Get help with coding" variant="outlined" />
          <Chip label="Creative writing" variant="outlined" />
          <Chip label="Analysis & research" variant="outlined" />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Conversation Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">{conversation.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {conversation.messages.length} messages
        </Typography>
      </Box>

      {/* Messages */}
      <Box sx={{ flexGrow: 1, py: 2 }}>
        {conversation.messages.map((message) => {
          // Check if this message is being streamed
          const isStreamingThisMessage = streamingMessages.has(message.id);
          if (isStreamingThisMessage) {
            // Display content directly from streamingMessages
            const streamingContent = streamingMessages.get(message.id) || '';
            const streamingMessage = { ...message, content: streamingContent };
            return (
              <MessageBubble 
                key={message.id} 
                message={streamingMessage} 
                isStreamingMessage={true}
              />
            );
          }
          return <MessageBubble key={message.id} message={message} />;
        })}
        
        {/* Show streaming messages for new conversations or messages not yet in conversation */}
        {isStreaming && streamingConversationId && (
          Array.from(streamingMessages.entries())
            .filter(([messageId]) => !conversation.messages.some(msg => msg.id === messageId))
            .map(([messageId]) => {
              const streamingContent = streamingMessages.get(messageId) || '';
              const streamingMessage: Message = {
                id: messageId,
                content: streamingContent || 'AI is thinking...',
                role: 'assistant',
                timestamp: new Date(),
                conversationId: streamingConversationId
              };
              return (
                <MessageBubble 
                  key={messageId} 
                  message={streamingMessage} 
                  isStreamingMessage={true}
                />
              );
            })
        )}
        
        <div ref={messagesEndRef} />
      </Box>
    </Box>
  );
};

export default ChatWindow;
