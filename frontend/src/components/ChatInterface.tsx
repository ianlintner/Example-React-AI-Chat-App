import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  Button,
  CircularProgress,
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4,
  Brightness7,
  Add as AddIcon,
} from '@mui/icons-material';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import MessageInput from './MessageInput';
import type { Conversation } from '../types';

interface ChatInterfaceProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onConversationSelect: (conversation: Conversation) => void;
  onConversationUpdate: (conversation: Conversation) => void;
  onConversationDelete: (conversationId: string) => void;
  onThemeToggle: () => void;
  isDarkMode: boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

const DRAWER_WIDTH = 300;

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  conversations,
  activeConversation,
  onConversationSelect,
  onConversationUpdate,
  onConversationDelete,
  onThemeToggle,
  isDarkMode,
  isLoading,
  error,
  onRetry,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNewChat = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    onConversationSelect(conversation);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleMessageSent = (conversation: Conversation) => {
    onConversationUpdate(conversation);
  };

  const drawer = (
    <Sidebar
      conversations={conversations}
      activeConversation={activeConversation}
      onConversationSelect={handleConversationSelect}
      onConversationDelete={onConversationDelete}
      onNewChat={handleNewChat}
      isLoading={isLoading}
    />
  );

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={onRetry} fullWidth>
          Retry
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {activeConversation ? activeConversation.title : 'AI Chat Assistant'}
          </Typography>
          <IconButton color="inherit" onClick={handleNewChat}>
            <AddIcon />
          </IconButton>
          <IconButton color="inherit" onClick={onThemeToggle}>
            {isDarkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toolbar />
        
        {isLoading && !activeConversation ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Chat Window */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <ChatWindow 
            conversation={activeConversation} 
          />
            </Box>

            {/* Message Input */}
            <Paper
              elevation={3}
              sx={{
                p: 2,
                borderRadius: 0,
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              <MessageInput
                conversationId={activeConversation?.id}
                onMessageSent={handleMessageSent}
              />
            </Paper>
          </>
        )}
      </Box>
    </Box>
  );
};

export default ChatInterface;
