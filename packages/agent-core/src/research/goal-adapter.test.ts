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
    expect(report!.goal).toBe('deep research');
    expect((await store.getRun('run_research', 'owner_1'))?.status).toBe(
      'completed',
    );
  });

  it("does not reuse another run's report and uses that run's goal", async () => {
    const reports: ResearchReport[] = [];
    const store = new MemoryGoalRunStore(emptyStoreData());
    const engine = new GoalRunEngine(store, {
      planner: createResearchPlanner({ workflow: options }),
      executor: createResearchExecutor({
        workflow: options,
        onReport: report => reports.push(report),
      }),
    });
    await engine.start({
      runId: 'run_one',
      threadId: 'thread_1',
      ownerId: 'owner_1',
      goal: 'first research goal',
    });
    await engine.advance('run_one', 'owner_1');
    await engine.start({
      runId: 'run_two',
      threadId: 'thread_2',
      ownerId: 'owner_2',
      goal: 'second research goal',
    });
    await engine.advance('run_two', 'owner_2');

    const runOne = reports.filter(r => r.goal === 'first research goal');
    const runTwo = reports.filter(r => r.goal === 'second research goal');
    expect(runOne.length).toBeGreaterThan(0);
    expect(runTwo.length).toBeGreaterThan(0);
    // Each run reuses its own cached report throughout all four steps.
    expect(
      new Set(runOne.map(r => r.claims[0]!.citation.citationId)).size,
    ).toBe(1);
    expect(
      new Set(runTwo.map(r => r.claims[0]!.citation.citationId)).size,
    ).toBe(1);
    expect(runOne[0]!.claims[0]!.citation.citationId).not.toBe(
      runTwo[0]!.claims[0]!.citation.citationId,
    );
  });
});
