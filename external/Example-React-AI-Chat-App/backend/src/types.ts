import { AgentType } from './agents/types';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
  agentUsed?: AgentType;
  confidence?: number;
  isProactive?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  stream?: boolean;
  forceAgent?: AgentType;
}

export interface ChatResponse {
  message: Message;
  conversation: Conversation;
  agentUsed: AgentType;
  confidence: number;
}

export interface StreamChunk {
  id: string;
  content: string;
  conversationId: string;
  messageId: string;
  isComplete: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  details?: any;
}

export interface Theme {
  mode: 'light' | 'dark';
}

export interface AppSettings {
  theme: Theme;
  autoSave: boolean;
  modelPreference: string;
}
