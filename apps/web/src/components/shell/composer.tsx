import { SendIcon, SquareIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, type FormEvent } from 'react';

/**
 * Composer stays live during a run: sending steers, Stop halts with partial
 * output kept. Send and Stop are co-equal controls, never hidden behind a
 * disabled input (RESEARCH-UI §3 pattern 8).
 */
export function Composer({
  running,
  onSend,
  onStop,
  disabledReason,
  editing,
  onCancelEdit,
}: {
  running: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  disabledReason?: string;
  /** Set when a message's Edit action was chosen; rerun branches the thread. */
  editing?: string | null;
  onCancelEdit?: () => void;
}) {
  const [value, setValue] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (!text || disabledReason) return;
    onSend(text);
    setValue('');
  }

  return (
    <form
      onSubmit={submit}
      className='border-t border-border bg-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
    >
      {editing ? (
        <div className='mb-2 flex items-center justify-between text-xs text-fg-muted'>
          <span>Editing message — rerun will branch from here.</span>
          <button type='button' className='underline' onClick={onCancelEdit}>
            Cancel
          </button>
        </div>
      ) : null}
      <div className='flex items-end gap-2'>
        <label htmlFor='composer-input' className='sr-only'>
          Message
        </label>
        <textarea
          id='composer-input'
          rows={2}
          value={value}
          disabled={!!disabledReason}
          onChange={event => setValue(event.target.value)}
          placeholder={running ? 'Steer the agent…' : 'Ask the agent…'}
          aria-describedby={disabledReason ? 'composer-limit' : undefined}
          className='min-h-11 flex-1 resize-none rounded border border-border bg-surface p-2 text-sm placeholder:text-fg-muted'
        />
        {running ? (
          <button
            type='button'
            onClick={onStop}
            className={cn(
              'flex min-h-11 items-center gap-1.5 rounded border border-border',
              'px-3 text-sm hover:bg-surface-2',
            )}
          >
            <SquareIcon className='size-3.5 fill-current' aria-hidden /> Stop
          </button>
        ) : null}
        <button
          type='submit'
          disabled={!value.trim() || !!disabledReason}
          className='flex min-h-11 items-center gap-1.5 rounded bg-signal px-3 text-sm font-medium text-signal-contrast disabled:cursor-not-allowed disabled:opacity-40'
        >
          <SendIcon className='size-3.5' aria-hidden /> Send message
        </button>
      </div>
      {disabledReason ? (
        <p
          id='composer-limit'
          role='status'
          className='pt-1 text-xs text-fg-muted'
        >
          {disabledReason}
        </p>
      ) : null}
    </form>
  );
}
