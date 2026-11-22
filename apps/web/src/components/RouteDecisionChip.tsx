import type { RouteDecision } from '@agent-chat/contract';
import type { DataMessagePartProps } from '@assistant-ui/react';

/**
 * "Why this agent" signal. Read-only, never interactive: the stream carries
 * the decision that was actually dispatched (the baseline in shadow mode), so
 * the chip reports the real route and labels the router's mode. Instrument
 * Panel palette: amber signal on graphite.
 */
export function RouteDecisionChip({
  data,
}: DataMessagePartProps<RouteDecision>) {
  const mode = data.mode;
  const label =
    mode === 'shadow' ? `${data.skill} · shadow` : `${data.skill} · live`;
  const tooltip = [
    `tier: ${data.tier}`,
    `research: ${data.needsResearch ? 'yes' : 'no'}`,
    `plan: ${data.needsPlan ? 'yes' : 'no'}`,
    `source: ${data.source}`,
    `confidence: ${data.confidence.toFixed(2)}`,
    `margin: ${data.margin.toFixed(2)}`,
    data.rationale,
  ].join('\n');

  return (
    <span
      data-testid='route-decision'
      data-skill={data.skill}
      data-mode={mode}
      data-source={data.source}
      title={tooltip}
      className='mr-2 inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-fg-muted'
    >
      <span aria-hidden='true' className='text-signal'>
        ◆
      </span>
      <span className='sr-only'>Routed to</span>
      {label}
    </span>
  );
}
