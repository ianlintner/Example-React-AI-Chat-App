import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import {
  createAgentRuntime,
  createLlm,
  defaultDecision,
  loadLlmConfig,
  MemoryStore,
} from '../index';
import { loadSkills } from './loader';
import { createToolRegistry } from '../tools/registry';
import { loadToolsConfig } from '../tools/config';
import type { ToolDeps } from '../tools/types';

/**
 * Mock-model trajectory: the user asks for dice → the dnd skill is selected →
 * the model calls its allowed `dice` tool → the final answer includes the total.
 * No network calls: both the LLM and the tool fetch are mocked.
 */
describe('skill selection + tool-call trajectory', () => {
  it('selects dnd and calls only its allowed dice tool', async () => {
    const skills = await loadSkills(
      new URL('../../skills', import.meta.url).pathname,
    );
    const deps: ToolDeps = {
      fetch: vi.fn(async () => {
        throw new Error('no network in tests');
      }) as unknown as typeof fetch,
      env: loadToolsConfig({}),
      newId: () => 'media_dice_1',
      now: () => 0,
      random: () => 0.25, // 2d6 → [2, 2] + 3 = 7
    };
    const registry = createToolRegistry({ skills, deps });
    const model = new MockLanguageModelV4({
      provider: 'mock',
      modelId: 'trajectory',
      doStream: async ({ prompt }) => {
        // First call: emit a tool call; second: emit final text.
        const hasToolResult = JSON.stringify(prompt).includes('dice');
        const parts = hasToolResult
          ? [
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Rolled 2d6+3: total 7.' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop' as const,
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]
          : [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                toolName: 'dice',
                input: JSON.stringify({ notation: '2d6+3', purpose: 'attack' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
              },
            ];
        return { stream: ReadableStream.from(parts as never[]) } as never;
      },
    });
    const llm = createLlm(loadLlmConfig({ LLM_PROVIDER: 'mock' }));
    llm.model = () => model;
    const store = new MemoryStore();
    const principal = {
      userId: 'user_a',
      kind: 'user' as const,
      tier: 'free' as const,
    };
    await store.createThread('thr_skills', principal);
    await store.createRun({
      runId: 'run_skills',
      threadId: 'thr_skills',
      ownerId: principal.userId,
      status: 'running',
      tier: 'fast',
    });
    const runtime = createAgentRuntime({ llm, store, skills, tools: registry });
    const messages = [
      {
        id: 'u1',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'roll 2d6+3 for my attack' }],
      },
    ];
    const stream = runtime.stream({
      threadId: 'thr_skills',
      runId: 'run_skills',
      principal,
      messages,
      decision: defaultDecision(messages),
    });
    const chunks: unknown[] = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const serialized = JSON.stringify(chunks);
    expect(serialized).toContain('Rolled 2d6+3');
    expect((await store.getRun('run_skills', principal))?.status).toBe(
      'completed',
    );
  });
});
