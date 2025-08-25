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

## Mobile Architecture

```mermaid
graph TB
    subgraph "React Native Mobile Architecture"
        User[Mobile User] --> NativeApp[React Native App]
        
        subgraph "Application Layer"
            NativeApp --> ExpoRouter[Expo Router<br/>File-based navigation]
            NativeApp --> ComponentTree[Component Tree<br/>React Native components]
            NativeApp --> StateManager[State Management<br/>React hooks & context]
        end
        
        subgraph "UI Framework Layer"
            ExpoRouter --> TabNavigation[Tab Navigation<br/>Chat & Dashboard]
            ComponentTree --> RNPaper[React Native Paper<br/>Material Design UI]
            ComponentTree --> ExpoComponents[Expo Components<br/>Native platform APIs]
            
            StateManager --> ThemeProvider[Theme Provider<br/>Light/Dark mode support]
            StateManager --> SocketContext[Socket Context<br/>Real-time state]
        end
        
        subgraph "Service Layer"
            TabNavigation --> ChatScreen[Chat Screen<br/>Real-time messaging]
            TabNavigation --> DashboardScreen[Dashboard Screen<br/>Validation metrics]
            
            SocketContext --> SocketService[Socket Service<br/>WebSocket client]
            ThemeProvider --> APIService[API Service<br/>HTTP client]
        end
        
        subgraph "Native Platform Integration"
            ChatScreen --> NativeKeyboard[Native Keyboard<br/>Text input handling]
            ChatScreen --> NativeGestures[Native Gestures<br/>Touch interactions]
            DashboardScreen --> NativeRefresh[Native Refresh<br/>Pull-to-refresh]
            
            SocketService --> WebSocketAPI[WebSocket API<br/>Real-time backend]
            APIService --> RESTAPI[REST API<br/>HTTP backend]
        end
        
        subgraph "Device Features"
            NativeKeyboard --> Haptics[Haptic Feedback<br/>Touch response]
            NativeGestures --> Animations[Native Animations<br/>Reanimated 3]
            NativeRefresh --> StatusBar[Status Bar<br/>System integration]
        end
        
        subgraph "External Integration"
            WebSocketAPI --> Backend[Backend Services<br/>Node.js + Express]
            RESTAPI --> Backend
            
            Haptics --> iOS[iOS Platform<br/>Native features]
            Haptics --> Android[Android Platform<br/>Native features]
        end
    end

    classDef service fill:#e1f5fe,stroke:#01579b,color:#000
    classDef data fill:#e8f5e8,stroke:#2e7d32,color:#000
    classDef external fill:#fff3e0,stroke:#ef6c00,color:#000
    classDef mobile fill:#f3e5f5,stroke:#7b1fa2,color:#000
    classDef native fill:#e8eaf6,stroke:#3f51b5,color:#000
    
    class NativeApp,ExpoRouter,ComponentTree,StateManager,RNPaper,ExpoComponents,ThemeProvider,SocketContext,SocketService,APIService service
    class ChatScreen,DashboardScreen,TabNavigation data
    class User,Backend,WebSocketAPI,RESTAPI,iOS,Android external
    class NativeKeyboard,NativeGestures,NativeRefresh,Haptics,Animations,StatusBar native
```

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

## React Native Component Flow

