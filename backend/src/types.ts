import { AgentType } from './agents/types';

export type MediaAttachment =
  | {
      id: string;
      type: 'youtube';
      videoId: string;
      title: string;
      channel?: string;
      thumbnail: string;
      duration?: string;
    }
  | { id: string; type: 'video'; url: string; title: string; poster?: string }
  | {
      id: string;
      type: 'audio';
      url: string;
      title: string;
      artist?: string;
      durationSec?: number;
    }
  | {
      id: string;
      type: 'image';
      url: string;
      alt: string;
      width?: number;
      height?: number;
    }
  | {
      id: string;
      type: 'image_gallery';
      images: Array<{ url: string; alt: string }>;
    }
  | {
      id: string;
      type: 'gif';
      url: string;
      title?: string;
      width?: number;
      height?: number;
    }
  | {
      id: string;
      type: 'dice';
      notation: string;
      rolls: number[];
      total: number;
      purpose?: string;
    }
  | {
      id: string;
      type: 'card';
      kind: string;
      title: string;
      fields: Array<{ label: string; value: string }>;
      accentColor?: string;
    };

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
  agentUsed?: AgentType;
  confidence?: number;
  isProactive?: boolean;
  attachments?: MediaAttachment[];
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
