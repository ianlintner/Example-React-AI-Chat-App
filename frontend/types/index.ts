export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
  agentUsed?: string;
  confidence?: number;
  isProactive?: boolean;
  status?: 'pending' | 'streaming' | 'complete';
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
  avatar?: string;
  provider?: 'github' | 'google';
  createdAt: Date;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  stream?: boolean;
  forceAgent?: 'technical' | 'general' | 'joke' | 'trivia' | 'gif';
}

export interface ChatResponse {
  message: Message;
  conversation: Conversation;
  agentUsed: 'technical' | 'general' | 'joke' | 'trivia' | 'gif';
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
  details?: unknown;
}

export interface Theme {
  mode: 'light' | 'dark';
}

export interface AppSettings {
  theme: Theme;
  autoSave: boolean;
  modelPreference: string;
}

export type AgentType =
  | 'general'
  | 'joke'
  | 'trivia'
  | 'gif'
  | 'account_support'
  | 'billing_support'
  | 'website_support'
  | 'operator_support'
  | 'hold_agent'
  | 'story_teller'
  | 'riddle_master'
  | 'quote_master'
  | 'game_host'
  | 'music_guru';

export interface Agent {
  id: string;
  name: string;
  description: string;
}

export interface AgentStatus {
  currentAgent: AgentType;
  isActive: boolean;
  activeAgentInfo: {
    agentType: AgentType;
    timestamp: Date;
  } | null;
  conversationContext: {
    currentAgent: AgentType;
    conversationTopic: string;
    conversationDepth: number;
    userSatisfaction: number;
    agentPerformance: number;
    shouldHandoff: boolean;
    handoffTarget?: AgentType;
    handoffReason?: string;
  } | null;
  goalState: {
    currentState: string;
    engagementLevel: number;
    satisfactionLevel: number;
    entertainmentPreference: string;
    activeGoals: {
      type: string;
      priority: number;
      progress: number;
    }[];
  } | null;
  timestamp: Date;
  availableAgents: Agent[];
}