```mermaid
graph TB
    subgraph "React Native Component Architecture"
        App[App.tsx<br/>Application Root] --> RootLayout[_layout.tsx<br/>Root Layout Provider]
        
        subgraph "Navigation Layer"
            RootLayout --> ExpoRouter[Expo Router<br/>File-based routing]
            ExpoRouter --> TabLayout[tabs/_layout.tsx<br/>Tab Navigation]
            
            TabLayout --> ChatTab[index.tsx<br/>Chat Tab Screen]
            TabLayout --> DashboardTab[explore.tsx<br/>Dashboard Tab Screen]
        end
        
        subgraph "Chat Screen Components"
            ChatTab --> ChatScreen[ChatScreen.tsx<br/>Main chat interface]
            
            ChatScreen --> AgentStatus[AgentStatusBar.tsx<br/>🤖 Agent indicator]
            ChatScreen --> MessageContainer[Message Container<br/>ScrollView wrapper]
            ChatScreen --> InputContainer[Message Input Container<br/>KeyboardAvoidingView]
            
            MessageContainer --> MessageList[Message List<br/>FlatList optimization]
            MessageList --> MessageBubble[MessageBubble.tsx<br/>Individual message UI]
            
            InputContainer --> MessageInput[MessageInput.tsx<br/>Text input + send button]
            MessageInput --> SendButton[Send Button<br/>IconButton with haptics]
        end
        
        subgraph "Dashboard Screen Components"
            DashboardTab --> ValidationDash[ValidationDashboard.tsx<br/>Metrics interface]
            
            ValidationDash --> MetricsGrid[Metrics Grid<br/>Card-based layout]
            ValidationDash --> ChartContainer[Chart Container<br/>Visualization wrapper]
            ValidationDash --> ResponseLog[Response Log<br/>Validation history]
            
            MetricsGrid --> QualityCard[Quality Score Card<br/>Progress indicators]
            MetricsGrid --> AgentCard[Agent Stats Card<br/>Performance metrics]
            MetricsGrid --> ResponseCard[Response Time Card<br/>Latency tracking]
            
            ChartContainer --> QualityChart[Quality Trend Chart<br/>Line chart component]
            ChartContainer --> AgentPieChart[Agent Usage Chart<br/>Pie chart distribution]
        end
        
        subgraph "Shared UI Components"
            MessageBubble --> ThemedText[ThemedText.tsx<br/>Theme-aware text]
            QualityCard --> ThemedView[ThemedView.tsx<br/>Theme-aware container]
            
            ThemedText --> ColorScheme[useColorScheme<br/>Dark/Light detection]
            ThemedView --> ThemeColor[useThemeColor<br/>Dynamic color resolution]
        end
        
        subgraph "Service Integration"
            ChatScreen --> SocketService[socketService.ts<br/>WebSocket client]
            ValidationDash --> APIService[apiService.ts<br/>HTTP client]
            
            SocketService --> RealTimeEvents[Real-time Events<br/>Message streaming]
            APIService --> DataFetching[Data Fetching<br/>REST API calls]
        end
    end

    classDef service fill:#e1f5fe,stroke:#01579b,color:#000
    classDef data fill:#e8f5e8,stroke:#2e7d32,color:#000
    classDef external fill:#fff3e0,stroke:#ef6c00,color:#000
    classDef component fill:#f3e5f5,stroke:#7b1fa2,color:#000
    classDef ui fill:#e8eaf6,stroke:#3f51b5,color:#000
    
    class App,RootLayout,ExpoRouter,TabLayout,SocketService,APIService,RealTimeEvents,DataFetching service
    class ChatScreen,ValidationDash,MessageContainer,MessageList,MetricsGrid,ChartContainer data
    class ChatTab,DashboardTab,ColorScheme,ThemeColor external
    class AgentStatus,MessageBubble,MessageInput,QualityCard,AgentCard,ResponseCard,QualityChart,AgentPieChart component
    class ThemedText,ThemedView,SendButton ui
```

### Component Hierarchy Tree

```mermaid
graph LR
    subgraph "Component Tree Structure"
        App[📱 App] --> Root[🏠 RootLayout]
        Root --> Tabs[📑 TabLayout]
        
        Tabs --> Chat[💬 ChatTab]
        Tabs --> Dash[📊 DashboardTab]
        
        Chat --> ChatScreen[🖥️ ChatScreen]
        Dash --> ValDash[📈 ValidationDashboard]
        
        ChatScreen --> Agent[🤖 AgentStatusBar]
        ChatScreen --> Messages[📜 MessageList]
        ChatScreen --> Input[⌨️ MessageInput]
        
        Messages --> Bubble[💭 MessageBubble]
        Input --> Send[📤 SendButton]
        
        ValDash --> Cards[🗃️ MetricsCards]
        ValDash --> Chart[📊 QualityChart]
        ValDash --> Log[📋 ResponseList]
        
        subgraph "Shared Components"
            Bubble --> Text[📝 ThemedText]
            Cards --> View[🎨 ThemedView]
            Agent --> Status[🔄 ConnectionStatus]
        end
    end

    classDef root fill:#e1f5fe,stroke:#01579b,color:#000
    classDef screen fill:#e8f5e8,stroke:#2e7d32,color:#000
    classDef component fill:#f3e5f5,stroke:#7b1fa2,color:#000
    classDef shared fill:#e8eaf6,stroke:#3f51b5,color:#000
    
    class App,Root,Tabs root
    class Chat,Dash,ChatScreen,ValDash screen
    class Agent,Messages,Input,Cards,Chart,Log,Bubble,Send component
    class Text,View,Status shared
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
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark,
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

## Real-time Communication Architecture

```mermaid
sequenceDiagram
    participant User as Mobile User
    participant App as React Native App
    participant Socket as Socket Service
    participant Backend as Backend Server
    participant AI as AI Agent System

    User->>+App: Launch application
    App->>+Socket: Initialize connection
    Socket->>+Backend: WebSocket handshake
    Backend-->>-Socket: Connection established
    Socket-->>-App: Connection confirmed
    App-->>-User: Chat interface ready

    Note over User,AI: Real-time Message Flow
    User->>+App: Type & send message
    App->>App: Add message to local state
    App->>+Socket: Emit 'stream_chat' event
    Socket->>+Backend: Forward message data
    
    Backend->>Backend: Process with agent service
    Backend->>+AI: Generate streaming response
    
    Note over Backend,AI: Streaming Response Chunks
    loop Response Streaming
        AI-->>Backend: Response chunk
        Backend->>Socket: 'stream_chunk' event
        Socket-->>App: Real-time chunk delivery
        App->>App: Update message content
        App-->>User: Display streaming text
    end
    
    AI-->>-Backend: Stream complete
    Backend->>Socket: 'stream_complete' event
    Socket-->>App: Final message confirmation
    App->>App: Mark message as complete
    App-->>-User: Complete response displayed
    
    Note over User,AI: Mobile-Specific Optimizations
    App->>App: Handle app backgrounding
    App->>Socket: Maintain connection state
    Socket->>Backend: Keep-alive pings
    Backend-->>Socket: Connection health check
    Socket-->>App: Connection status update
    App-->>User: Network status indicator
