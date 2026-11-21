/**
 * Canonical UI message stream chunk sequences. Replay them with
 * `fixtureStream()` in tests, MSW handlers and Storybook.
 */
import type { AgentUIMessageChunk } from '../message';
import { CONTRACT_VERSION } from '../message';
import {
  FIXED_TIME,
  approvalRequestFixture,
  artifactFixture,
  citationFixture,
  handoffFixture,
  planFixture,
  routeDecisionFixture,
  stepFixture,
} from './parts';

/** Plain streamed text reply. */
export const textReplyStream: AgentUIMessageChunk[] = [
  {
    type: 'start',
    messageId: 'msg_text_001',
    messageMetadata: {
      contractVersion: CONTRACT_VERSION,
      threadId: 'thr_001',
      runId: 'run_text_001',
      createdAt: FIXED_TIME,
      tier: 'fast',
    },
  },
  { type: 'start-step' },
  { type: 'text-start', id: 'txt_1' },
  { type: 'text-delta', id: 'txt_1', delta: 'Hello' },
  { type: 'text-delta', id: 'txt_1', delta: ', operator.' },
  { type: 'text-end', id: 'txt_1' },
  { type: 'finish-step' },
  {
    type: 'finish',
    finishReason: 'stop',
    messageMetadata: { usage: { inputTokens: 12, outputTokens: 4 } },
  },
];

/** A planned research run that pauses for approval and emits a report. */
export const planRunStream: AgentUIMessageChunk[] = [
  {
    type: 'start',
    messageId: 'msg_plan_001',
    messageMetadata: {
      contractVersion: CONTRACT_VERSION,
      threadId: 'thr_001',
      runId: 'run_001',
      createdAt: FIXED_TIME,
      tier: 'research',
    },
  },
  {
    type: 'data-route-decision',
    id: routeDecisionFixture.decisionId,
    data: routeDecisionFixture,
  },
  { type: 'data-handoff', id: handoffFixture.handoffId, data: handoffFixture },
  { type: 'data-plan', id: planFixture.planId, data: planFixture },
  { type: 'data-step', id: stepFixture.stepId, data: stepFixture },
  { type: 'start-step' },
  { type: 'text-start', id: 'txt_1' },
  { type: 'text-delta', id: 'txt_1', delta: 'Reading benchmark ' },
  { type: 'text-delta', id: 'txt_1', delta: 'sources.' },
  { type: 'text-end', id: 'txt_1' },
  {
    type: 'data-approval-request',
    id: approvalRequestFixture.approvalId,
    data: approvalRequestFixture,
  },
  {
    type: 'data-approval-request',
    id: approvalRequestFixture.approvalId,
    data: { ...approvalRequestFixture, status: 'approved' },
  },
  {
    type: 'data-step',
    id: stepFixture.stepId,
    data: {
      ...stepFixture,
      status: 'succeeded',
      endedAt: '2026-11-21T12:01:00.000Z',
      predicatePassed: true,
    },
  },
  {
    type: 'data-citation',
    id: citationFixture.citationId,
    data: citationFixture,
  },
  {
    type: 'data-artifact',
    id: artifactFixture.artifactId,
    data: artifactFixture,
  },
  { type: 'finish-step' },
  { type: 'finish', finishReason: 'stop' },
];

/** Replay a chunk array as a ReadableStream (optionally paced). */
export function fixtureStream(
  chunks: readonly AgentUIMessageChunk[],
  delayMs = 0,
): ReadableStream<AgentUIMessageChunk> {
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      controller.enqueue(chunks[i++]!);
    },
  });
}
