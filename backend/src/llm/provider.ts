export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface LLMTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMStreamOptions {
  model: string;
  system: string;
  messages: LLMMessage[];
  tools?: LLMTool[];
  temperature?: number;
  maxTokens?: number;
  cacheSystem?: boolean;
}

export type LLMStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | {
      type: 'done';
      usage?: { input: number; output: number; cacheRead?: number };
    }
  | { type: 'error'; error: string };

export interface LLMProvider {
  readonly id: 'openai' | 'anthropic' | 'foundry';
  stream(opts: LLMStreamOptions): AsyncIterable<LLMStreamEvent>;
}
