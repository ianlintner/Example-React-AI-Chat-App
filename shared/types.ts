export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
  user?: {
    name: string;
    email?: string;
    avatar?: string;
  };
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
  provider?: string;
  providerId?: string;
  avatar?: string;
  lastLoginAt?: Date;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  message: Message;
  conversation: Conversation;
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
