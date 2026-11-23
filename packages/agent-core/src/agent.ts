/** Production agent loop: AI SDK ToolLoopAgent behind the AgentRuntime seam. */
import type {
  AgentUIMessage,
  AgentUIMessageChunk,
  RouteDecision,
} from '@agent-chat/contract';
import { createAgentUIStream, createUIMessageStream, ToolLoopAgent } from 'ai';
import type { Llm } from './llm';
import type { GenAiSpan } from './obs/genai';
import { baselineDecision, legacyDecision } from './router/index';
import type {
  AgentRuntime,
  Router,
  RunStore,
  SkillRegistry,
  ToolRegistry,
} from './seams';
import { selectSkill } from './skills/select';
import type { ThreadStore } from './store/types';

const SYSTEM = `You are the assistant in the local development agent chat app.
Answer accurately and concisely. When you do not know, say so.`;

export interface RuntimeOptions {
  llm: Llm;
  store: RunStore & Partial<Pick<ThreadStore, 'setRunStatus'>>;
  /** Typed router; when absent the deterministic legacy route is used. */
  decide?: Router['decide'];
  /** Card 6: progressive-disclosure skills and the authorised tool boundary. */
  skills?: SkillRegistry;
  tools?: ToolRegistry;
  /** Card 10: optional GenAI span sink injected by the app layer. */
  telemetry?: (span: GenAiSpan) => void | Promise<void>;
}

/**
 * Backwards-compatible deterministic decision used by direct callers. Keeps
 * the pre-router dispatch exactly: general/fast, deep only for >800 chars.
 */
export function defaultDecision(messages: AgentUIMessage[]): RouteDecision {
  return legacyDecision(messages);
}

/** The keyword baseline, used only for shadow comparison and golden scoring. */
export { baselineDecision };

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
          // Skills are progressive: only the selected skill's body is read.
          // Tool output can never select or widen a skill.
          const skill = options.skills
            ? selectSkill(options.skills, messages)
            : undefined;
          const instructions = skill
            ? `${SYSTEM}\n\n--- Selected skill: ${skill.name} ---\n${await skill.instructions()}`
            : SYSTEM;
          const tools =
            skill && options.tools
              ? options.tools.toolsFor(skill, principal)
              : undefined;
          const agent = new ToolLoopAgent({
            model: llm.model(resolved.tier),
            instructions,
            ...(tools && Object.keys(tools).length > 0 ? { tools } : {}),
            maxOutputTokens: 1024,
            temperature: 0,
            id: 'agent-core',
          });
          const beganAt = Date.now();
          const agentStream = await createAgentUIStream({
            agent,
            uiMessages: messages,
            abortSignal,
          });
          if (options.telemetry) {
            // Best effort: telemetry never breaks the user's stream.
            void Promise.resolve(
              options.telemetry({
                route: resolved.tier,
                operation: 'chat',
                tier: resolved.tier,
                startedAt: beganAt,
                endedAt: Date.now(),
                toolCalls: tools ? Object.keys(tools).length : 0,
                status: 'ok',
              }),
            ).catch(() => undefined);
          }
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
