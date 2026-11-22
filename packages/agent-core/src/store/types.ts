/** Thread/run metadata alongside the existing RunStore seam. */
import type {
  AgentUIMessage,
  AgentUIMessageChunk,
  Tier,
} from '@agent-chat/contract';
import type { Principal, RunStore } from '../seams';

export interface ThreadInfo {
  threadId: string;
  ownerId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type RunStatus = 'running' | 'completed' | 'failed' | 'aborted';

export interface RunInfo {
  runId: string;
  threadId: string;
  ownerId: string;
  status: RunStatus;
  tier: Tier;
  createdAt: string;
  updatedAt: string;
}

/**
 * Persistence used by the HTTP shell. `RunStore` remains unchanged; this
 * adds the thread/run metadata the /threads endpoints and resume need.
 */
export interface ThreadStore extends RunStore {
  createThread(threadId: string, principal: Principal, title?: string): Promise<ThreadInfo>;
  getThread(threadId: string, principal: Principal): Promise<ThreadInfo | undefined>;
  listThreads(principal: Principal): Promise<ThreadInfo[]>;
  createRun(run: Omit<RunInfo, 'createdAt' | 'updatedAt'>): Promise<RunInfo>;
  getRun(runId: string, principal: Principal): Promise<RunInfo | undefined>;
  setRunStatus(runId: string, status: RunStatus): Promise<void>;
  /** Peek at the replay buffer length, used by resume tests. */
  chunkCount(runId: string): Promise<number>;
  close(): Promise<void>;
}

export interface StoreData {
  threads: Map<string, ThreadInfo>;
  messages: Map<string, AgentUIMessage[]>;
  runs: Map<string, RunInfo>;
  chunks: Map<string, AgentUIMessageChunk[]>;
  finished: Set<string>;
}
