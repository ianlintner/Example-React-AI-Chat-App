import React, { useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Person as PersonIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import type { Conversation, Message } from '../types';

interface ChatWindowProps {
  conversation: Conversation | null;
  isNewChatMode: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  isNewChatMode,
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

  const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
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
            }}
          >
            {isUser ? <PersonIcon /> : <BotIcon />}
          </Avatar>

          {/* Message Content */}
          <Box>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                bgcolor: isUser ? 'primary.main' : 'background.paper',
                color: isUser ? 'primary.contrastText' : 'text.primary',
                borderRadius: 2,
                borderTopLeftRadius: isUser ? 2 : 0.5,
                borderTopRightRadius: isUser ? 0.5 : 2,
              }}
            >
              {isUser ? (
                <Typography variant="body1">{message.content}</Typography>
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
        {conversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </Box>
    </Box>
  );
};

export default ChatWindow;
