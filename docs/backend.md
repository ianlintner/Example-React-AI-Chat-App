# Backend Guide

This document provides comprehensive information about the backend architecture, APIs, and development practices for the AI Chat Application.

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Server Architecture](#server-architecture)
5. [API Design](#api-design)
6. [WebSocket Implementation](#websocket-implementation)
7. [Data Storage](#data-storage)
8. [OpenAI Integration](#openai-integration)
9. [Error Handling](#error-handling)
10. [Middleware](#middleware)
11. [Environment Configuration](#environment-configuration)
12. [Development Workflow](#development-workflow)

## Overview

The backend is built with Node.js, Express, and TypeScript, providing a robust API server with real-time WebSocket capabilities. It integrates with OpenAI's API for AI responses and includes comprehensive error handling, logging, and streaming support.

## Technology Stack

### Core Technologies
- **Node.js** - JavaScript runtime environment
- **Express 5** - Web application framework
- **TypeScript** - Type safety and better developer experience
- **Socket.io** - Real-time bidirectional event-based communication

### Supporting Libraries
- **OpenAI SDK** - OpenAI API integration
- **UUID** - Unique identifier generation
- **CORS** - Cross-origin resource sharing
- **Helmet** - Security middleware
- **Morgan** - HTTP request logger

### Development Tools
- **Nodemon** - Development server auto-reload
- **TSC** - TypeScript compiler
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Project Structure

```
backend/
├── src/
│   ├── routes/            # API route handlers
│   │   ├── chat.ts        # Chat API endpoints
│   │   └── conversations.ts # Conversation management
│   ├── socket/            # WebSocket handlers
│   │   └── socketHandlers.ts # Socket.io event handlers
│   ├── storage/           # Data storage layer
│   │   └── memoryStorage.ts # In-memory storage implementation
│   ├── types.ts           # TypeScript type definitions
│   └── index.ts           # Main server file
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .env                   # Environment variables
├── .env.example           # Environment template
└── .gitignore             # Git ignore rules
```

## Server Architecture

### Main Server Configuration

```typescript
// src/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket/socketHandlers';
import chatRoutes from './routes/chat';
import conversationRoutes from './routes/conversations';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:8081",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:8081"
}));
app.use(express.json());

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Socket.io setup
setupSocketHandlers(io);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
});
```

### Application Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Express Server                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  CORS       │  │  JSON       │  │  Security   │           │
│  │ Middleware  │  │ Middleware  │  │ Middleware  │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Chat       │  │Conversation │  │  Health     │           │
│  │  Routes     │  │   Routes    │  │  Routes     │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Socket.io Server                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Connection │  │  Room       │  │  Event      │           │
│  │  Handling   │  │ Management  │  │ Broadcasting│           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Storage    │  │  OpenAI     │  │  Validation │           │
│  │  Service    │  │  Service    │  │  Service    │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## API Design

### RESTful Endpoints

#### Health Check
```typescript
// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

#### Chat Routes
```typescript
// routes/chat.ts
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage/memoryStorage';
import { Message, Conversation, ChatRequest, ChatResponse } from '../types';

const router = express.Router();

// POST /api/chat - Send message (non-streaming)
router.post('/', async (req, res) => {
  try {
    const { message, conversationId }: ChatRequest = req.body;
    
    // Validate input
    if (!message || message.trim() === '') {
      return res.status(400).json({
        message: 'Message is required',
        code: 'INVALID_REQUEST'
      });
    }
    
    // Create or get conversation
    let conversation: Conversation;
    if (conversationId) {
      conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({
          message: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        });
      }
    } else {
      // Create new conversation
      conversation = {
        id: uuidv4(),
        title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await storage.createConversation(conversation);
    }
    
    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      content: message,
      role: 'user',
      timestamp: new Date(),
      conversationId: conversation.id
    };
    
    await storage.addMessage(conversation.id, userMessage);
    
    // Generate AI response (placeholder)
    const aiResponse: Message = {
      id: uuidv4(),
      content: 'This is a placeholder response. OpenAI integration needed.',
      role: 'assistant',
      timestamp: new Date(),
      conversationId: conversation.id
    };
    
    await storage.addMessage(conversation.id, aiResponse);
    
    // Get updated conversation
    const updatedConversation = await storage.getConversation(conversation.id);
    
    const response: ChatResponse = {
      message: aiResponse,
      conversation: updatedConversation!
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
```

#### Conversation Routes
```typescript
// routes/conversations.ts
import express from 'express';
import { storage } from '../storage/memoryStorage';

const router = express.Router();

// GET /api/conversations - Get all conversations
router.get('/', async (req, res) => {
  try {
    const conversations = await storage.getConversations();
    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// GET /api/conversations/:id - Get specific conversation
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await storage.getConversation(id);
    
    if (!conversation) {
      return res.status(404).json({
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteConversation(id);
    
    if (!success) {
      return res.status(404).json({
        message: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }
    
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
```

## WebSocket Implementation

### Socket.io Event Handlers

```typescript
// socket/socketHandlers.ts
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { storage } from '../storage/memoryStorage';
import { Message, Conversation, StreamChatRequest, StreamChunk } from '../types';

let openai: OpenAI | null = null;

// Initialize OpenAI if API key is available
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);
    
    // Handle conversation joining
    socket.on('join_conversation', (data: { conversationId: string }) => {
      const { conversationId } = data;
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });
    
    // Handle conversation leaving
    socket.on('leave_conversation', (data: { conversationId: string }) => {
      const { conversationId } = data;
      socket.leave(conversationId);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    });
    
    // Handle streaming chat
    socket.on('stream_chat', async (data: StreamChatRequest) => {
      try {
        const { message, conversationId } = data;
        
        console.log('🔄 Received stream_chat request:', { message, conversationId });
        
        // Validate input
        if (!message || message.trim() === '') {
          socket.emit('error', { message: 'Message is required' });
          return;
        }
        
        // Get or create conversation
        let conversation = await storage.getConversation(conversationId);
        if (!conversation) {
          conversation = {
            id: conversationId,
            title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await storage.createConversation(conversation);
        }
        
        // Join conversation room
        socket.join(conversationId);
        
        // Add user message
        const userMessage: Message = {
          id: uuidv4(),
          content: message,
          role: 'user',
          timestamp: new Date(),
          conversationId
        };
        
        await storage.addMessage(conversationId, userMessage);
        
        // Create AI response message
        const aiMessage: Message = {
          id: uuidv4(),
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          conversationId
        };
        
        await storage.addMessage(conversationId, aiMessage);
        
        // Emit stream start
        io.to(conversationId).emit('stream_start', {
          messageId: aiMessage.id,
          conversationId
        });
        
        // Handle OpenAI streaming or fallback
        if (openai) {
          console.log('🤖 Starting OpenAI streaming request...');
          
          try {
            const stream = await openai.chat.completions.create({
              model: 'gpt-4',
              messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: message }
              ],
              stream: true
            });
            
            console.log('✅ OpenAI stream created successfully');
            
            let accumulatedContent = '';
            let chunkCount = 0;
            
            for await (const chunk of stream) {
              const deltaContent = chunk.choices[0]?.delta?.content || '';
              if (deltaContent) {
                accumulatedContent += deltaContent;
                chunkCount++;
                
                console.log(`📡 Sending chunk ${chunkCount}: "${deltaContent}..."`);
                
                // Emit chunk to all clients in conversation
                io.to(conversationId).emit('stream_chunk', {
                  messageId: aiMessage.id,
                  content: accumulatedContent,
                  isComplete: false
                });
              }
            }
            
            // Update message in storage
            await storage.updateMessage(conversationId, aiMessage.id, {
              content: accumulatedContent
            });
            
            // Emit final chunk
            io.to(conversationId).emit('stream_chunk', {
              messageId: aiMessage.id,
              content: accumulatedContent,
              isComplete: true
            });
            
            console.log(`🏁 OpenAI streaming completed. Total chunks: ${chunkCount}, Full content length: ${accumulatedContent.length}`);
            
          } catch (openaiError) {
            console.error('OpenAI streaming error:', openaiError);
            // Fallback to simple response
            const fallbackContent = 'I apologize, but I encountered an error while processing your request. Please try again.';
            
            await storage.updateMessage(conversationId, aiMessage.id, {
              content: fallbackContent
            });
            
            io.to(conversationId).emit('stream_chunk', {
              messageId: aiMessage.id,
              content: fallbackContent,
              isComplete: true
            });
          }
        } else {
          // Demo mode without OpenAI
          const demoResponse = 'This is a demo response. To enable AI responses, add your OpenAI API key to the environment variables.';
          
          await storage.updateMessage(conversationId, aiMessage.id, {
            content: demoResponse
          });
          
          io.to(conversationId).emit('stream_chunk', {
            messageId: aiMessage.id,
            content: demoResponse,
            isComplete: true
          });
        }
        
        // Emit stream complete
        io.to(conversationId).emit('stream_complete', {
          messageId: aiMessage.id,
          conversationId
        });
        
      } catch (error) {
        console.error('Stream chat error:', error);
        socket.emit('error', { message: 'Internal server error' });
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};
```

## Data Storage

### In-Memory Storage Implementation

```typescript
// storage/memoryStorage.ts
import { Conversation, Message } from '../types';

export interface StorageService {
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | null>;
  createConversation(conversation: Conversation): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null>;
  deleteConversation(id: string): Promise<boolean>;
  addMessage(conversationId: string, message: Message): Promise<Message>;
  updateMessage(conversationId: string, messageId: string, updates: Partial<Message>): Promise<Message | null>;
}

class MemoryStorage implements StorageService {
  private conversations: Map<string, Conversation> = new Map();
  
  async getConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  
  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) || null;
  }
  
  async createConversation(conversation: Conversation): Promise<Conversation> {
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }
  
  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    const conversation = this.conversations.get(id);
    if (!conversation) return null;
    
    const updated = { ...conversation, ...updates, updatedAt: new Date() };
    this.conversations.set(id, updated);
    return updated;
  }
  
  async deleteConversation(id: string): Promise<boolean> {
    return this.conversations.delete(id);
  }
  
  async addMessage(conversationId: string, message: Message): Promise<Message> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    conversation.messages.push(message);
    conversation.updatedAt = new Date();
    
    return message;
  }
  
  async updateMessage(conversationId: string, messageId: string, updates: Partial<Message>): Promise<Message | null> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;
    
    const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return null;
    
    const updated = { ...conversation.messages[messageIndex], ...updates };
    conversation.messages[messageIndex] = updated;
    conversation.updatedAt = new Date();
    
    return updated;
  }
}

export const storage = new MemoryStorage();
```

## OpenAI Integration

### Streaming Response Implementation

```typescript
// Example OpenAI streaming integration
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const streamChatCompletion = async (
  messages: OpenAI.Chat.Completions.ChatCompletionMessage[],
  onChunk: (content: string) => void,
  onComplete: (fullContent: string) => void
) => {
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    let accumulatedContent = '';
    
    for await (const chunk of stream) {
      const deltaContent = chunk.choices[0]?.delta?.content || '';
      if (deltaContent) {
        accumulatedContent += deltaContent;
        onChunk(accumulatedContent);
      }
    }
    
    onComplete(accumulatedContent);
    
  } catch (error) {
    console.error('OpenAI streaming error:', error);
    throw error;
  }
};
```

## Error Handling

### Centralized Error Handling

```typescript
// middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
}

export const createError = (message: string, statusCode: number, code: string): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
};

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { statusCode = 500, message, code = 'INTERNAL_ERROR' } = error;
  
  console.error('Error:', {
    message,
    code,
    statusCode,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });
  
  res.status(statusCode).json({
    message: error.isOperational ? message : 'Internal server error',
    code,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

// Usage in routes
app.use(errorHandler);
```

## Middleware

### Common Middleware Stack

```typescript
// middleware/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

export const setupMiddleware = (app: express.Application) => {
  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8081',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  
  // Request logging
  app.use(morgan('combined'));
  
  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      message: 'Too many requests from this IP',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  });
  
  app.use('/api/', limiter);
};
```

## Environment Configuration

### Environment Variables

```bash
# .env
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:8081
OPENAI_API_KEY=your-openai-api-key-here

# Optional configurations
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Configuration Management

```typescript
// config/index.ts
import { config } from 'dotenv';

config();

export const serverConfig = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8081',
  openaiApiKey: process.env.OPENAI_API_KEY,
  logLevel: process.env.LOG_LEVEL || 'info',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  }
};

// Validate required environment variables
const requiredEnvVars = ['PORT', 'FRONTEND_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}
```

## Development Workflow

### Available Scripts

```json
{
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "type-check": "tsc --noEmit"
  }
}
```

### Development Tools Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

This backend guide provides a comprehensive overview of the Node.js server architecture, API design, and development practices. The modular structure makes it easy to extend and maintain the application as it grows.
