import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Alert,
  AppState,
  Platform,
} from 'react-native';
import { 
  Provider as PaperProvider, 
  Appbar, 
  ActivityIndicator,
  Text,
} from 'react-native-paper';
import { socketService } from './services/socketService';
import ChatScreen from './components/ChatScreen';
import MessageInput from './components/MessageInput';
import type { Conversation, Message } from './types';

export default function App() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [isConnected, setIsConnected] = useState(false);

  // Initialize socket connection on app start
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Connect to socket server
        await socketService.connect();
        console.log('Socket connected successfully');
        setError(null);
        setIsConnected(true);
        
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
        setError('Failed to connect to server. Please check your connection.');
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();

    // Handle app state changes
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && !socketService.isSocketConnected()) {
        // Reconnect when app becomes active
        initializeApp();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup on unmount
    return () => {
      subscription?.remove();
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
    setConversation(prevConversation => {
      if (!prevConversation) {
        return newConversation;
      }
      
      // Merge with existing conversation
      const existingMessages = prevConversation.messages;
      const newMessage = newConversation.messages[0];
      
      // Check if message already exists
      const messageExists = existingMessages.some(m => m.id === newMessage.id);
      if (messageExists) {
        return prevConversation;
      }
      
      return {
        ...prevConversation,
        messages: [...existingMessages, newMessage],
        updatedAt: new Date()
      };
    });
  };

  if (error) {
    return (
      <PaperProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContainer}>
          <Text variant="headlineSmall" style={styles.errorTitle}>
            Connection Error
          </Text>
          <Text variant="bodyMedium" style={styles.errorMessage}>
            {error}
          </Text>
          <Text variant="bodySmall" style={styles.errorSubtext}>
            Please check your connection and restart the app.
          </Text>
        </View>
      </PaperProvider>
    );
  }

  if (isLoading) {
    return (
      <PaperProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="headlineSmall" style={styles.loadingText}>
            Connecting to AI Assistant...
          </Text>
        </View>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1976d2" />
      <View style={styles.container}>
        {/* App Bar */}
        <Appbar.Header>
          <Appbar.Content title="🎯 AI Assistant" />
          <View style={styles.connectionIndicator}>
            <Text style={[
              styles.connectionText,
              { color: isConnected ? '#4CAF50' : '#f44336' }
            ]}>
              {isConnected ? '●' : '●'}
            </Text>
          </View>
        </Appbar.Header>

        {/* Chat Area */}
        <View style={styles.chatContainer}>
          <ChatScreen conversation={conversation} />
        </View>

        {/* Message Input */}
        <MessageInput
          conversationId={conversation?.id}
          onMessageSent={handleMessageSent}
          disabled={!isConnected}
        />
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    color: '#f44336',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#666',
    textAlign: 'center',
  },
  connectionIndicator: {
    marginRight: 8,
  },
  connectionText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
