# Code Samples

Practical examples and patterns for developing with the AI Chat system.

## Backend Examples

### Agent Service Integration

```typescript
// Basic agent service usage
import { AgentService } from '../agents/agentService';
import { MessageType } from '../types';

const agentService = new AgentService();

// Process a user message through the agent system
async function processUserMessage(message: string, conversationId: string) {
  try {
    const response = await agentService.processMessage({
      content: message,
      type: MessageType.USER,
      conversationId,
      timestamp: new Date(),
    });
    
    return {
      success: true,
      response: response.content,
      agentUsed: response.agentType,
      confidence: response.confidence,
    };
  } catch (error) {
    console.error('Agent processing failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Custom agent configuration
const customAgentConfig = {
  supportAgent: {
    enabled: true,
    confidence_threshold: 0.8,
    max_retries: 3,
  },
  entertainmentAgent: {
    enabled: true,
    confidence_threshold: 0.7,
    categories: ['jokes', 'games', 'trivia'],
  },
};

agentService.updateConfiguration(customAgentConfig);
```

### WebSocket Event Handlers

```typescript
// Real-time event handling
import { Server } from 'socket.io';
import { handleChatMessage, handleTyping } from '../socket/socketHandlers';

function setupSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // Chat message handling with validation
    socket.on('chat_message', async (data) => {
      try {
        const validatedMessage = await validateMessage(data);
        const response = await handleChatMessage(validatedMessage, socket);
        
        // Broadcast to all clients in the conversation
        socket.to(data.conversationId).emit('new_message', response);
        socket.emit('message_sent', { success: true, messageId: response.id });
      } catch (error) {
        socket.emit('error', { message: error.message, code: 'INVALID_MESSAGE' });
      }
    });
    
    // Typing indicators
    socket.on('typing_start', (data) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId: socket.id,
        timestamp: new Date(),
      });
    });
    
    socket.on('typing_stop', (data) => {
      socket.to(data.conversationId).emit('user_stopped_typing', {
        userId: socket.id,
      });
    });
    
    // Disconnect handling
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}
```

### Message Queue Operations

```typescript
// Using the message queue system
import { QueueService } from '../messageQueue/queueService';
import { MessagePriority, QueueMessage } from '../messageQueue/types';

const queueService = new QueueService();

// Add high-priority message
async function addUrgentMessage(content: string, userId: string) {
  const message: QueueMessage = {
    id: generateId(),
    content,
    userId,
    priority: MessagePriority.HIGH,
    timestamp: new Date(),
    retries: 0,
    maxRetries: 3,
  };
  
  await queueService.addMessage(message);
  return message.id;
}

// Process messages with error handling
async function processQueueMessages() {
  try {
    const messages = await queueService.getNextMessages(5);
    
    for (const message of messages) {
      try {
        await processMessage(message);
        await queueService.ackMessage(message.id);
      } catch (error) {
        console.error(`Message processing failed: ${message.id}`, error);
        await queueService.nackMessage(message.id, error.message);
      }
    }
  } catch (error) {
    console.error('Queue processing error:', error);
  }
}

// Monitor queue metrics
async function getQueueMetrics() {
  return {
    pending: await queueService.getPendingCount(),
    processing: await queueService.getProcessingCount(),
    failed: await queueService.getFailedCount(),
    throughput: await queueService.getThroughputMetrics(),
  };
}
```

### Validation Pipeline

