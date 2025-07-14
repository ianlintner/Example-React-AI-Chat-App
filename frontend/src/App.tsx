import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { lightTheme, darkTheme } from './theme/theme';
import ChatInterface from './components/ChatInterface';
import { conversationsApi } from './services/api';
import { socketService } from './services/socket';
import type { Conversation } from './types';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize socket connection and load conversations on app start
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Connect to socket server
        await socketService.connect();
        console.log('Socket connected successfully');
      } catch (error) {
        console.error('Failed to connect to socket server:', error);
        // Continue without socket connection - fallback to regular API
      }
      
      // Load conversations
      await loadConversations();
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  // Handle active conversation changes for socket room management
  useEffect(() => {
    if (activeConversation && socketService.isSocketConnected()) {
      socketService.joinConversation(activeConversation.id);
      
      return () => {
        socketService.leaveConversation(activeConversation.id);
      };
    }
  }, [activeConversation]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await conversationsApi.getAll();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConversationUpdate = (updatedConversation: Conversation) => {
    setConversations(prev => {
      const index = prev.findIndex(c => c.id === updatedConversation.id);
      if (index >= 0) {
        const newConversations = [...prev];
        newConversations[index] = updatedConversation;
        return newConversations;
      } else {
        return [updatedConversation, ...prev];
      }
    });

    // If this is the active conversation, update it
    if (activeConversation?.id === updatedConversation.id) {
      setActiveConversation(updatedConversation);
    }
  };

  const handleConversationDelete = (conversationId: string) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    if (activeConversation?.id === conversationId) {
      setActiveConversation(null);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ChatInterface
          conversations={conversations}
          activeConversation={activeConversation}
          onConversationSelect={setActiveConversation}
          onConversationUpdate={handleConversationUpdate}
          onConversationDelete={handleConversationDelete}
          onThemeToggle={toggleTheme}
          isDarkMode={isDarkMode}
          isLoading={isLoading}
          error={error}
          onRetry={loadConversations}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
