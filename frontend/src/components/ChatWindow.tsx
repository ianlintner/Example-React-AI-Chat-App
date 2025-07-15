import React, { useEffect, useRef } from 'react';
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
import type { Conversation, Message } from '../types';

// Pulsing animation for streaming messages
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
`;

interface ChatWindowProps {
  conversation: Conversation | null;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);


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
              {/* Agent indicator for assistant messages */}
              {!isUser && message.agentUsed && (
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    label={
                      message.agentUsed === 'technical' ? '⚙️ Technical Agent' :
                      message.agentUsed === 'dad_joke' ? '😄 Dad Joke Master' :
                      message.agentUsed === 'trivia' ? '🧠 Trivia Master' :
                      message.agentUsed === 'gif' ? '🎭 GIF Master' :
                      '💬 General Agent'
                    }
                    color={
                      message.agentUsed === 'technical' ? 'info' :
                      message.agentUsed === 'dad_joke' ? 'warning' :
                      message.agentUsed === 'trivia' ? 'secondary' :
                      message.agentUsed === 'gif' ? 'primary' :
                      'success'
                    }
                    variant="outlined"
                    sx={{
                      fontSize: '0.7rem',
                      height: 20,
                      '& .MuiChip-label': { px: 1 }
                    }}
                  />
                  {message.isProactive && (
                    <Chip
                      size="small"
                      label="🎯 Proactive"
                      color="primary"
                      variant="filled"
                      sx={{
                        fontSize: '0.6rem',
                        height: 18,
                        '& .MuiChip-label': { px: 1 }
                      }}
                    />
                  )}
                  {message.confidence && (
                    <Typography 
                      variant="caption" 
                      color="text.secondary"
                      sx={{ fontSize: '0.7rem' }}
                    >
                      {Math.round(message.confidence * 100)}% confidence
                    </Typography>
                  )}
                </Box>
              )}
              
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

  if (!conversation) {
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
        {/* Render all messages with their appropriate status-based styling */}
        {conversation.messages.map((message) => {
          const isStreaming = message.status === 'streaming';
          const isPending = message.status === 'pending';
          
          return (
            <MessageBubble 
              key={message.id} 
              message={message} 
              isStreamingMessage={isStreaming || isPending}
            />
          );
        })}
        
        <div ref={messagesEndRef} />
      </Box>
    </Box>
  );
};

export default ChatWindow;
