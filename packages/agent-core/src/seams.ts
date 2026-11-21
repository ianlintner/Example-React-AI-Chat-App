/**
 * Agent seams. Interfaces only in Phase 1 — later cards implement them
 * (see ARCHITECTURE.md "Where new X belongs"). Keep implementations behind
 * these types so apps/agent stays a thin HTTP shell.
 */
import type {
  AgentUIMessage,
  AgentUIMessageChunk,
  RouteDecision,
  Tier,
} from '@agent-chat/contract';
import type { ToolSet } from 'ai';

/** Authenticated or signed-anonymous caller. Tools authorise against this. */
export interface Principal {
  userId: string;
  kind: 'anonymous' | 'user';
  tier: 'anonymous' | 'free' | 'pro';
}

/** Pre-dispatch typed router (card 5). Shadow mode must not alter dispatch. */
export interface Router {
  decide(input: {
    principal: Principal;
    messages: AgentUIMessage[];
  }): Promise<RouteDecision>;
}

/** A skill: progressive-disclosure instructions plus a tool allow-list. */
export interface Skill {
  name: string;
  description: string;
  defaultTier: Tier;
  instructions(): Promise<string>;
  /** Names of tools this skill may call. Model output never extends this. */
  allowedTools: readonly string[];
}

export interface SkillRegistry {
  list(): Skill[];
  get(name: string): Skill | undefined;
}

/** Tool lookup with authorisation at the tool boundary (card 6). */
export interface ToolRegistry {
  toolsFor(skill: Skill, principal: Principal): ToolSet;
}

/** Thread/run persistence + resumable stream buffer (card 4). */
export interface RunStore {
  loadThread(threadId: string, principal: Principal): Promise<AgentUIMessage[]>;
  saveMessages(
    threadId: string,
    principal: Principal,
    messages: AgentUIMessage[],
  ): Promise<void>;
  /** Append a chunk to the run's replay buffer (Redis) for resume. */
  appendChunk(runId: string, chunk: AgentUIMessageChunk): Promise<void>;
  /** Replay from a cursor; used by `GET /chat/:id/stream` after disconnect. */
  replay(
    runId: string,
    fromIndex: number,
  ): AsyncIterable<AgentUIMessageChunk>;
}

/** The agent loop entry point (card 4: AI SDK ToolLoopAgent behind this). */
export interface AgentRuntime {
  stream(input: {
    threadId: string;
    runId: string;
    principal: Principal;
    messages: AgentUIMessage[];
    abortSignal?: AbortSignal;
  }): ReadableStream<AgentUIMessageChunk>;
}
