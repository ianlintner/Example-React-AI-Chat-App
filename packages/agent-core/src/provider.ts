/**
 * The `LLMProvider` seam ported from the legacy backend: an async iterable of
 * normalised events instead of a provider-specific stream. Route names (not
 * model ids) are supplied by `createLlm`; nothing here imports a provider.
 */
import type { Tier } from '@agent-chat/contract';
import { streamText } from 'ai';
import type { Llm } from './llm';

export type LLMEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'done'; usage?: { input: number; output: number } }
  | { type: 'error'; error: string };

export interface LLMProvider {
  readonly id: 'gateway' | 'mock';
  stream(input: {
    tier: Tier;
    system: string;
    prompt: string;
    abortSignal?: AbortSignal;
  }): AsyncIterable<LLMEvent>;
}

/** Wraps the AI SDK's stream in the legacy-shaped async-iterable seam. */
export function createLlmProvider(llm: Llm, id: 'gateway' | 'mock'): LLMProvider {
  return {
    id,
    async *stream({ tier, system, prompt, abortSignal }) {
      const result = streamText({
        model: llm.model(tier),
        system,
        prompt,
        abortSignal,
      });
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          yield { type: 'text_delta', text: part.text };
        } else if (part.type === 'finish') {
          yield {
            type: 'done',
            usage: {
              input: part.totalUsage.inputTokens ?? 0,
              output: part.totalUsage.outputTokens ?? 0,
            },
          };
        } else if (part.type === 'error') {
          yield { type: 'error', error: 'model_stream_failed' };
        }
      }
    },
  };
}
