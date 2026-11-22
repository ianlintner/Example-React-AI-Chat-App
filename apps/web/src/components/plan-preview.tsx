import type { Plan as PlanData, StepStatus } from '@agent-chat/contract';
import {
  Plan,
  PlanContent,
  PlanDescription,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from '@/components/ai-elements/plan';

const statusLabel: Record<StepStatus, string> = {
  pending: 'pending',
  running: 'running',
  succeeded: 'done',
  failed: 'failed',
  skipped: 'skipped',
  'awaiting-approval': 'needs approval',
};

/** Contract `data-plan` part rendered with the AI Elements Plan component. */
export function PlanPreview({ plan }: { plan: PlanData }) {
  return (
    <Plan defaultOpen>
      <PlanHeader>
        <div>
          <PlanTitle>{plan.goal}</PlanTitle>
          <PlanDescription>{`Revision ${plan.revision} · ${plan.steps.length} steps`}</PlanDescription>
        </div>
        <PlanTrigger />
      </PlanHeader>
      <PlanContent>
        <ol className='space-y-1 text-sm'>
          {plan.steps.map(step => (
            <li key={step.stepId} className='flex justify-between gap-4'>
              <span>{step.title}</span>
              <span className='font-mono text-xs text-fg-muted'>
                {statusLabel[step.status]}
              </span>
            </li>
          ))}
        </ol>
      </PlanContent>
    </Plan>
  );
}
