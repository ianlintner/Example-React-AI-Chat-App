/**
 * In-process store for tests, CI and offline development. With a shared
 * `StoreData` map, recreating the store models a server restart while the
 * durable backing (a database in production) survives.
 */
import type { AgentUIMessage, AgentUIMessageChunk } from '@agent-chat/contract';
import type { Principal } from '../seams';
import type {
  RunInfo,
  RunStatus,
  StoreData,
  ThreadInfo,
  ThreadStore,
} from './types';

export function emptyStoreData(): StoreData {
  return {
    threads: new Map(),
    messages: new Map(),
    runs: new Map(),
    chunks: new Map(),
    finished: new Set(),
  };
}

const now = () => new Date().toISOString();

export class MemoryStore implements ThreadStore {
  constructor(readonly data: StoreData = emptyStoreData()) {}

  private own(resourceOwnerId: string, principal: Principal) {
    if (resourceOwnerId !== principal.userId) throw new Error('forbidden');
  }

  async createThread(
    threadId: string,
    principal: Principal,
    title = 'New thread',
  ) {
    const thread: ThreadInfo = {
      threadId,
      ownerId: principal.userId,
      title,
      createdAt: now(),
      updatedAt: now(),
    };
    this.data.threads.set(threadId, thread);
    this.data.messages.set(threadId, []);
    return thread;
  }

  async getThread(threadId: string, principal: Principal) {
    const thread = this.data.threads.get(threadId);
    if (!thread) return undefined;
    this.own(thread.ownerId, principal);
    return thread;
  }

  async listThreads(principal: Principal) {
    return [...this.data.threads.values()]
      .filter(t => t.ownerId === principal.userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async loadThread(
    threadId: string,
    principal: Principal,
  ): Promise<AgentUIMessage[]> {
    const thread = await this.getThread(threadId, principal);
    if (!thread) return [];
    return structuredClone(this.data.messages.get(threadId) ?? []);
  }

  async saveMessages(
    threadId: string,
    principal: Principal,
    messages: AgentUIMessage[],
  ) {
    const thread = await this.getThread(threadId, principal);
    if (!thread) throw new Error('thread_not_found');
    this.data.messages.set(threadId, structuredClone(messages));
    thread.updatedAt = now();
  }

  async createRun(run: Omit<RunInfo, 'createdAt' | 'updatedAt'>) {
    const record: RunInfo = { ...run, createdAt: now(), updatedAt: now() };
    this.data.runs.set(run.runId, record);
    return record;
  }

  async getRun(runId: string, principal: Principal) {
    const run = this.data.runs.get(runId);
    if (!run) return undefined;
    this.own(run.ownerId, principal);
    return run;
  }

  async setRunStatus(runId: string, status: RunStatus) {
    const run = this.data.runs.get(runId);
    if (!run) return;
    run.status = status;
    run.updatedAt = now();
  }

  async appendChunk(runId: string, chunk: AgentUIMessageChunk) {
    const list = this.data.chunks.get(runId) ?? [];
    list.push(structuredClone(chunk));
    this.data.chunks.set(runId, list);
  }

  async finishRun(runId: string) {
    this.data.finished.add(runId);
  }

  async *replay(
    runId: string,
    fromIndex: number,
  ): AsyncIterable<AgentUIMessageChunk> {
    const list = this.data.chunks.get(runId) ?? [];
    for (let i = Math.max(0, fromIndex); i < list.length; i++) {
      yield structuredClone(list[i]!);
      // Yield to the event loop so a run appending concurrently can progress.
      await Promise.resolve();
    }
    while (!this.data.finished.has(runId)) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async chunkCount(runId: string) {
    return (this.data.chunks.get(runId) ?? []).length;
  }

  async close() {}
}
