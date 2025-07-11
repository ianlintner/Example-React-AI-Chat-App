import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  IconButton,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import type { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onConversationSelect: (conversation: Conversation) => void;
  onConversationDelete: (conversationId: string) => void;
  onNewChat: () => void;
  isLoading: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversation,
  onConversationSelect,
  onConversationDelete,
  onNewChat,
  isLoading,
}) => {
  const formatDate = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffTime = Math.abs(now.getTime() - messageDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return messageDate.toLocaleDateString();
    }
  };

  const getPreviewText = (conversation: Conversation) => {
    if (conversation.messages.length === 0) {
      return 'No messages yet';
    }
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    return lastMessage.content.length > 50 
      ? lastMessage.content.substring(0, 50) + '...'
      : lastMessage.content;
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onNewChat}
          fullWidth
          sx={{ mb: 2 }}
        >
          New Chat
        </Button>
        <Typography variant="h6" component="h2">
          Conversations
        </Typography>
      </Box>

      {/* Conversations List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : conversations.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <ChatIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              No conversations yet. Start a new chat!
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {conversations.map((conversation) => (
              <ListItem
                key={conversation.id}
                sx={{
                  display: 'block',
                  p: 0,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <ListItemButton
                  selected={activeConversation?.id === conversation.id}
                  onClick={() => onConversationSelect(conversation)}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    py: 2,
                    px: 2,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                      '& .MuiListItemText-secondary': {
                        color: 'primary.contrastText',
                        opacity: 0.7,
                      },
                    },
                  }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mb: 0.5,
                      }}
                    >
                      {conversation.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mb: 0.5,
                      }}
                    >
                      {getPreviewText(conversation)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(conversation.updatedAt)}
                    </Typography>
                  </Box>
                  <Box sx={{ ml: 1 }}>
                    <Tooltip title="Delete conversation">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onConversationDelete(conversation.id);
                        }}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            color: 'error.main',
                          },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default Sidebar;
