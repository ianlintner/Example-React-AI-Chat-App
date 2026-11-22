import type { PreviewMessage } from '@/lib/ui-states';
import { cn } from '@/lib/utils';
import { PencilIcon, SplitIcon } from 'lucide-react';

/**
 * Message list for the shell. Renders chat text and delegates agent-specific
 * annotations to `renderAnnotations` (supplied by the panels PR).
 */
export function MessageList({
  messages,
  onBranch,
  onEdit,
  renderAnnotations,
}: {
  messages: PreviewMessage[];
  onBranch?: (messageId: string) => void;
  onEdit?: (messageId: string, text: string) => void;
  renderAnnotations?: (message: PreviewMessage) => React.ReactNode;
}) {
  if (messages.length === 0) {
    return (
      <div className='flex h-full items-center justify-center p-8 text-center'>
        <div className='max-w-md space-y-2'>
          <h3 className='font-medium'>What should the agent work on?</h3>
          <p className='text-sm text-fg-muted'>
            Start with a task. The run will show its plan, tools and sources as
            it works.
          </p>
          <ul className='flex flex-wrap justify-center gap-2 pt-2 text-xs'>
            {[
              'Compare local vector databases',
              'Summarize a report',
              'Draft a query',
            ].map(suggestion => (
              <li key={suggestion}>
                <button
                  type='button'
                  className='rounded-full border border-border px-3 py-1.5 hover:bg-surface-2'
                  onClick={() => onEdit?.('new', suggestion)}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <ol aria-label='Messages' className='space-y-4 p-4'>
      {messages.map(message => (
        <li
          key={message.id}
          className={cn(
            'rounded-lg border p-3',
            message.role === 'user'
              ? 'ml-auto max-w-[85%] border-border bg-surface-2'
              : 'border-border bg-surface',
          )}
        >
          <div className='flex items-center justify-between gap-2 pb-1'>
            <span className='font-mono text-[11px] tracking-wide text-fg-muted uppercase'>
              {message.role === 'user' ? 'You' : 'Agent'}
            </span>
            {message.role === 'user' ? (
              <span className='flex gap-1'>
                <button
                  type='button'
                  aria-label={`Edit message ${message.id}`}
                  title='Edit and rerun'
                  className='rounded p-1 text-fg-muted hover:bg-accent hover:text-fg'
                  onClick={() => onEdit?.(message.id, message.text)}
                >
                  <PencilIcon className='size-3.5' aria-hidden />
                </button>
                <button
                  type='button'
                  aria-label={`Branch from message ${message.id}`}
                  title='Branch thread'
                  className='rounded p-1 text-fg-muted hover:bg-accent hover:text-fg'
                  onClick={() => onBranch?.(message.id)}
                >
                  <SplitIcon className='size-3.5' aria-hidden />
                </button>
              </span>
            ) : null}
          </div>
          <p className='whitespace-pre-wrap text-sm'>{message.text}</p>
          {message.annotations ? renderAnnotations?.(message) : null}
        </li>
      ))}
    </ol>
  );
}
