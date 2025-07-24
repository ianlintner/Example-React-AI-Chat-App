export type AgentType = 'technical' | 'general' | 'joke' | 'trivia' | 'gif';

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
