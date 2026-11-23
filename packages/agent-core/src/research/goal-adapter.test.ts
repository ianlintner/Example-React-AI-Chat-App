/** The research workflow runs on the durable goal-run engine end to end. */
import { describe, expect, it } from 'vitest';
import {
  createResearchExecutor,
  createResearchPlanner,
  GoalRunEngine,
  MemoryGoalRunStore,
  type ResearchReport,
  type ResearchWorkflowOptions,
} from '../index';
import { emptyStoreData } from '../store/memory';

const options: Omit<ResearchWorkflowOptions, 'newId' | 'now'> = {
  fetcher: {
    async search() {
      return [{ url: 'https://example.test/source', title: 'Source' }];
    },
    async fetch(url) {
      return {
        sourceId: 'src_1',
        url,
        title: 'Source',
        text: 'A factual claim with supporting detail.',
      };
    },
  },
  model: {
    async plan() {
      return ['factual claim'];
    },
    async summarize({ pages }) {
      return pages.map(p => `[${p.sourceId}] ${p.excerpt}`).join(' ');
    },
    async reflect() {
      return [];
    },
    async report({ sources }) {
      return sources.map(s => ({
        text: `Claim: ${s.title}`,
        sourceId: s.sourceId,
      }));
    },
  },
};

describe('research on the goal-run engine', () => {
  it('drives plan → search → fetch → reflect → report to completion', async () => {
    let report: ResearchReport | undefined;
    const store = new MemoryGoalRunStore(emptyStoreData());
    const adapter = {
      workflow: options,
      onReport: (r: ResearchReport) => {
        report = r;
      },
      newId: (p: string) => `${p}_goal`,
      now: () => '2026-11-23T00:00:00.000Z',
    };
    const engine = new GoalRunEngine(store, {
      planner: createResearchPlanner(adapter),
      executor: createResearchExecutor(adapter),
      newId: (p: string) => `${p}_engine`,
    });
    await engine.start({
      runId: 'run_research',
      threadId: 'thread_1',
      ownerId: 'owner_1',
      goal: 'deep research',
    });
    const result = await engine.advance('run_research', 'owner_1');
    expect(result.outcome).toBe('completed');
    expect(report).toBeDefined();
    expect(report!.claims).toHaveLength(1);
    expect(report!.claims[0]!.citation.sourceId).toBe('src_1');
    expect((await store.getRun('run_research', 'owner_1'))?.status).toBe(
      'completed',
    );
  });
});
