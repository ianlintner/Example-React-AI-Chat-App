# Frontend Guide

This document provides comprehensive information about the frontend architecture, components, and development practices for the AI Chat Application.

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Component Architecture](#component-architecture)
5. [State Management](#state-management)
6. [Styling and Theming](#styling-and-theming)
7. [Real-time Communication](#real-time-communication)
8. [API Integration](#api-integration)
9. [TypeScript Usage](#typescript-usage)
10. [Development Workflow](#development-workflow)
11. [Performance Optimization](#performance-optimization)
12. [Testing](#testing)

## Overview

The frontend is built with React 19 and TypeScript, providing a modern, responsive, and type-safe user interface for the AI chat application. It features real-time messaging, conversation management, and a polished Material-UI design.

## Technology Stack

### Core Technologies
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and development server
- **Material-UI v7** - Modern component library
- **Socket.io Client** - Real-time WebSocket communication

### Supporting Libraries
- **React Router** - Client-side routing (ready for multi-page features)
- **React Markdown** - Markdown rendering for AI responses
- **Axios** - HTTP client for API calls
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Project Structure

```
frontend/
├── public/                 # Static assets
│   ├── index.html         # Main HTML template
│   └── vite.svg           # Vite logo
├── src/
│   ├── components/        # React components
│   │   ├── ChatInterface.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── MessageInput.tsx
│   │   └── Sidebar.tsx
│   ├── services/          # API and external services
│   │   ├── api.ts         # HTTP API client
│   │   └── socket.ts      # WebSocket client
│   ├── theme/             # Material-UI theming
│   │   └── theme.ts       # Theme configuration
│   ├── assets/            # Static assets
│   │   └── react.svg      # React logo
│   ├── types.ts           # TypeScript type definitions
│   ├── App.tsx            # Main application component
│   ├── App.css            # Global styles
│   ├── index.css          # CSS reset and globals
│   ├── main.tsx           # Application entry point
│   └── vite-env.d.ts      # Vite type definitions
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── tsconfig.app.json      # App-specific TypeScript config
├── tsconfig.node.json     # Node-specific TypeScript config
├── vite.config.ts         # Vite configuration
└── eslint.config.js       # ESLint configuration
```

## Component Architecture

### Component Hierarchy

```
App
├── ChatInterface (Main container)
    ├── Sidebar (Conversation list)
    │   ├── ConversationItem (Individual conversation)
    │   └── NewChatButton
    ├── ChatWindow (Message display)
    │   ├── MessageBubble (Individual message)
    │   └── StreamingIndicator
    └── MessageInput (Input form)
        ├── TextField
        └── SendButton
```

### Core Components

#### 1. App.tsx
Main application component that provides the overall layout and theme.

```typescript
import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme/theme';
import ChatInterface from './components/ChatInterface';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ChatInterface />
    </ThemeProvider>
  );
}

export default App;
```

#### 2. ChatInterface.tsx
Main container component that orchestrates the chat functionality.

**Key Features:**
- Manages conversation state
- Handles Socket.io connection
- Coordinates between sidebar and chat window
- Implements responsive layout

**State Management:**
```typescript
const [conversations, setConversations] = useState<Conversation[]>([]);
const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
const [isNewChatMode, setIsNewChatMode] = useState(true);
```

#### 3. ChatWindow.tsx
Displays messages and handles streaming responses.

**Key Features:**
- Real-time message display
- Streaming response handling
- Message rendering with markdown support
- Auto-scrolling to latest messages
- Pulsing animation for streaming messages

**Streaming Implementation:**
```typescript
useEffect(() => {
  const handleStreamChunk = (chunk: StreamChunk) => {
    setStreamingMessages(prev => new Map(prev.set(chunk.messageId, chunk.content)));
  };
  
  socketService.onStreamChunk(handleStreamChunk);
  
  return () => {
    socketService.removeListener('stream_chunk');
  };
}, []);
```

#### 4. MessageInput.tsx
Input component for sending messages.

**Key Features:**
- Multi-line text input
- Send button with loading state
- Keyboard shortcuts (Enter to send)
- Input validation
- Auto-focus and resize

#### 5. Sidebar.tsx
Conversation management sidebar.

**Key Features:**
- Conversation list display
- New chat button
- Conversation selection
- Delete conversation functionality
- Responsive collapsible design

## State Management

### Local State Strategy

The application uses React's built-in state management with hooks:

- **useState** - Component-level state
- **useEffect** - Side effects and lifecycle
- **useRef** - DOM references and mutable values
- **useCallback** - Memoized callbacks for performance

### State Structure

```typescript
// Main application state
interface AppState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  isNewChatMode: boolean;
  streamingMessages: Map<string, string>;
  isStreaming: boolean;
  streamingConversationId: string | null;
}
```

### Future State Management

For larger applications, consider:
- **Context API** - Global state management
- **Zustand** - Lightweight state management
- **Redux Toolkit** - Complex state scenarios
- **React Query** - Server state management

## Styling and Theming

### Material-UI Theme Configuration

```typescript
// theme/theme.ts
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});
```

### Custom Styling Approach

1. **Material-UI First** - Use MUI components and sx prop
2. **CSS Modules** - For component-specific styles
3. **Global Styles** - Minimal global CSS in index.css
4. **Theme Customization** - Extend MUI theme for consistency

### Responsive Design

```typescript
// Responsive breakpoints
const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
});

// Usage in components
<Box sx={{
  width: { xs: '100%', md: '70%' },
  height: { xs: '100vh', md: '80vh' },
}}>
```

## Real-time Communication

### Socket.io Integration

```typescript
// services/socket.ts
import io from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  
  connect() {
    this.socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001');
    
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
  }
  
  sendMessage(message: string, conversationId: string) {
    this.socket?.emit('stream_chat', { message, conversationId });
  }
  
  onStreamChunk(callback: (chunk: StreamChunk) => void) {
    this.socket?.on('stream_chunk', callback);
  }
  
  removeListener(event: string) {
    this.socket?.off(event);
  }
}

export const socketService = new SocketService();
```

### Event Handling

```typescript
// Component event handling
useEffect(() => {
  const handleStreamStart = (data: { messageId: string; conversationId: string }) => {
    setIsStreaming(true);
    setStreamingConversationId(data.conversationId);
  };
  
  const handleStreamChunk = (chunk: StreamChunk) => {
    setStreamingMessages(prev => new Map(prev.set(chunk.messageId, chunk.content)));
  };
  
  const handleStreamComplete = (data: { messageId: string; conversationId: string }) => {
    setIsStreaming(false);
    setStreamingConversationId(null);
  };
  
  socketService.onStreamStart(handleStreamStart);
  socketService.onStreamChunk(handleStreamChunk);
  socketService.onStreamComplete(handleStreamComplete);
  
  return () => {
    socketService.removeListener('stream_start');
    socketService.removeListener('stream_chunk');
    socketService.removeListener('stream_complete');
  };
}, []);
```

## API Integration

### HTTP Client Setup

```typescript
// services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('authToken');
    }
    return Promise.reject(error);
  }
);

export default api;
```

### API Service Functions

```typescript
// API service functions
export const apiService = {
  async getConversations(): Promise<Conversation[]> {
    const response = await api.get('/api/conversations');
    return response.data;
  },
  
  async getConversation(id: string): Promise<Conversation> {
    const response = await api.get(`/api/conversations/${id}`);
    return response.data;
  },
  
  async deleteConversation(id: string): Promise<void> {
    await api.delete(`/api/conversations/${id}`);
  },
  
  async sendMessage(message: string, conversationId?: string): Promise<ChatResponse> {
    const response = await api.post('/api/chat', { message, conversationId });
    return response.data;
  },
};
```

## TypeScript Usage

### Type Definitions

```typescript
// types.ts
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamChunk {
  messageId: string;
  content: string;
  isComplete: boolean;
}

export interface ChatResponse {
  message: Message;
  conversation: Conversation;
}
```

### Component Props

```typescript
// Component prop interfaces
interface ChatWindowProps {
  conversation: Conversation | null;
  isNewChatMode: boolean;
}

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
}
```

## Development Workflow

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check
```

### Environment Variables

```bash
# .env (development)
VITE_API_URL=http://localhost:5001

# .env.production
VITE_API_URL=https://your-production-api.com
```

### Development Tools

1. **Vite Dev Server** - Hot module replacement
2. **TypeScript Compiler** - Type checking
3. **ESLint** - Code quality
4. **Prettier** - Code formatting
5. **React DevTools** - Component debugging

## Performance Optimization

### Code Splitting

```typescript
// Lazy loading components
const ChatInterface = React.lazy(() => import('./components/ChatInterface'));
const Sidebar = React.lazy(() => import('./components/Sidebar'));

// Usage with Suspense
<Suspense fallback={<div>Loading...</div>}>
  <ChatInterface />
</Suspense>
```

### Memoization

```typescript
// Memoized components
const MessageBubble = React.memo(({ message, isStreamingMessage }) => {
  // Component implementation
});

// Memoized callbacks
const handleSendMessage = useCallback((message: string) => {
  socketService.sendMessage(message, activeConversation?.id || '');
}, [activeConversation?.id]);
```

### Virtual Scrolling

For large message lists, consider implementing virtual scrolling:

```typescript
// Future implementation with react-window
import { FixedSizeList as List } from 'react-window';

const VirtualizedMessageList = ({ messages, height }) => (
  <List
    height={height}
    itemCount={messages.length}
    itemSize={100}
    itemData={messages}
  >
    {MessageRow}
  </List>
);
```

## Testing

### Testing Strategy

1. **Unit Tests** - Component behavior
2. **Integration Tests** - Component interactions
3. **E2E Tests** - User workflows
4. **Visual Tests** - UI consistency

### Testing Tools

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "vitest": "^1.0.0",
    "jsdom": "^23.0.0"
  }
}
```

### Example Tests

```typescript
// ChatWindow.test.tsx
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import ChatWindow from './ChatWindow';
import { theme } from '../theme/theme';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ChatWindow', () => {
  it('renders welcome message in new chat mode', () => {
    renderWithTheme(<ChatWindow conversation={null} isNewChatMode={true} />);
    
    expect(screen.getByText('Welcome to AI Chat Assistant')).toBeInTheDocument();
  });
  
  it('renders conversation messages', () => {
    const conversation = {
      id: '1',
      title: 'Test Conversation',
      messages: [
        {
          id: '1',
          content: 'Hello',
          role: 'user' as const,
          timestamp: new Date(),
          conversationId: '1'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    renderWithTheme(<ChatWindow conversation={conversation} isNewChatMode={false} />);
    
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

This frontend guide provides a comprehensive overview of the React application structure, components, and development practices. The modular architecture makes it easy to extend and maintain the application as it grows.
