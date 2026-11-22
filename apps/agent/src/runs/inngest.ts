/**
 * Durable goal-run function for Inngest. Each `step.run` is memoized by
 * Inngest, so a retry never repeats a committed step; the human gate uses
 * `step.waitForEvent` and the engine's own side-effect ledger is the
 * at-most-once guard for consequential tools.
 *
 * The advance step returns a plain discriminated object: errors thrown
 * inside `step.run` come back serialized, so `instanceof` checks are not
 * reliable across the step boundary.
 */
import type { AdvanceResult } from '@agent-chat/agent-core';
import type { ApprovalRequest } from '@agent-chat/contract';
import type { Inngest } from 'inngest';
import type { GoalRunService } from './service';

const APPROVAL_TIMEOUT = '24h';

type StartData = {
  runId: string;
  ownerId: string;
  threadId: string;
  goal: string;
  idempotencyKey?: string;
};
type DecisionData = {
  runId: string;
  approvalId: string;
  decision: 'approve' | 'deny';
  ownerId: string;
};

/** Narrow the serialized `step.run` result without relying on prototypes. */
export function readAdvanceResult(value: unknown): AdvanceResult | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const result = value as Partial<AdvanceResult>;
  if (result.outcome === 'approval-required' && result.approval?.approvalId) {
    return result as AdvanceResult;
  }
  if (
    (result.outcome === 'completed' ||
      result.outcome === 'stopped' ||
      result.outcome === 'pending') &&
    result.events
  ) {
    return result as AdvanceResult;
  }
  return undefined;
}

export { APPROVAL_TIMEOUT };
export type { StartData, DecisionData, ApprovalRequest };

export function createGoalRunFunctions(client: Inngest, runs: GoalRunService) {
  const advanceRun = client.createFunction(
    {
      id: 'goal-run',
      name: 'Goal run',
      triggers: [{ event: 'run/start' }],
    },
    async ({ event, step }) => {
      const data = event.data as StartData;
      const { runId, ownerId } = data;

      // Start is memoized and idempotent (the engine also dedupes on retry).
      await step.run(`start-${runId}`, async () => {
        await runs.start({
          runId,
          ownerId,
          threadId: data.threadId,
          goal: data.goal,
          idempotencyKey: data.idempotencyKey,
        });
      });

      // Drive the state machine in bounded rounds. A round ends when the goal
      // succeeds, a budget stops it, or a human gate is reached.
      for (let round = 0; round < 50; round++) {
        const raw = await step.run(`advance-${runId}-${round}`, async () =>
          runs.engine.advance(runId, ownerId),
        );
        const result = readAdvanceResult(raw);
        if (!result) throw new Error('invalid_advance_result');
        if (result.outcome !== 'approval-required') {
          if (result.outcome === 'completed') return 'completed';
          if (result.outcome === 'stopped') return result.reason;
          return 'pending';
        }

        const approval = result.approval as ApprovalRequest;
        const decision = await step.waitForEvent(
          `approval-${approval.approvalId}`,
          {
            event: 'run/decision',
            timeout: APPROVAL_TIMEOUT,
            match: `data.runId=${runId} && data.approvalId=${approval.approvalId}`,
          },
        );
        const denied =
          !decision || (decision.data as DecisionData).decision === 'deny';
        await step.run(`decision-${approval.approvalId}`, async () => {
          if (denied) {
            await runs.deny(
              runId,
              approval.approvalId,
              { decision: 'deny' },
              ownerId,
            );
          } else {
            await runs.approve(
              runId,
              approval.approvalId,
              { decision: 'approve' },
              ownerId,
            );
          }
        });
        if (denied) return 'canceled';
        // Next iteration resumes from the persisted checkpoint.
      }
      return 'budget_exhausted';
    },
  );

  return [advanceRun];
}
