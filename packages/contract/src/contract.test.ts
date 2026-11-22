import { readUIMessageStream, uiMessageChunkSchema } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  CONTRACT_VERSION,
  chatRequestSchema,
  dataPartNames,
  dataPartSchemas,
  mediaAttachmentSchema,
  validateAgentMessages,
  type AgentUIMessage,
} from './index';
import {
  fixtureStream,
  invalidPartFixtures,
  mediaAttachmentsFixture,
  mediaArtifactFixture,
  mcpAppArtifactFixture,
  planRunStream,
  textReplyStream,
  validPartFixtures,
} from './fixtures';

async function lastMessage(
  stream: ReadableStream<never> | ReadableStream<unknown>,
) {
  let last: AgentUIMessage | undefined;
  for await (const m of readUIMessageStream<AgentUIMessage>({
    stream: stream as never,
    terminateOnError: true,
  })) {
    last = m;
  }
  if (!last) throw new Error('stream produced no message');
  return last;
}

describe('data part schemas', () => {
  it('freezes the set of part names', () => {
    expect(dataPartNames).toEqual([
      'route-decision',
      'plan',
      'step',
      'approval-request',
      'citation',
      'artifact',
      'handoff',
    ]);
  });

  it.each(dataPartNames)('%s accepts its valid fixture', name => {
    const res = dataPartSchemas[name].safeParse(validPartFixtures[name]);
    expect(res.success, JSON.stringify(res.error?.issues)).toBe(true);
  });

  it.each(dataPartNames)('%s rejects its invalid fixture', name => {
    expect(
      dataPartSchemas[name].safeParse(invalidPartFixtures[name]).success,
    ).toBe(false);
  });
});

describe('UI message stream fixtures', () => {
  it.each([
    ['text', textReplyStream],
    ['plan run', planRunStream],
  ])('%s chunks are valid AI SDK UI message chunks', async (_, chunks) => {
    const schema = uiMessageChunkSchema();
    for (const chunk of chunks) {
      const res = await schema.validate!(chunk);
      expect(res.success, JSON.stringify(chunk)).toBe(true);
    }
  });

  it('assembles streamed text deltas into one text part', async () => {
    const msg = await lastMessage(fixtureStream(textReplyStream));
    const text = msg.parts.find(p => p.type === 'text');
    expect(text).toMatchObject({ type: 'text', text: 'Hello, operator.' });
    expect(msg.metadata).toMatchObject({
      contractVersion: CONTRACT_VERSION,
      tier: 'fast',
      usage: { inputTokens: 12, outputTokens: 4 },
    });
  });

  it('reconciles data parts by id instead of appending', async () => {
    const msg = await lastMessage(fixtureStream(planRunStream));
    const approvals = msg.parts.filter(p => p.type === 'data-approval-request');
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({ data: { status: 'approved' } });
    const steps = msg.parts.filter(p => p.type === 'data-step');
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ data: { status: 'succeeded' } });
  });

  it('round-trips the assembled message through the contract validator', async () => {
    const msg = await lastMessage(fixtureStream(planRunStream));
    const res = await validateAgentMessages([msg]);
    expect(res.success).toBe(true);
  });
});

describe('media attachments (additive contract change)', () => {
  it('accepts every ported attachment variant', () => {
    expect(mediaAttachmentsFixture).toHaveLength(8);
    for (const attachment of mediaAttachmentsFixture) {
      const res = mediaAttachmentSchema.safeParse(attachment);
      expect(res.success, JSON.stringify(res.error?.issues)).toBe(true);
    }
  });

  it('rejects unsafe URLs and malformed dice notation', () => {
    const base = mediaAttachmentsFixture[0]!;
    expect(
      mediaAttachmentSchema.safeParse({
        ...base,
        thumbnail: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    const dice = mediaAttachmentsFixture.find(a => a.type === 'dice')!;
    expect(
      mediaAttachmentSchema.safeParse({ ...dice, notation: 'drop table' })
        .success,
    ).toBe(false);
  });

  it('validates media and mcp-app artifacts', () => {
    expect(
      dataPartSchemas.artifact.safeParse(mediaArtifactFixture).success,
    ).toBe(true);
    expect(
      dataPartSchemas.artifact.safeParse(mcpAppArtifactFixture).success,
    ).toBe(true);
  });
});

describe('validateAgentMessages', () => {
  const user = {
    id: 'u1',
    role: 'user',
    parts: [{ type: 'text', text: 'hi' }],
  };

  it('accepts a plain user message', async () => {
    const res = await validateAgentMessages([user]);
    expect(res.success, res.success ? '' : String(res.error)).toBe(true);
  });

  it('rejects a malformed data part', async () => {
    const bad = {
      id: 'a1',
      role: 'assistant',
      parts: [{ type: 'data-plan', id: 'p', data: { planId: 'p' } }],
    };
    expect((await validateAgentMessages([bad])).success).toBe(false);
  });

  it('rejects unknown data part names', async () => {
    const bad = {
      id: 'a1',
      role: 'assistant',
      parts: [{ type: 'data-grant-admin', data: { ok: true } }],
    };
    expect((await validateAgentMessages([bad])).success).toBe(false);
  });

  it('shapes POST /chat like the AI SDK DefaultChatTransport body', () => {
    const body = { id: 'thr_001', messages: [user], trigger: 'submit-message' };
    expect(chatRequestSchema.safeParse(body).success).toBe(true);
    expect(
      chatRequestSchema.safeParse({ ...body, trigger: 'drop-tables' }).success,
    ).toBe(false);
  });
});
