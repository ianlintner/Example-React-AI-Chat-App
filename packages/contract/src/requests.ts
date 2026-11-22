/**
 * Client → server request bodies that complete the stream contract.
 * `POST /chat` follows the AI SDK `DefaultChatTransport` body shape so the
 * assistant-ui AI SDK runtime can talk to the agent without a custom adapter.
 */
import { z } from 'zod';

const id = z.string().min(1).max(128);

/** Body of `POST /chat`. `messages` is validated by `validateAgentMessages`. */
export const chatRequestSchema = z.object({
  /** Thread id (AI SDK chat id). */
  id,
  messages: z.array(z.unknown()).min(1).max(500),
  trigger: z.enum(['submit-message', 'regenerate-message']),
  messageId: id.optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Body of `POST /runs/:runId/approvals/:approvalId`. */
export const approvalDecisionSchema = z.object({
  decision: z.enum(['approve', 'deny']),
  reason: z.string().max(500).optional(),
});
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

/** Body of `POST /runs/:runId/steer`: injected into the run's next step. */
export const steerRequestSchema = z.object({
  text: z.string().min(1).max(4000),
});
export type SteerRequest = z.infer<typeof steerRequestSchema>;

/** Body of `GET /healthz` responses. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  contractVersion: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
