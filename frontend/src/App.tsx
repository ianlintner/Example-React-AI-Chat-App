import { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box, AppBar, Toolbar, Typography, IconButton, Button } from '@mui/material';
import { Brightness4, Brightness7, Dashboard, Chat } from '@mui/icons-material';
import { lightTheme, darkTheme } from './theme/theme';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import ValidationDashboard from './components/ValidationDashboard';
import { socketService } from './services/socket';
import type { Conversation, Message } from './types';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<'chat' | 'dashboard'>('chat');

  // Initialize socket connection on app start
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Connect to socket server
        await socketService.connect();
        console.log('Socket connected successfully');
        setError(null);
        
        // Automatically send support request after connection
        setTimeout(() => {
          console.log('Sending automatic support request...');
          socketService.sendStreamingMessage({
            message: 'Hello, I need technical support. I\'m experiencing some issues and would like assistance from a support agent. Please let me know if I\'ll be on hold and if you can help keep me entertained while I wait.',
            conversationId: undefined,
            forceAgent: undefined
          });
        }, 1000); // Send after 1 second to ensure connection is established
        
      } catch (error) {
        console.error('Failed to connect to socket server:', error);
        setError('Failed to connect to server. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  // Handle socket events for new messages, proactive messages and streaming
  useEffect(() => {
    const handleNewMessage = (message: Message) => {
      console.log('📨 New message received in App:', message);
      
      // Add new message to current conversation or create new one
      setConversation(prev => {
        if (!prev) {
          // Create new conversation for new messages
          const newConversation: Conversation = {
            id: message.conversationId,
            title: 'AI Assistant Chat',
            messages: [{ ...message, status: 'complete' }],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          console.log('New conversation created for new message:', newConversation);
          return newConversation;
        }
        
        // Check if this conversation is different from current one
        if (prev.id !== message.conversationId) {
          console.log('Different conversation ID, not adding new message');
          return prev; // Don't add message from different conversation
        }
        
        // Check if message already exists to prevent duplicates
        const existingMessage = prev.messages.find(m => m.id === message.id);
        if (existingMessage) {
          console.log('Message already exists, not adding duplicate');
          return prev;
        }
        
        console.log('Adding new message to existing conversation');
        const updatedConversation = {
          ...prev,
          messages: [...prev.messages, { ...message, status: 'complete' as const }],
          updatedAt: new Date()
        };
        console.log('Updated conversation with new message:', updatedConversation);
        return updatedConversation;
      });
      
      // Update last update time to trigger re-renders
      setLastUpdateTime(new Date());
    };

    const handleStreamStart = (data: { messageId: string; conversationId: string }) => {
      console.log('🔄 Stream start received:', data);
      
      // Add streaming message placeholder
      setConversation(prev => {
        if (!prev) {
          // Create new conversation if none exists
          const newConversation: Conversation = {
            id: data.conversationId,
            title: 'AI Assistant Chat',
            messages: [{
              id: data.messageId,
              content: '',
              role: 'assistant',
              timestamp: new Date(),
              conversationId: data.conversationId,
              status: 'pending'
            }],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          return newConversation;
        }
        
        // Check if this conversation is different from current one
        if (prev.id !== data.conversationId) {
          return prev; // Don't add message from different conversation
        }
        
        // Check if message already exists
        const existingMessage = prev.messages.find(m => m.id === data.messageId);
        if (existingMessage) {
          // Update existing message to streaming
          return {
            ...prev,
            messages: prev.messages.map(m => 
              m.id === data.messageId 
                ? { ...m, status: 'streaming' as const }
                : m
            ),
            updatedAt: new Date()
          };
        }
        
        // Add new streaming message
        return {
          ...prev,
          messages: [...prev.messages, {
            id: data.messageId,
            content: '',
            role: 'assistant',
            timestamp: new Date(),
            conversationId: data.conversationId,
            status: 'pending'
          }],
          updatedAt: new Date()
        };
      });
    };

    const handleStreamChunk = (chunk: { messageId: string; content: string; isComplete: boolean }) => {
      console.log('📝 Stream chunk received:', chunk.content.slice(-20));
      
      // Update message content
      setConversation(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          messages: prev.messages.map(m => 
            m.id === chunk.messageId 
              ? { 
                  ...m, 
                  content: chunk.content,
                  status: chunk.isComplete ? 'complete' as const : 'streaming' as const
                }
              : m
          ),
          updatedAt: new Date()
        };
      });
    };

    const handleStreamComplete = (data: { 
      messageId: string; 
      conversationId: string; 
      conversation: Conversation;
      agentUsed?: string;
      confidence?: number;
    }) => {
      console.log('✅ Stream complete received:', data);
      
      // Update message with final agent info and complete status
      setConversation(prev => {
        if (!prev) return data.conversation;
        
        return {
          ...prev,
          messages: prev.messages.map(m => 
            m.id === data.messageId 
              ? { 
                  ...m, 
                  ...(data.agentUsed && { agentUsed: data.agentUsed }),
                  ...(data.confidence && { confidence: data.confidence }),
                  status: 'complete' as const
                }
              : m
          ),
          updatedAt: new Date()
        };
      });
    };

    const handleProactiveMessage = (data: { 
      message: Message; 
      actionType: string; 
      agentUsed: string; 
      confidence: number 
    }) => {
      console.log('🎁 Proactive message received in App:', JSON.stringify(data, null, 2));
      
      // Add proactive message to current conversation or create new one
      setConversation(prev => {
        if (!prev) {
          // Create new conversation for proactive messages
          const newConversation: Conversation = {
            id: data.message.conversationId,
            title: 'AI Assistant Chat',
            messages: [{ ...data.message, status: 'complete' }],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          return newConversation;
        }
        
        // Check if this conversation is different from current one
        if (prev.id !== data.message.conversationId) {
          return prev; // Don't add message from different conversation
        }
        
        // Check if message already exists to prevent duplicates
        const existingMessage = prev.messages.find(m => m.id === data.message.id);
        if (existingMessage) {
          return prev;
        }
        
        // Add proactive message
        return {
          ...prev,
          messages: [...prev.messages, { ...data.message, status: 'complete' as const }],
          updatedAt: new Date()
        };
      });
      
      // Update last update time to trigger re-renders
      setLastUpdateTime(new Date());
    };

    // Set up socket listeners
    socketService.onNewMessage(handleNewMessage);
    socketService.onStreamStart(handleStreamStart);
    socketService.onStreamChunk(handleStreamChunk);
    socketService.onStreamComplete(handleStreamComplete);
    socketService.onProactiveMessage(handleProactiveMessage);

    return () => {
      socketService.removeListener('new_message');
      socketService.removeListener('stream_start');
      socketService.removeListener('stream_chunk');
      socketService.removeListener('stream_complete');
      socketService.removeListener('proactive_message');
    };
  }, [conversation]);

  const handleMessageSent = (newConversation: Conversation) => {
    setConversation(newConversation);
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  if (error) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2
        }}>
          <Typography variant="h6" color="error">
            {error}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please check your connection and refresh the page.
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Typography variant="h6">
            Connecting to AI Assistant...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* App Bar */}
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              🎯 AI Assistant with Goal-Seeking System
            </Typography>
            <Button 
              color="inherit" 
              startIcon={<Chat />}
              onClick={() => setCurrentView('chat')}
              variant={currentView === 'chat' ? 'outlined' : 'text'}
              sx={{ mr: 1 }}
            >
              Chat
            </Button>
            <Button 
              color="inherit" 
              startIcon={<Dashboard />}
              onClick={() => setCurrentView('dashboard')}
              variant={currentView === 'dashboard' ? 'outlined' : 'text'}
              sx={{ mr: 1 }}
            >
              Dashboard
            </Button>
            <IconButton color="inherit" onClick={toggleTheme}>
              {isDarkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Main Content Area */}
        {currentView === 'chat' ? (
          <>
            {/* Chat Window */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
              <ChatWindow conversation={conversation} key={lastUpdateTime.getTime()} />
            </Box>

            {/* Message Input */}
            <Box sx={{ 
              borderTop: 1, 
              borderColor: 'divider',
              p: 2
            }}>
              <MessageInput
                conversationId={conversation?.id}
                onMessageSent={handleMessageSent}
              />
            </Box>
          </>
        ) : (
          /* Validation Dashboard */
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <ValidationDashboard />
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
