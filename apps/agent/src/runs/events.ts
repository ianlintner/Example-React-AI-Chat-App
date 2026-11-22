/** Durable event emission for goal runs (injected into HTTP routes). */
import type { Inngest } from 'inngest';

export type RunEvent =
  | {
      name: 'run/start';
      data: {
        runId: string;
        ownerId: string;
        threadId: string;
        goal: string;
        idempotencyKey?: string;
      };
    }
  | {
      name: 'run/decision';
      data: {
        runId: string;
        approvalId: string;
        decision: 'approve' | 'deny';
        ownerId: string;
      };
    };

export type RunEventEmitter = (event: RunEvent) => Promise<unknown>;

/** No-op emitter for local tests that do not exercise the durable function. */
export const noOpRunEvents: RunEventEmitter = async () => undefined;

/** Emits through Inngest so `run/start` actually drives the state machine. */
export function inngestRunEvents(client: Inngest): RunEventEmitter {
  return event => client.send(event);
}
