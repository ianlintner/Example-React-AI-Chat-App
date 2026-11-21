/**
 * Deterministic mock model for tests, CI, Storybook and offline dev.
 * Streams the given text in word-sized deltas. No network.
 */
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

export interface MockModelOptions {
  text?: string;
  /** Delay between chunks in ms (0 = as fast as possible). */
  chunkDelayMs?: number;
}

export function mockStreamParts(text: string): LanguageModelV4StreamPart[] {
  const words = text.match(/\S+\s*/g) ?? [text];
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 't0' },
    ...words.map(delta => ({ type: 'text-delta' as const, id: 't0', delta })),
    { type: 'text-end', id: 't0' },
    {
      type: 'finish',
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: words.length, text: words.length, reasoning: 0 },
      },
    },
  ];
}

export function createMockModel({
  text = 'Mock reply from the agent.',
  chunkDelayMs = 0,
}: MockModelOptions = {}) {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'mock',
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: mockStreamParts(text),
        initialDelayInMs: 0,
        chunkDelayInMs: chunkDelayMs,
      }),
    }),
  });
}