```typescript
// Response validation patterns
import { ResponseValidator } from '../validation/responseValidator';

const validator = new ResponseValidator();

// Validate agent responses
async function validateAgentResponse(response: any, context: any) {
  try {
    const validation = await validator.validateResponse(response, context);
    
    if (validation.isValid) {
      console.log(`Response passed validation (score: ${validation.qualityScore})`);
      return {
        valid: true,
        response: validation.processedResponse,
        metrics: validation.metrics,
      };
    } else {
      console.warn(`Response failed validation: ${validation.issues.join(', ')}`);
      return {
        valid: false,
        issues: validation.issues,
        suggestions: validation.suggestions,
      };
    }
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, error: error.message };
  }
}

// Custom validation rules
const customValidationRules = {
  minLength: 10,
  maxLength: 2000,
  requiredFields: ['content', 'timestamp'],
  forbiddenPatterns: [/spam/i, /advertisement/i],
  sentimentThreshold: 0.3,
};

validator.updateRules(customValidationRules);
```

## Frontend Examples

### Socket Service Integration

```typescript
// Frontend socket service usage
import { SocketService } from '../services/socketService';

class ChatService {
  private socketService: SocketService;
  
  constructor() {
    this.socketService = new SocketService();
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    // Handle incoming messages
    this.socketService.on('new_message', (message) => {
      this.handleNewMessage(message);
    });
    
    // Handle connection status
    this.socketService.on('connect', () => {
      console.log('Connected to chat service');
      this.updateConnectionStatus('connected');
    });
    
    this.socketService.on('disconnect', () => {
      console.log('Disconnected from chat service');
      this.updateConnectionStatus('disconnected');
      this.attemptReconnection();
    });
  }
  
  // Send message with typing indicators
  async sendMessage(content: string, conversationId: string) {
    // Start typing indicator
    this.socketService.emit('typing_start', { conversationId });
    
    try {
      const message = {
        content,
        conversationId,
        timestamp: new Date().toISOString(),
      };
      
      await this.socketService.emit('chat_message', message);
      
      // Stop typing indicator
      this.socketService.emit('typing_stop', { conversationId });
      
      return { success: true };
    } catch (error) {
      this.socketService.emit('typing_stop', { conversationId });
      throw error;
    }
  }
  
  private attemptReconnection() {
    setTimeout(() => {
      if (!this.socketService.connected) {
        this.socketService.connect();
      }
    }, 5000);
  }
}
```

### React Native Components

```tsx
// Chat screen with real-time updates
import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { MessageInput } from './MessageInput';
import { AgentStatusBar } from './AgentStatusBar';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'agent';
  timestamp: string;
  agentType?: string;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [agentStatus, setAgentStatus] = useState('idle');
  const flatListRef = useRef<FlatList>(null);
  
  useEffect(() => {
    // Initialize socket connection
    const chatService = new ChatService();
    
    chatService.on('new_message', (message: Message) => {
      setMessages(prev => [...prev, message]);
      setIsTyping(false);
      scrollToBottom();
    });
    
    chatService.on('agent_status', (status: string) => {
      setAgentStatus(status);
    });
    
    chatService.on('typing', () => {
      setIsTyping(true);
    });
    
    return () => chatService.disconnect();
  }, []);
  
  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: generateId(),
      content,
      type: 'user',
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setAgentStatus('processing');
    scrollToBottom();
    
    try {
      await chatService.sendMessage(content, 'default-conversation');
    } catch (error) {
      console.error('Failed to send message:', error);
      setAgentStatus('error');
    }
  };
  
  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };
  
  const renderMessage = ({ item }: { item: Message }) => (
    <ThemedView style={[
      styles.messageContainer,
      item.type === 'user' ? styles.userMessage : styles.agentMessage
    ]}>
      <ThemedText style={styles.messageText}>{item.content}</ThemedText>
      {item.agentType && (
        <ThemedText style={styles.agentType}>via {item.agentType}</ThemedText>
      )}
    </ThemedView>
  );
  
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AgentStatusBar status={agentStatus} />
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messageList}
      />
      
      {isTyping && (
        <ThemedView style={styles.typingIndicator}>
          <ThemedText>Agent is typing...</ThemedText>
        </ThemedView>
      )}
      
      <MessageInput onSend={handleSendMessage} />
    </KeyboardAvoidingView>
  );
}
```

### State Management Patterns

