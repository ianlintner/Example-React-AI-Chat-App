import { cn } from '@/lib/utils';
import type { PreviewState } from '@/lib/ui-states';

export type RunStatus = PreviewState['status'];

export interface ThreadSummary {
  id: string;
  title: string;
  updated: string;
  status: RunStatus;
  branchOf?: string;
}

const statusLabel: Record<RunStatus, string> = {
  idle: 'idle',
  running: 'running',
  attention: 'needs approval',
  error: 'failed',
  limited: 'rate limited',
};

/** Status-aware thread list. `onSelect` keeps the app in control of routing. */
export function ThreadSidebar({
  threads,
  activeId,
  onSelect,
  onNew,
  onOpenPalette,
}: {
  threads: ThreadSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onOpenPalette: () => void;
}) {
  return (
    <nav aria-label='Threads' className='flex h-full min-h-0 flex-col gap-3'>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='text-xs font-semibold tracking-wide text-fg-muted uppercase'>
          Threads
        </h2>
        <button
          type='button'
          onClick={onNew}
          className='rounded border border-border px-2 py-1 text-xs hover:bg-accent'
        >
          New
        </button>
      </div>
      <button
        type='button'
        onClick={onOpenPalette}
        className='rounded border border-border px-2 py-1.5 text-left text-xs text-fg-muted hover:bg-accent'
        aria-keyshortcuts='Meta+K Control+K'
      >
        Search or jump to… <kbd className='font-mono'>⌘K</kbd>
      </button>
      <ul className='min-h-0 flex-1 space-y-1 overflow-y-auto'>
        {threads.map(thread => (
          <li key={thread.id}>
            <button
              type='button'
              onClick={() => onSelect(thread.id)}
              aria-current={thread.id === activeId ? 'page' : undefined}
              className={cn(
                'w-full rounded border px-2 py-2 text-left text-sm',
                thread.id === activeId
                  ? 'border-signal bg-surface-2'
                  : 'border-transparent hover:bg-surface-2',
              )}
            >
              <span className='block truncate'>{thread.title}</span>
              <span className='flex items-center gap-1.5 font-mono text-[11px] text-fg-muted'>
                <StatusDot status={thread.status} />
                {statusLabel[thread.status]}
                <span aria-hidden>·</span>
                {thread.updated}
                {thread.branchOf ? (
                  <span aria-label='branched thread'>⑂</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function StatusDot({ status }: { status: RunStatus }) {
  const tone: Record<RunStatus, string> = {
    idle: 'bg-fg-muted',
    running: 'bg-signal',
    attention: 'bg-warn',
    error: 'bg-err',
    limited: 'bg-warn',
  };
  return (
    <span
      aria-hidden
      data-testid='run-status'
      data-status={status}
      className={cn('inline-block size-2 rounded-full', tone[status])}
    />
  );
}
