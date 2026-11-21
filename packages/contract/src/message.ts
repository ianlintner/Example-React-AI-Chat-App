/**
 * The agent UI message: an AI SDK `UIMessage` specialised with our metadata
 * and data parts. The wire format is the AI SDK UI message stream (SSE with
 * `x-vercel-ai-ui-message-stream: v1`); we add nothing outside it.
 */
import {
  safeValidateUIMessages,
  type InferUIMessageChunk,
  type UIMessage,
} from 'ai';
import { z } from 'zod';
import { dataPartSchemas, tierSchema, type AgentDataParts } from './data-parts';

export const CONTRACT_VERSION = '1.0.0' as const;

/** Per-message metadata, sent on `start`/`finish`/`message-metadata` chunks. */
export const messageMetadataSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION).optional(),
  threadId: z.string().min(1).max(128).optional(),
  runId: z.string().min(1).max(128).optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  /** Tier used for this message. Never a provider model id. */
  tier: tierSchema.optional(),
  usage: z
    .object({
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0),
    })
    .optional(),
});
export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type AgentUIMessage = UIMessage<MessageMetadata, AgentDataParts>;
export type AgentUIMessageChunk = InferUIMessageChunk<AgentUIMessage>;
export type AgentUIMessagePart = AgentUIMessage['parts'][number];

/**
 * Validate untrusted messages (e.g. a POST /chat body) against the contract.
 * Unknown `data-*` part names are rejected by the AI SDK validator.
 */
export async function validateAgentMessages(messages: unknown) {
  return safeValidateUIMessages<AgentUIMessage>({
    messages,
    // Metadata is optional on a message (user turns carry none).
    metadataSchema: messageMetadataSchema.optional(),
    dataSchemas: dataPartSchemas,
  });
}