```typescript
// Custom hooks for chat state management
import { useState, useEffect, useCallback } from 'react';
import { SocketService } from '../services/socketService';

interface ChatState {
  messages: Message[];
  isConnected: boolean;
  isTyping: boolean;
  error: string | null;
}

export function useChat(conversationId: string) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isConnected: false,
    isTyping: false,
    error: null,
  });
  
  const [socketService] = useState(() => new SocketService());
  
  useEffect(() => {
    // Initialize connection
    socketService.connect();
    
    // Setup event listeners
    const handleConnect = () => {
      setState(prev => ({ ...prev, isConnected: true, error: null }));
    };
    
    const handleDisconnect = () => {
      setState(prev => ({ ...prev, isConnected: false }));
    };
    
    const handleMessage = (message: Message) => {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, message],
        isTyping: false,
      }));
    };
    
    const handleError = (error: any) => {
      setState(prev => ({ ...prev, error: error.message }));
    };
    
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('new_message', handleMessage);
    socketService.on('error', handleError);
    
    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('new_message', handleMessage);
      socketService.off('error', handleError);
      socketService.disconnect();
    };
  }, [socketService]);
  
  const sendMessage = useCallback(async (content: string) => {
    try {
      await socketService.emit('chat_message', {
        content,
        conversationId,
        timestamp: new Date().toISOString(),
      });
      
      // Add user message to local state
      const userMessage: Message = {
        id: generateId(),
        content,
        type: 'user',
        timestamp: new Date().toISOString(),
      };
      
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));
    } catch (error) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  }, [socketService, conversationId]);
  
  return {
    ...state,
    sendMessage,
    clearError: () => setState(prev => ({ ...prev, error: null })),
  };
}
```

## Testing Examples

### Backend Unit Tests

```typescript
// Agent service testing
import { AgentService } from '../agents/agentService';
import { MessageType } from '../types';

describe('AgentService', () => {
  let agentService: AgentService;
  
  beforeEach(() => {
    agentService = new AgentService();
  });
  
  describe('processMessage', () => {
    it('should classify and process support messages', async () => {
      const message = {
        content: 'I need help with my account',
        type: MessageType.USER,
        conversationId: 'test-conv-1',
        timestamp: new Date(),
      };
      
      const response = await agentService.processMessage(message);
      
      expect(response.agentType).toBe('support');
      expect(response.confidence).toBeGreaterThan(0.8);
      expect(response.content).toContain('help');
    });
    
    it('should handle entertainment messages', async () => {
      const message = {
        content: 'Tell me a joke',
        type: MessageType.USER,
        conversationId: 'test-conv-2',
        timestamp: new Date(),
      };
      
      const response = await agentService.processMessage(message);
      
      expect(response.agentType).toBe('entertainment');
      expect(response.content).toBeTruthy();
    });
    
    it('should fallback to general agent for unclear messages', async () => {
      const message = {
        content: 'random unclear message',
        type: MessageType.USER,
        conversationId: 'test-conv-3',
        timestamp: new Date(),
      };
      
      const response = await agentService.processMessage(message);
      
      expect(response.agentType).toBe('general');
    });
  });
});
```

### Frontend Component Tests

```typescript
// Chat component testing
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ChatScreen from '../components/ChatScreen';
import { SocketService } from '../services/socketService';

// Mock the socket service
jest.mock('../services/socketService');

describe('ChatScreen', () => {
  const mockSocketService = SocketService as jest.MockedClass<typeof SocketService>;
  
  beforeEach(() => {
    mockSocketService.mockClear();
  });
  
  it('should render messages correctly', async () => {
    const { getByText } = render(<ChatScreen />);
    
    // Simulate receiving a message
    const mockInstance = mockSocketService.mock.instances[0];
    const messageHandler = mockInstance.on.mock.calls.find(
      call => call[0] === 'new_message'
    )[1];
    
    messageHandler({
      id: '1',
      content: 'Hello world',
      type: 'agent',
      timestamp: new Date().toISOString(),
    });
    
    await waitFor(() => {
      expect(getByText('Hello world')).toBeTruthy();
    });
  });
  
  it('should send messages when input is submitted', async () => {
    const { getByTestId } = render(<ChatScreen />);
    
    const input = getByTestId('message-input');
    const sendButton = getByTestId('send-button');
    
    fireEvent.changeText(input, 'Test message');
    fireEvent.press(sendButton);
    
    await waitFor(() => {
      expect(mockSocketService.prototype.emit).toHaveBeenCalledWith(
        'chat_message',
        expect.objectContaining({
          content: 'Test message',
        })
      );
    });
  });
});
```

