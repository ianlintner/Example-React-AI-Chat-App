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
  | 'music_guru'
  | 'youtube_guru'
  | 'dnd_master';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AgentResponse {
  content: string;
  agentUsed: AgentType;
  confidence: number;
}

export interface MessageClassification {
  agentType: AgentType;
  confidence: number;
  reasoning: string;
}
