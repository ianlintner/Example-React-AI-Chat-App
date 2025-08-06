# Frontend Guide - Mobile Application

This document provides comprehensive information about the mobile application architecture, components, and development practices for the AI Chat Application built with React Native and Expo.

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Component Architecture](#component-architecture)
5. [Navigation](#navigation)
6. [State Management](#state-management)
7. [Styling and Theming](#styling-and-theming)
8. [Real-time Communication](#real-time-communication)
9. [API Integration](#api-integration)
10. [TypeScript Usage](#typescript-usage)
11. [Development Workflow](#development-workflow)
12. [Performance Optimization](#performance-optimization)
13. [Testing](#testing)

## Overview

The mobile application is built with React Native and Expo, providing a native mobile experience for iOS and Android platforms. It features real-time messaging, AI response validation dashboard, and intelligent agent interactions with cross-platform compatibility.

## Technology Stack

### Core Technologies
- **React Native** - Native mobile development framework
- **Expo** - Development platform and toolchain
- **TypeScript** - Type safety and better developer experience
- **Expo Router** - File-based routing system
- **React Native Paper** - Material Design components
- **Socket.io Client** - Real-time WebSocket communication

### Supporting Libraries
- **React Native Markdown Display** - Markdown rendering
- **React Native Gesture Handler** - Native gesture support
- **React Native Reanimated** - Advanced animations
- **React Native Safe Area Context** - Safe area handling
- **Expo Vector Icons** - Icon library

## Project Structure

```
frontend/
├── app/                    # Expo Router app directory
│   ├── (tabs)/            # Tab navigation group
│   │   ├── _layout.tsx    # Tab layout
│   │   ├── index.tsx      # Chat tab
│   │   └── explore.tsx    # Dashboard tab
│   ├── _layout.tsx        # Root layout
│   └── +not-found.tsx     # 404 page
├── components/            # React Native components
│   ├── AgentStatusBar.tsx # Agent status display
│   ├── ChatScreen.tsx     # Main chat interface
│   ├── MessageInput.tsx   # Message input component
│   ├── ValidationDashboard.tsx # AI validation metrics
│   └── ui/               # UI components
│       ├── IconSymbol.tsx
│       └── TabBarBackground.tsx
├── services/              # API and external services
│   └── socketService.ts   # WebSocket client
├── types/                 # TypeScript type definitions
│   └── index.ts          # Shared types
├── constants/             # App constants
│   └── Colors.ts         # Color scheme
├── hooks/                 # Custom hooks
│   ├── useColorScheme.ts # Theme detection
│   └── useThemeColor.ts  # Color theming
├── assets/               # Static assets
│   ├── images/          # Image files
│   └── fonts/           # Custom fonts
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── app.json             # Expo app configuration
└── App.tsx              # Application root
```

## Component Architecture

### Component Hierarchy

```
App
├── RootLayout
    └── TabLayout
        ├── ChatTab (index.tsx)
        │   └── ChatScreen
        │       ├── AgentStatusBar
        │       ├── MessageList
        │       │   └── MessageBubble
        │       └── MessageInput
        └── DashboardTab (explore.tsx)
            └── ValidationDashboard
                ├── MetricsCards
                ├── QualityChart
                └── ResponseList
```

### Core Components

#### 1. ChatScreen.tsx
Main chat interface component with full mobile functionality.

```typescript
import React, { useState, useEffect } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { socketService } from '../services/socketService';
import MessageInput from './MessageInput';
import AgentStatusBar from './AgentStatusBar';

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string>('general');

  useEffect(() => {
    socketService.connect();
    
    socketService.on('connect', () => setIsConnected(true));
    socketService.on('disconnect', () => setIsConnected(false));
    socketService.on('message', handleNewMessage);
    socketService.on('agent_selection', handleAgentSelection);

    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AgentStatusBar 
        activeAgent={activeAgent}
        isConnected={isConnected}
      />
      <ScrollView style={{ flex: 1 }}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </ScrollView>
      <MessageInput 
        onSendMessage={handleSendMessage}
        disabled={!isConnected}
      />
    </KeyboardAvoidingView>
  );
}
```

#### 2. ValidationDashboard.tsx
Real-time AI response validation and metrics display.

```typescript
import React, { useState, useEffect } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { Card, Title, Paragraph, ProgressBar } from 'react-native-paper';
import { socketService } from '../services/socketService';

export default function ValidationDashboard() {
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMetrics();
    setRefreshing(false);
  }, []);

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Card style={{ margin: 16 }}>
        <Card.Content>
          <Title>Response Quality</Title>
          <Paragraph>Average quality score</Paragraph>
          <ProgressBar 
            progress={metrics?.averageQuality || 0} 
            style={{ marginTop: 8 }}
          />
        </Card.Content>
      </Card>
      
      <Card style={{ margin: 16 }}>
        <Card.Content>
          <Title>Agent Performance</Title>
          {metrics?.agentStats.map((agent) => (
            <View key={agent.type}>
              <Paragraph>{agent.type}: {agent.responseCount}</Paragraph>
            </View>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}
```

#### 3. MessageInput.tsx
Native mobile message input with enhanced UX.

```typescript
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { Haptics } from 'expo-haptics';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const theme = useTheme();

  const handleSend = () => {
    if (message.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <View style={{
      flexDirection: 'row',
      padding: 16,
      backgroundColor: theme.colors.surface,
      alignItems: 'flex-end',
    }}>
      <TextInput
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: theme.colors.outline,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 12,
          maxHeight: 100,
          backgroundColor: theme.colors.background,
        }}
        value={message}
        onChangeText={setMessage}
        placeholder="Type a message..."
        multiline
        editable={!disabled}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />
      <IconButton
        icon="send"
        onPress={handleSend}
        disabled={disabled || !message.trim()}
        style={{ marginLeft: 8 }}
      />
    </View>
  );
}
```

## Navigation

### Expo Router File-based Routing

The app uses Expo Router with file-based routing:

```typescript
// app/_layout.tsx - Root layout
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
```

```typescript
// app/(tabs)/_layout.tsx - Tab navigation
import { Tabs } from 'expo-router';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'chatbubble' : 'chatbubble-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'analytics' : 'analytics-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

## State Management

### React Native State with Hooks

```typescript
// Custom hooks for state management
export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentType>('general');

  useEffect(() => {
    socketService.connect();
    
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };
    const handleAgentSelection = (agent: AgentType) => {
      setActiveAgent(agent);
    };

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('message', handleMessage);
    socketService.on('agent_selection', handleAgentSelection);

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('message', handleMessage);
      socketService.off('agent_selection', handleAgentSelection);
    };
  }, []);

  return {
    isConnected,
    messages,
    activeAgent,
    sendMessage: socketService.sendMessage,
  };
}
```

## Styling and Theming

### React Native Paper Theming

```typescript
// constants/Colors.ts
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

// Theme provider setup
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.light.tint,
    background: Colors.light.background,
    surface: '#f8f9fa',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: Colors.dark.tint,
    background: Colors.dark.background,
    surface: '#1e1e1e',
  },
};
```

### Custom Hook for Theme

```typescript
// hooks/useThemeColor.ts
import { useColorScheme } from './useColorScheme';
import { Colors } from '@/constants/Colors';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
```

## Real-time Communication

### Socket.io Service for Mobile

```typescript
// services/socketService.ts
import io, { Socket } from 'socket.io-client';
import { Message, AgentType, ValidationResult } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect() {
    this.socket = io(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  sendMessage(message: string, conversationId?: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('stream_chat', { message, conversationId });
    }
  }

  on(event: string, callback: Function) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: Function) {
    this.socket?.off(event, callback);
  }

  // Mobile-specific methods
  onStreamChunk(callback: (chunk: { messageId: string; content: string }) => void) {
    this.socket?.on('stream_chunk', callback);
  }

  onValidationResult(callback: (result: ValidationResult) => void) {
    this.socket?.on('validation_result', callback);
  }

  onAgentSelection(callback: (agent: AgentType) => void) {
    this.socket?.on('agent_selection', callback);
  }
}

export const socketService = new SocketService();
```

## API Integration

### Mobile-optimized HTTP Client

```typescript
// services/api.ts (mobile-specific)
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getValidationMetrics() {
    return this.request<ValidationMetrics>('/api/validation/metrics');
  }

  async getConversationHistory() {
    return this.request<Message[]>('/api/conversations');
  }

  async submitFeedback(messageId: string, rating: number, comment?: string) {
    return this.request('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId, rating, comment }),
    });
  }
}

export const apiService = new ApiService();
```

## TypeScript Usage

### Mobile-specific Type Definitions

```typescript
// types/index.ts
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
  agentType?: AgentType;
  validationScore?: number;
}

export interface ValidationMetrics {
  averageQuality: number;
  totalMessages: number;
  agentStats: AgentStats[];
  responseTimeAvg: number;
  satisfactionScore: number;
}

export interface AgentStats {
  type: AgentType;
  responseCount: number;
  averageQuality: number;
  averageResponseTime: number;
}

export type AgentType = 
  | 'general'
  | 'technical'
  | 'joke'
  | 'trivia'
  | 'gif'
  | 'hold_agent';

// Navigation types for Expo Router
export type RootTabParamList = {
  index: undefined;
  explore: undefined;
};

// Component prop types
export interface ChatScreenProps {
  conversationId?: string;
}

export interface ValidationDashboardProps {
  refreshInterval?: number;
}
```

## Development Workflow

### Available Scripts

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "expo lint",
    "reset-project": "node ./scripts/reset-project.js"
  }
}
```

### Environment Configuration

```bash
# .env (development)
EXPO_PUBLIC_API_URL=http://localhost:3001

# .env.production
EXPO_PUBLIC_API_URL=https://your-production-api.com
```

### Development Tools

1. **Expo CLI** - Development server and tools
2. **Expo Go** - Mobile app for testing
3. **React Native Debugger** - Debugging tool
4. **Flipper** - Advanced debugging
5. **EAS Build** - Cloud build service

## Performance Optimization

### Mobile-specific Optimizations

```typescript
// Lazy loading for heavy components
const ValidationDashboard = React.lazy(() => import('../components/ValidationDashboard'));

// Memoization for expensive operations
const MessageList = React.memo(({ messages }) => {
  return (
    <FlatList
      data={messages}
      renderItem={({ item }) => <MessageBubble message={item} />}
      keyExtractor={(item) => item.id}
      getItemLayout={(data, index) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      })}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
    />
  );
});

// Image optimization
import { Image } from 'expo-image';

const OptimizedImage = ({ source, ...props }) => (
  <Image
    source={source}
    contentFit="cover"
    transition={200}
    {...props}
  />
);
```

## Testing

### Mobile Testing Strategy

```typescript
// __tests__/ChatScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ChatScreen from '../components/ChatScreen';
import { socketService } from '../services/socketService';

// Mock socket service
jest.mock('../services/socketService');

describe('ChatScreen', () => {
  it('renders correctly', () => {
    const { getByPlaceholderText } = render(<ChatScreen />);
    expect(getByPlaceholderText('Type a message...')).toBeTruthy();
  });

  it('sends message when button is pressed', async () => {
    const { getByPlaceholderText, getByRole } = render(<ChatScreen />);
    const input = getByPlaceholderText('Type a message...');
    const sendButton = getByRole('button');

    fireEvent.changeText(input, 'Hello');
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(socketService.sendMessage).toHaveBeenCalledWith('Hello', undefined);
    });
  });
});
```

### Testing Tools

```json
{
  "devDependencies": {
    "@testing-library/react-native": "^12.0.0",
    "@testing-library/jest-native": "^5.0.0",
    "jest": "^29.0.0",
    "jest-expo": "^51.0.0"
  }
}
```

This mobile frontend guide provides comprehensive documentation for the React Native/Expo application, covering all aspects of mobile development, from component architecture to testing strategies.
