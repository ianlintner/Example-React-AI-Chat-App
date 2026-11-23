import type { ApprovalRequest } from '@agent-chat/contract';

/** Thrown when a human gate must be awaited before the run can continue. */
export class ApprovalRequiredError extends Error {
  constructor(readonly approval: ApprovalRequest) {
    super('approval_required');
    this.name = 'ApprovalRequiredError';
  }
}

/** Thrown when the run has been canceled or a budget is exhausted. */
export class RunStoppedError extends Error {
  constructor(
    readonly reason: 'canceled' | 'budget' | 'replan-budget' | 'failed',
    message: string,
  ) {
    super(message);
    this.name = 'RunStoppedError';
  }
}