### Integration Tests

```typescript
// Full flow integration testing
import request from 'supertest';
import { Server } from 'socket.io';
import { createServer } from 'http';
import app from '../index';

describe('Chat Integration', () => {
  let server: any;
  let io: Server;
  let clientSocket: any;
  
  beforeAll((done) => {
    const httpServer = createServer(app);
    io = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address()?.port;
      clientSocket = require('socket.io-client')(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
    server = httpServer;
  });
  
  afterAll(() => {
    server.close();
    clientSocket.close();
  });
  
  it('should process chat messages end-to-end', (done) => {
    clientSocket.emit('chat_message', {
      content: 'Hello, I need help',
      conversationId: 'test-integration',
    });
    
    clientSocket.on('new_message', (message) => {
      expect(message.content).toBeTruthy();
      expect(message.agentType).toBe('support');
      done();
    });
  });
  
  it('should validate message format', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({
        content: 'Test message',
        conversationId: 'test-validation',
      });
      
    expect(response.status).toBe(200);
    expect(response.body.validation).toBeDefined();
    expect(response.body.response).toBeTruthy();
  });
});
```

## Configuration Examples

### Environment Configuration

```bash
# Backend environment variables
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/chatdb

# OpenTelemetry tracing
OTEL_SERVICE_NAME=ai-chat-backend
OTEL_EXPORTER_JAEGER_ENDPOINT=http://localhost:14268/api/traces
OTEL_TRACES_SAMPLER=always_on

# Agent configuration
AGENT_SUPPORT_CONFIDENCE_THRESHOLD=0.8
AGENT_ENTERTAINMENT_ENABLED=true
AGENT_RAG_SEARCH_LIMIT=10

# Message queue
QUEUE_REDIS_URL=redis://localhost:6379
QUEUE_MAX_RETRIES=3
QUEUE_BATCH_SIZE=10
```

```bash
# Frontend environment variables
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_WS_URL=ws://localhost:3001
EXPO_PUBLIC_ENVIRONMENT=development

# Feature flags
EXPO_PUBLIC_ENABLE_VALIDATION_DASHBOARD=true
EXPO_PUBLIC_ENABLE_AGENT_STATUS=true
EXPO_PUBLIC_DEBUG_MODE=true
```

### Docker Development Setup

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@database:5432/chatdb
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      - database
      - redis
  
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "19006:19006"
    environment:
      - EXPO_PUBLIC_API_URL=http://localhost:3001
    volumes:
      - ./frontend:/app
      - /app/node_modules
  
  database:
    image: postgres:15
    environment:
      - POSTGRES_DB=chatdb
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Related Documentation

- **API Reference**: [Reference → API Reference](../reference/api-reference.md) - Complete API documentation
- **Architecture**: [Architecture → System Overview](../architecture/system-overview.md) - System architecture details
- **Setup Guide**: [Getting Started → Setup](../getting-started/setup.md) - Development environment setup
- **API Reference**: [Reference → API Reference](../reference/api-reference.md) - Complete API documentation

---

*Last updated: 2024*
*For more examples, check our [GitHub repository](https://github.com/your-org/ai-chat-system) or the [API reference](../reference/api-reference.md).*
