# Architecture Documentation

This document describes the system architecture and design patterns used in the AI Chat Application.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Database Design](#database-design)
6. [API Design](#api-design)
7. [Real-time Communication](#real-time-communication)
8. [Security Architecture](#security-architecture)
9. [Scalability Considerations](#scalability-considerations)
10. [Design Patterns](#design-patterns)

## System Overview

The AI Chat Application follows a modern full-stack architecture with clear separation of concerns:

- **Frontend**: React 19 SPA with TypeScript and Material-UI
- **Backend**: Node.js/Express API server with TypeScript
- **Real-time**: Socket.io for WebSocket communication
- **AI Integration**: OpenAI API for GPT model integration
- **Storage**: In-memory storage with optional database integration
- **Communication**: RESTful API + WebSocket for real-time features

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Chat UI    │  │  Sidebar    │  │  Message    │           │
│  │ Components  │  │ Components  │  │ Components  │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │ API Service │  │Socket Client│  │ Theme/Style │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Node.js)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Express    │  │  Socket.io  │  │  Middleware │           │
│  │   Routes    │  │   Server    │  │   Stack     │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Storage    │  │  OpenAI     │  │  Types &    │           │
│  │  Service    │  │  Service    │  │  Utilities  │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS API
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  OpenAI     │  │  Future     │  │  Future     │           │
│  │    API      │  │ Database    │  │   Auth      │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Architecture

```
src/
├── components/              # React components
│   ├── ChatInterface.tsx    # Main chat container
│   ├── ChatWindow.tsx       # Message display area
│   ├── MessageInput.tsx     # Message input component
│   └── Sidebar.tsx          # Conversation sidebar
├── services/               # API and external services
│   ├── api.ts              # HTTP API client
│   └── socket.ts           # WebSocket client
├── theme/                  # Material-UI theming
│   └── theme.ts            # Theme configuration
├── types.ts                # TypeScript type definitions
└── App.tsx                 # Main application component
```

### Backend Architecture

```
src/
├── routes/                 # Express route handlers
│   ├── chat.ts            # Chat API endpoints
│   └── conversations.ts    # Conversation management
├── socket/                # Socket.io handlers
│   └── socketHandlers.ts   # WebSocket event handlers
├── storage/               # Data storage layer
│   └── memoryStorage.ts    # In-memory storage implementation
├── types.ts               # Shared TypeScript types
└── index.ts               # Main server file
```

## Data Flow

### Message Sending Flow

1. **User Input**: User types message in `MessageInput` component
2. **Frontend Processing**: Message sent via Socket.io to backend
3. **Backend Processing**: 
   - Validate message
   - Store user message
   - Send to OpenAI API
   - Stream response back to client
4. **Real-time Updates**: All clients in conversation receive updates
5. **UI Updates**: Frontend renders new messages in real-time

### Conversation Management Flow

1. **Load Conversations**: Frontend fetches conversation list on startup
2. **Create Conversation**: New conversation created when user sends first message
3. **Join Conversation**: User joins conversation room via Socket.io
4. **Real-time Sync**: All participants receive real-time updates
5. **Persistence**: Conversations stored in memory (easily extensible to database)

## Database Design

Currently using in-memory storage with the following data models:

### Message Model
```typescript
interface Message {
  id: string;              // UUID
  content: string;         // Message content
  role: 'user' | 'assistant'; // Message sender
  timestamp: Date;         // Creation time
  conversationId: string;  // Parent conversation
}
```

### Conversation Model
```typescript
interface Conversation {
  id: string;              // UUID
  title: string;           // Generated from first message
  messages: Message[];     // Array of messages
  createdAt: Date;         // Creation time
  updatedAt: Date;         // Last modification time
}
```

### Storage Interface
```typescript
interface StorageService {
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | null>;
  createConversation(conversation: Conversation): Promise<Conversation>;
  updateConversation(id: string, conversation: Partial<Conversation>): Promise<Conversation>;
  deleteConversation(id: string): Promise<boolean>;
  addMessage(conversationId: string, message: Message): Promise<Message>;
}
```

## API Design

### RESTful Endpoints

- **GET /api/health** - Health check
- **GET /api/conversations** - List all conversations
- **GET /api/conversations/:id** - Get specific conversation
- **POST /api/chat** - Send message (non-streaming)
- **DELETE /api/conversations/:id** - Delete conversation

### WebSocket Events

- **join_conversation** - Join conversation room
- **leave_conversation** - Leave conversation room
- **stream_chat** - Send message with streaming response
- **stream_start** - Streaming response started
- **stream_chunk** - Streaming response chunk
- **stream_complete** - Streaming response completed

## Real-time Communication

### Socket.io Implementation

```typescript
// Server-side event handling
socket.on('stream_chat', async (data) => {
  const { message, conversationId } = data;
  
  // Join conversation room
  socket.join(conversationId);
  
  // Create OpenAI stream
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: conversationMessages,
    stream: true
  });
  
  // Stream response to all clients in room
  for await (const chunk of stream) {
    socket.to(conversationId).emit('stream_chunk', {
      messageId: responseMessage.id,
      content: accumulatedContent,
      isComplete: false
    });
  }
});
```

### Connection Management

- **Room-based**: Each conversation is a Socket.io room
- **Auto-join**: Clients automatically join conversation rooms
- **Cleanup**: Proper cleanup when clients disconnect
- **Error Handling**: Comprehensive error handling for connection issues

## Security Architecture

### Current Security Measures

1. **CORS Configuration**: Restricts frontend origins
2. **Input Validation**: Validates all user inputs
3. **Rate Limiting**: Ready for implementation
4. **Error Handling**: Secure error messages

### Future Security Enhancements

1. **Authentication**: JWT-based user authentication
2. **Authorization**: Role-based access control
3. **Input Sanitization**: XSS prevention
4. **API Rate Limiting**: Prevent abuse
5. **HTTPS Enforcement**: SSL/TLS in production

## Scalability Considerations

### Horizontal Scaling

- **Stateless Backend**: Easy to scale horizontally
- **Load Balancing**: Ready for load balancer integration
- **Database Migration**: Easy transition from memory to database
- **Microservices**: Components can be split into microservices

### Performance Optimization

- **Streaming Responses**: Immediate user feedback
- **Message Pagination**: For large conversations
- **Caching**: Redis for session and conversation caching
- **CDN**: Static asset delivery optimization

### Database Scaling

- **MongoDB**: Document-based for complex conversation data
- **PostgreSQL**: Relational database for structured data
- **Redis**: Caching and session management
- **Elasticsearch**: Full-text search capabilities

## Design Patterns

### Frontend Patterns

1. **Component Composition**: Modular React components
2. **Custom Hooks**: Reusable stateful logic
3. **Context API**: Global state management
4. **Error Boundaries**: Graceful error handling
5. **Lazy Loading**: Code splitting for performance

### Backend Patterns

1. **Repository Pattern**: Data access abstraction
2. **Service Layer**: Business logic separation
3. **Middleware Pattern**: Request/response processing
4. **Factory Pattern**: Object creation abstraction
5. **Observer Pattern**: Real-time event handling

### Code Examples

#### Repository Pattern Implementation
```typescript
// storage/StorageService.ts
export interface StorageService {
  getConversations(): Promise<Conversation[]>;
  createConversation(conversation: Conversation): Promise<Conversation>;
}

// storage/MemoryStorage.ts
export class MemoryStorage implements StorageService {
  private conversations: Map<string, Conversation> = new Map();
  
  async getConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values());
  }
}
```

#### Service Layer Pattern
```typescript
// services/ChatService.ts
export class ChatService {
  constructor(
    private storage: StorageService,
    private openaiService: OpenAIService
  ) {}
  
  async processMessage(message: string, conversationId?: string): Promise<ChatResponse> {
    // Business logic here
  }
}
```

This architecture provides a solid foundation for a scalable, maintainable, and feature-rich AI chat application while maintaining clean separation of concerns and modern development practices.
