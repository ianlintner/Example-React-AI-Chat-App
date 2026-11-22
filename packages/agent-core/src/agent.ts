/** Production agent loop: AI SDK ToolLoopAgent behind the AgentRuntime seam. */
import type {
  AgentUIMessage,
  AgentUIMessageChunk,
  RouteDecision,
} from '@agent-chat/contract';
import { createAgentUIStream, createUIMessageStream, ToolLoopAgent } from 'ai';
import type { Llm } from './llm';
import type { AgentRuntime, Router, RunStore } from './seams';
import type { ThreadStore } from './store/types';

const SYSTEM = `You are the assistant in the local development agent chat app.
Answer accurately and concisely. When you do not know, say so.`;

export interface RuntimeOptions {
  llm: Llm;
  store: RunStore & Partial<Pick<ThreadStore, 'setRunStatus'>>;
  /** Card 5 replaces this with a typed router; default is deterministic. */
  decide?: Router['decide'];
}

import { baselineDecision } from './router/index';

/** Backwards-compatible deterministic decision used by direct callers. */
export function defaultDecision(messages: AgentUIMessage[]): RouteDecision {
  return baselineDecision(messages);
}

function isErrorChunk(chunk: AgentUIMessageChunk): boolean {
  return (chunk as { type?: string }).type === 'error';
}

export function createAgentRuntime(options: RuntimeOptions): AgentRuntime {
  return {
    stream({
      threadId,
      runId,
      principal,
      messages,
      decision: supplied,
      abortSignal,
    }) {
      const { llm, store } = options;
      const decision =
        supplied ?? (options.decide ? undefined : defaultDecision(messages));
      const stream = createUIMessageStream<AgentUIMessage>({
        originalMessages: messages,
        onError: () => 'agent_error',
        async execute({ writer }) {
          const resolved =
            decision ??
            (await options.decide!({
              principal,
              messages,
              context: { threadId, runId },
            }));
          writer.write({
            type: 'data-route-decision',
            id: resolved.decisionId,
            data: resolved,
          });
          const agent = new ToolLoopAgent({
            model: llm.model(resolved.tier),
            instructions: SYSTEM,
            maxOutputTokens: 1024,
            temperature: 0,
            id: 'agent-core',
          });
          const agentStream = await createAgentUIStream({
            agent,
            uiMessages: messages,
            abortSignal,
          });
          writer.merge(
            agentStream as unknown as ReadableStream<AgentUIMessageChunk>,
          );
        },
        onEnd({ messages: finalMessages }) {
          return store.saveMessages(threadId, principal, finalMessages);
        },
      });

      return new ReadableStream<AgentUIMessageChunk>({
        async start(controller) {
          try {
            let failed = false;
            for await (const chunk of stream) {
              await store.appendChunk(runId, chunk);
              if (isErrorChunk(chunk)) {
                failed = true;
                await store
                  .setRunStatus?.(runId, 'failed')
                  .catch(() => undefined);
              }
              controller.enqueue(chunk);
            }
            if (!failed) {
              await Promise.resolve(
                store.setRunStatus?.(runId, 'completed'),
              ).catch(() => undefined);
            }
            controller.close();
          } catch (error) {
            await store.setRunStatus?.(runId, 'failed').catch(() => undefined);
            await store
              .appendChunk(runId, {
                type: 'data-step',
                id: `step_error_${runId}`,
                data: {
                  stepId: `step_error_${runId}`,
                  status: 'failed',
                  attempt: 1,
                  error: 'stream_failed',
                },
              })
              .catch(() => undefined);
            controller.error(error);
          } finally {
            await store.finishRun(runId).catch(() => undefined);
          }
        },
      });
    },
  };
}
