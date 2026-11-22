/** Finding 6: Inngest step results must survive serialization. */
import { describe, expect, it } from 'vitest';
import {
  approvalWaitOptions,
  APPROVAL_TIMEOUT,
  readAdvanceResult,
  resolveDecision,
} from './inngest';

describe('resolveDecision', () => {
  it('uses the event decision when it arrived', () => {
    expect(resolveDecision('deny', 'approved')).toBe('deny');
    expect(resolveDecision('approve', 'denied')).toBe('approve');
  });

  it('falls back to the stored decision after a wait timeout', () => {
    expect(resolveDecision(undefined, 'approved')).toBe('approve');
    expect(resolveDecision(undefined, 'denied')).toBe('deny');
    expect(resolveDecision(undefined, null)).toBe('deny');
  });
});

describe('readAdvanceResult', () => {
  it('recognizes a JSON-round-tripped approval gate without instanceof', () => {
    const gate = {
      outcome: 'approval-required',
      approval: {
        approvalId: 'appr_1',
        toolName: 'dangerous_tool',
        runId: 'run_1',
        risk: 'external',
        summary: 'send request',
        payload: { url: 'https://example.invalid' },
        status: 'pending',
      },
      events: [
        { type: 'approval-request', approval: { approvalId: 'appr_1' } },
      ],
    };
    const serialized = JSON.parse(JSON.stringify(gate));
    const result = readAdvanceResult(serialized);
    expect(result?.outcome).toBe('approval-required');
    if (result?.outcome !== 'approval-required') throw new Error('unreachable');
    expect(result.approval.approvalId).toBe('appr_1');
  });

  it('recognizes terminal and pending outcomes', () => {
    for (const outcome of ['completed', 'stopped', 'pending'] as const) {
      const result = readAdvanceResult(
        JSON.parse(
          JSON.stringify({
            outcome,
            record: { runId: 'run_1' },
            events: [],
            ...(outcome === 'stopped' ? { reason: 'budget' } : {}),
          }),
        ),
      );
      expect(result?.outcome).toBe(outcome);
    }
  });

  it('rejects malformed step results instead of guessing', () => {
    expect(readAdvanceResult(null)).toBeUndefined();
    expect(readAdvanceResult({ outcome: 'approval-required' })).toBeUndefined();
    expect(
      readAdvanceResult({ outcome: 'unknown', events: [] }),
    ).toBeUndefined();
  });
});

describe('approvalWaitOptions', () => {
  it('uses an if expression (not match) so the decision event can be satisfied', () => {
    const opts = approvalWaitOptions('run_1', 'appr_2');
    expect(opts.event).toBe('run/decision');
    expect(opts.timeout).toBe(APPROVAL_TIMEOUT);
    // `match` is a field path in Inngest v4; an expression must go in `if`.
    expect('match' in opts).toBe(false);
    expect(opts.if).toContain('async.data.runId == "run_1"');
    expect(opts.if).toContain('async.data.approvalId == "appr_2"');
  });
});