```

## State Management Flow

```mermaid
graph TB
    subgraph "React Native State Management"
        UserAction[User Interaction] --> ComponentState[Component State]
        
        subgraph "Local State Layer"
            ComponentState --> LocalHooks[React Hooks<br/>useState, useEffect]
            LocalHooks --> StateUpdate[State Updates<br/>Immutable patterns]
            
            StateUpdate --> ChatState[Chat State<br/>Messages, typing status]
            StateUpdate --> ValidationState[Validation State<br/>Metrics, agent status]
            StateUpdate --> UIState[UI State<br/>Theme, navigation]
        end
        
        subgraph "Service State Layer"
            ChatState --> SocketHook[useSocket Hook<br/>WebSocket state management]
            ValidationState --> APIHook[useAPI Hook<br/>HTTP data fetching]
            UIState --> ThemeHook[useTheme Hook<br/>Color scheme management]
            
            SocketHook --> SocketService[Socket Service<br/>Connection management]
            APIHook --> HTTPService[HTTP Service<br/>REST API client]
            ThemeHook --> ThemeProvider[Theme Provider<br/>Context distribution]
        end
        
        subgraph "Persistent State"
            SocketService --> AsyncStorage[AsyncStorage<br/>Local data persistence]
            HTTPService --> AsyncStorage
            ThemeProvider --> AsyncStorage
            
            AsyncStorage --> ConversationCache[Conversation Cache<br/>Message history]
            AsyncStorage --> UserPreferences[User Preferences<br/>Settings & theme]
            AsyncStorage --> ValidationCache[Validation Cache<br/>Metrics offline access]
        end
        
        subgraph "External State Sync"
            SocketService --> RealTimeSync[Real-time Sync<br/>WebSocket events]
            HTTPService --> RESTSync[REST Sync<br/>HTTP requests]
            
            RealTimeSync --> BackendState[Backend State<br/>Live data stream]
            RESTSync --> BackendState
            
            BackendState --> StateReconciliation[State Reconciliation<br/>Conflict resolution]
        end
        
        subgraph "UI State Propagation"
            StateReconciliation --> ComponentRerender[Component Re-render<br/>React reconciliation]
            ComponentRerender --> UIUpdate[UI Update<br/>Native view changes]
            UIUpdate --> UserFeedback[User Feedback<br/>Visual & haptic response]
        end
    end

    classDef service fill:#e1f5fe,stroke:#01579b,color:#000
    classDef data fill:#e8f5e8,stroke:#2e7d32,color:#000
    classDef external fill:#fff3e0,stroke:#ef6c00,color:#000
    classDef state fill:#f3e5f5,stroke:#7b1fa2,color:#000
    classDef ui fill:#e8eaf6,stroke:#3f51b5,color:#000
    
    class SocketService,HTTPService,ThemeProvider,RealTimeSync,RESTSync,StateReconciliation service
    class AsyncStorage,ConversationCache,UserPreferences,ValidationCache,BackendState data
    class UserAction,UserFeedback external
    class ComponentState,LocalHooks,StateUpdate,ChatState,ValidationState,UIState,SocketHook,APIHook,ThemeHook state
    class ComponentRerender,UIUpdate ui
