export type Role = 'user' | 'assistant';

export interface MediaAttachment {
  type: 'youtube' | 'video' | 'audio' | 'image' | 'gif' | 'dice' | 'card';
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: Role;
  timestamp: string | Date;
  conversationId: string;
  agentUsed?: string;
  confidence?: number;
  isProactive?: boolean;
  status?: 'pending' | 'streaming' | 'complete' | 'error';
  attachments?: MediaAttachment[];
  user?: { name: string; email?: string; avatar?: string };
}

export interface StreamStartEvent {
  messageId: string;
  conversationId: string;
}

export interface StreamChunkEvent {
  id: string;
  messageId: string;
  conversationId: string;
  content: string;
  isComplete: boolean;
}

export interface StreamCompleteEvent {
  messageId: string;
  conversationId: string;
  conversation: { id: string; messages: ChatMessage[] };
  agentUsed?: string;
  confidence?: number;
  attachments?: MediaAttachment[];
}

export interface StreamErrorEvent {
  messageId?: string;
  conversationId?: string;
  message: string;
  code?: string;
}

export interface HandoffEvent {
  conversationId: string;
  messageId: string;
  fromAgent: string;
  toAgent: string;
  message?: string;
  reason?: string;
}

export interface AgentStatusUpdateEvent {
  conversationId?: string;
  activeAgent?: string;
  goalState?: string;
  [key: string]: unknown;
}

export interface AttachmentEvent {
  messageId: string;
  conversationId: string;
  attachment: MediaAttachment;
}

export interface ProactiveMessageEvent {
  message: ChatMessage;
  actionType?: string;
  agentUsed?: string;
  confidence?: number;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  user?: { name: string; email?: string };
}

export interface ServerToClientEvents {
  stream_start: (e: StreamStartEvent) => void;
  stream_chunk: (e: StreamChunkEvent) => void;
  stream_complete: (e: StreamCompleteEvent) => void;
  stream_error: (e: StreamErrorEvent) => void;
  new_message: (m: ChatMessage) => void;
  proactive_message: (e: ProactiveMessageEvent) => void;
  proactive_error: (e: { message: string; actionType?: string; error?: string }) => void;
  handoff_event: (e: HandoffEvent) => void;
  agent_status_update: (e: AgentStatusUpdateEvent) => void;
  attachment: (e: AttachmentEvent) => void;
  user_typing: (e: { conversationId: string; userId?: string; isTyping: boolean }) => void;
  message_status: (e: { messageId: string; conversationId: string; status: string }) => void;
}

export interface ClientToServerEvents {
  stream_chat: (req: ChatRequest, ack?: (res: { accepted: boolean; error?: string }) => void) => void;
  cancel_stream: (e: { conversationId: string; messageId: string }) => void;
  join_conversation: (conversationId: string) => void;
  leave_conversation: (conversationId: string) => void;
  typing_start: (e: { conversationId: string }) => void;
  typing_stop: (e: { conversationId: string }) => void;
  message_read: (e: { conversationId: string; messageId: string }) => void;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
