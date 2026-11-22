/**
 * Durable goal-run function for Inngest. Each `step.run` is memoized by
 * Inngest, so a retry never repeats a committed step; the human gate uses
 * `step.waitForEvent` and the engine's own side-effect ledger is the
 * at-most-once guard for consequential tools.
 */
import { ApprovalRequiredError } from '@agent-chat/agent-core';
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
};

export function createGoalRunFunctions(client: Inngest, runs: GoalRunService) {
  const advanceRun = client.createFunction(
    {
      id: 'goal-run',
      name: 'Goal run',
      triggers: [{ event: 'run/start' }],
    },
    async ({ event, step }) => {
      const data = event.data as StartData;
      const { runId } = data;

      // Start is memoized and idempotent (the engine also dedupes on retry).
      await step.run(`start-${runId}`, async () => {
        await runs.start({
          runId,
          ownerId: data.ownerId,
          threadId: data.threadId,
          goal: data.goal,
          idempotencyKey: data.idempotencyKey,
        });
      });

      // Drive the state machine in bounded rounds. A round ends when the goal
      // succeeds, a budget stops it, or a human gate is reached.
      for (let round = 0; round < 50; round++) {
        try {
          const emitted = await step.run(
            `advance-${runId}-${round}`,
            async () => runs.advance(runId),
          );
          const last = emitted.at(-1);
          if (last?.type === 'status') return last.status;
        } catch (error) {
          if (!(error instanceof ApprovalRequiredError)) throw error;

          const approval = error.approval;
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
              await runs.deny(runId, approval.approvalId, { decision: 'deny' });
            } else {
              await runs.approve(runId, approval.approvalId, {
                decision: 'approve',
              });
            }
          });
          if (denied) return 'canceled';
          // Next iteration resumes from the persisted checkpoint.
        }
      }
      return 'budget_exhausted';
    },
  );

  return [advanceRun];
}