```

### Socket.io Service for Mobile

```typescript
// services/socketService.ts
import io, { Socket } from 'socket.io-client';
import { Message, AgentType, ValidationResult } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect() {
    this.socket = io(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001', {
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

    this.socket.on('connect_error', error => {
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

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';

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

export type AgentType = 'general' | 'technical' | 'joke' | 'trivia' | 'gif' | 'hold_agent';

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
EXPO_PUBLIC_API_URL=http://localhost:5001

# .env.production
EXPO_PUBLIC_API_URL=https://your-production-api.com
```

### Development Tools

1. **Expo CLI** - Development server and tools
2. **Expo Go** - Mobile app for testing
3. **React Native Debugger** - Debugging tool
4. **Flipper** - Advanced debugging
5. **EAS Build** - Cloud build service

## Mobile UI/UX Patterns

```mermaid
graph TB
    subgraph "Mobile UI/UX Architecture"
        UserInteraction[User Touch] --> GestureHandler[Gesture Handler<br/>Native touch processing]
        
        subgraph "Input Processing"
            GestureHandler --> TouchGestures[Touch Gestures<br/>Tap, swipe, pinch, scroll]
            TouchGestures --> HapticFeedback[Haptic Feedback<br/>Tactile response]
            TouchGestures --> InputValidation[Input Validation<br/>Text & gesture validation]
        end
        
        subgraph "Visual Feedback"
            HapticFeedback --> AnimationEngine[Animation Engine<br/>Reanimated 3]
            InputValidation --> LoadingStates[Loading States<br/>Skeleton & spinners]
            
            AnimationEngine --> TransitionAnim[Transition Animations<br/>Screen & component transitions]
            AnimationEngine --> MicroInteractions[Micro-interactions<br/>Button press, list scroll]
            
            LoadingStates --> ProgressIndicators[Progress Indicators<br/>Message sending, data loading]
            LoadingStates --> SkeletonLoaders[Skeleton Loaders<br/>Content placeholders]
        end
        
        subgraph "Responsive Design"
            TransitionAnim --> ScreenAdaptation[Screen Adaptation<br/>Portrait/landscape modes]
            MicroInteractions --> SafeAreaHandling[Safe Area Handling<br/>Notch & bottom bar]
            
            ScreenAdaptation --> DynamicLayout[Dynamic Layout<br/>Flex-based responsive design]
            SafeAreaHandling --> AccessibilitySupport[Accessibility Support<br/>Screen readers & navigation]
        end
        
        subgraph "Performance Optimization"
            ProgressIndicators --> LazyLoading[Lazy Loading<br/>Component-based splitting]
            SkeletonLoaders --> VirtualizedLists[Virtualized Lists<br/>FlatList optimization]
            
            DynamicLayout --> MemoryManagement[Memory Management<br/>Component unmounting]
            AccessibilitySupport --> ImageOptimization[Image Optimization<br/>Caching & compression]
        end
        
        subgraph "Platform Integration"
            LazyLoading --> NativeFeatures[Native Features<br/>Camera, notifications, sharing]
            VirtualizedLists --> DeviceAPI[Device API<br/>Battery, network, storage]
            
            MemoryManagement --> PlatformSpecific[Platform Specific<br/>iOS/Android differences]
            ImageOptimization --> NativeBridge[Native Bridge<br/>React Native modules]
        end
        
        subgraph "User Experience"
            NativeFeatures --> OfflineSupport[Offline Support<br/>Cached data & queue sync]
            DeviceAPI --> NetworkHandling[Network Handling<br/>Connection status & retry]
            
            PlatformSpecific --> ErrorBoundaries[Error Boundaries<br/>Graceful failure handling]
            NativeBridge --> PerformanceMonitoring[Performance Monitoring<br/>FPS & memory tracking]
        end
    end

    classDef service fill:#e1f5fe,stroke:#01579b,color:#000
    classDef data fill:#e8f5e8,stroke:#2e7d32,color:#000
    classDef external fill:#fff3e0,stroke:#ef6c00,color:#000
    classDef ui fill:#f3e5f5,stroke:#7b1fa2,color:#000
    classDef optimization fill:#e8eaf6,stroke:#3f51b5,color:#000
    
    class GestureHandler,AnimationEngine,LoadingStates,ScreenAdaptation,SafeAreaHandling,LazyLoading,VirtualizedLists,MemoryManagement,ImageOptimization service
    class ProgressIndicators,SkeletonLoaders,DynamicLayout,AccessibilitySupport,OfflineSupport,NetworkHandling,ErrorBoundaries,PerformanceMonitoring data
    class UserInteraction,NativeFeatures,DeviceAPI,PlatformSpecific,NativeBridge external
    class TouchGestures,HapticFeedback,InputValidation,TransitionAnim,MicroInteractions ui
```

## Performance Optimization

```mermaid
graph TB
    subgraph "Mobile Performance Optimization Strategy"
        AppLaunch[App Launch] --> StartupOptimization[Startup Optimization]
        
        subgraph "Initial Load Optimization"
            StartupOptimization --> CodeSplitting[Code Splitting<br/>Lazy component loading]
            StartupOptimization --> BundleOptimization[Bundle Optimization<br/>Tree shaking & minification]
            StartupOptimization --> PreloadStrategies[Preload Strategies<br/>Critical path resources]
        end
        
        subgraph "Runtime Performance"
            CodeSplitting --> ComponentOptimization[Component Optimization<br/>React.memo & useMemo]
            BundleOptimization --> ListOptimization[List Optimization<br/>FlatList virtualization]
            PreloadStrategies --> ImageOptimization[Image Optimization<br/>Caching & lazy loading]
            
            ComponentOptimization --> RenderOptimization[Render Optimization<br/>Minimize re-renders]
            ListOptimization --> MemoryOptimization[Memory Optimization<br/>Component cleanup]
            ImageOptimization --> NetworkOptimization[Network Optimization<br/>Request batching & caching]
        end
        
        subgraph "Animation Performance"
            RenderOptimization --> AnimationOptimization[Animation Optimization<br/>Native driver usage]
            MemoryOptimization --> GPUAcceleration[GPU Acceleration<br/>Hardware-accelerated transforms]
            NetworkOptimization --> InteractionOptimization[Interaction Optimization<br/>Touch response priority]
            
            AnimationOptimization --> SixtyFPS[60 FPS Target<br/>Smooth animations]
            GPUAcceleration --> LayerOptimization[Layer Optimization<br/>Composite layer management]
            InteractionOptimization --> ResponsiveUI[Responsive UI<br/>< 100ms touch response]
        end
        
        subgraph "Data Management"
            SixtyFPS --> StateOptimization[State Optimization<br/>Selective updates]
            LayerOptimization --> CacheOptimization[Cache Optimization<br/>Intelligent data caching]
            ResponsiveUI --> OfflineOptimization[Offline Optimization<br/>Local storage strategy]
            
            StateOptimization --> DataNormalization[Data Normalization<br/>Efficient state structure]
            CacheOptimization --> BackgroundSync[Background Sync<br/>Data updates when inactive]
            OfflineOptimization --> QueueManagement[Queue Management<br/>Action queuing & replay]
        end
        
        subgraph "Monitoring & Analysis"
            DataNormalization --> PerformanceMonitoring[Performance Monitoring<br/>FPS & memory tracking]
            BackgroundSync --> CrashReporting[Crash Reporting<br/>Error tracking & recovery]
            QueueManagement --> AnalyticsIntegration[Analytics Integration<br/>Performance metrics]
            
            PerformanceMonitoring --> OptimizationInsights[Optimization Insights<br/>Bottleneck identification]
            CrashReporting --> UserExperienceMetrics[UX Metrics<br/>Load times & responsiveness]
            AnalyticsIntegration --> ContinuousImprovement[Continuous Improvement<br/>Performance iteration]
        end
    end

    classDef service fill:#e1f5fe,stroke:#01579b,color:#000
    classDef data fill:#e8f5e8,stroke:#2e7d32,color:#000
    classDef external fill:#fff3e0,stroke:#ef6c00,color:#000
    classDef optimization fill:#f3e5f5,stroke:#7b1fa2,color:#000
    classDef monitoring fill:#e8eaf6,stroke:#3f51b5,color:#000
    
    class StartupOptimization,ComponentOptimization,RenderOptimization,AnimationOptimization,StateOptimization service
    class CodeSplitting,BundleOptimization,PreloadStrategies,ListOptimization,MemoryOptimization,NetworkOptimization,CacheOptimization,OfflineOptimization,DataNormalization,BackgroundSync,QueueManagement data
    class AppLaunch external
    class ImageOptimization,GPUAcceleration,InteractionOptimization,SixtyFPS,LayerOptimization,ResponsiveUI optimization
    class PerformanceMonitoring,CrashReporting,AnalyticsIntegration,OptimizationInsights,UserExperienceMetrics,ContinuousImprovement monitoring
```

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
