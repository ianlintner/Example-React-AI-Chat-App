# API Documentation

This document describes the REST API endpoints and WebSocket events for the AI Chat Application.

## Base URL

- Development: `http://localhost:5001`
- Production: `https://your-domain.com`

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

## REST API Endpoints

### Health Check

#### GET /api/health

Check if the server is running and healthy.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-01-11T18:42:00.000Z"
}
```

### Chat Endpoints

#### POST /api/chat

Send a message to the AI and receive a response.

**Request Body:**
```json
{
  "message": "Hello, how are you?",
  "conversationId": "optional-conversation-id"
}
```

**Parameters:**
- `message` (string, required): The user's message to send to the AI
- `conversationId` (string, optional): ID of existing conversation. If not provided, a new conversation will be created.

**Response:**
```json
{
  "message": {
    "id": "message-uuid",
    "content": "AI response content",
    "role": "assistant",
    "timestamp": "2025-01-11T18:42:00.000Z",
    "conversationId": "conversation-uuid"
  },
  "conversation": {
    "id": "conversation-uuid",
    "title": "Hello, how are you?...",
    "messages": [
      {
        "id": "user-message-uuid",
        "content": "Hello, how are you?",
        "role": "user",
        "timestamp": "2025-01-11T18:41:58.000Z",
        "conversationId": "conversation-uuid"
      },
      {
        "id": "ai-message-uuid",
        "content": "AI response content",
        "role": "assistant",
        "timestamp": "2025-01-11T18:42:00.000Z",
        "conversationId": "conversation-uuid"
      }
    ],
    "createdAt": "2025-01-11T18:41:58.000Z",
    "updatedAt": "2025-01-11T18:42:00.000Z"
  }
}
```

**Error Responses:**

400 Bad Request:
```json
{
  "message": "Message is required",
  "code": "INVALID_REQUEST"
}
```

404 Not Found:
```json
{
  "message": "Conversation not found",
  "code": "CONVERSATION_NOT_FOUND"
}
```

500 Internal Server Error:
```json
{
  "message": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

### Conversation Endpoints

#### GET /api/conversations

Retrieve all conversations.

**Response:**
```json
[
  {
    "id": "conversation-uuid",
    "title": "Conversation title",
    "messages": [...],
    "createdAt": "2025-01-11T18:41:58.000Z",
    "updatedAt": "2025-01-11T18:42:00.000Z"
  }
]
```

#### GET /api/conversations/:id

Retrieve a specific conversation by ID.

**Parameters:**
- `id` (string): Conversation ID

**Response:**
```json
{
  "id": "conversation-uuid",
  "title": "Conversation title",
  "messages": [
    {
      "id": "message-uuid",
      "content": "Message content",
      "role": "user|assistant",
      "timestamp": "2025-01-11T18:41:58.000Z",
      "conversationId": "conversation-uuid"
    }
  ],
  "createdAt": "2025-01-11T18:41:58.000Z",
  "updatedAt": "2025-01-11T18:42:00.000Z"
}
```

#### DELETE /api/conversations/:id

Delete a specific conversation.

**Parameters:**
- `id` (string): Conversation ID

**Response:**
```json
{
  "message": "Conversation deleted successfully"
}
```

## WebSocket Events

The application uses Socket.IO for real-time communication.

### Connection

Connect to the WebSocket server:
```javascript
import io from 'socket.io-client';
const socket = io('http://localhost:5001');
```

### Events

#### Client to Server Events

**join_conversation**
Join a specific conversation room for real-time updates.
```javascript
socket.emit('join_conversation', { conversationId: 'conversation-uuid' });
```

**leave_conversation**
Leave a conversation room.
```javascript
socket.emit('leave_conversation', { conversationId: 'conversation-uuid' });
```

#### Server to Client Events

**message_received**
Emitted when a new message is added to a conversation.
```javascript
socket.on('message_received', (data) => {
  console.log('New message:', data.message);
  console.log('Updated conversation:', data.conversation);
});
```

**conversation_updated**
Emitted when a conversation is updated.
```javascript
socket.on('conversation_updated', (conversation) => {
  console.log('Conversation updated:', conversation);
});
```

**error**
Emitted when an error occurs.
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

## Data Models

### Message
```typescript
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
}
```

### Conversation
```typescript
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}
```

### ChatRequest
```typescript
interface ChatRequest {
  message: string;
  conversationId?: string;
}
```

### ChatResponse
```typescript
interface ChatResponse {
  message: Message;
  conversation: Conversation;
}
```

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "message": "Human readable error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `INVALID_REQUEST`: Invalid request parameters
- `CONVERSATION_NOT_FOUND`: Requested conversation doesn't exist
- `INTERNAL_ERROR`: Server-side error

## Rate Limiting

Currently, no rate limiting is implemented. In production, consider implementing rate limiting to prevent abuse.

## CORS Configuration

The server is configured to accept requests from:
- `http://localhost:5173` (default Vite dev server)
- `http://localhost:5174` (alternative dev server)
- Custom frontend URL via `FRONTEND_URL` environment variable

## Environment Variables

Required environment variables:
- `OPENAI_API_KEY`: OpenAI API key for AI responses (optional for demo mode)
- `PORT`: Server port (default: 5001)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:5173)
