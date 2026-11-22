import { useEffect, useId, useRef, useState } from 'react';
import { useFocusTrap } from './use-focus-trap';

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** Minimal accessible ⌘K palette: dialog semantics, filter, keyboard nav. */
export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const titleId = useId();
  const inputId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const matches = commands.filter(command =>
    `${command.label} ${command.hint ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div className='fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh]'>
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className='w-full max-w-lg rounded-lg border border-border bg-surface p-3 shadow-xl'
      >
        <h2 id={titleId} className='sr-only'>
          Command palette
        </h2>
        <label htmlFor={inputId} className='sr-only'>
          Search commands
        </label>
        <input
          id={inputId}
          autoFocus
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive(i => Math.min(i + 1, matches.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive(i => Math.max(i - 1, 0));
            } else if (event.key === 'Enter' && matches[active]) {
              event.preventDefault();
              matches[active]!.run();
              onClose();
            }
          }}
          placeholder='Search commands…'
          className='w-full rounded border border-border bg-bg p-2 text-sm'
        />
        <ul
          role='listbox'
          aria-label='Commands'
          className='mt-2 max-h-72 overflow-y-auto'
        >
          {matches.map((command, index) => (
            <li key={command.id} role='option' aria-selected={index === active}>
              <button
                type='button'
                onMouseEnter={() => setActive(index)}
                onClick={() => {
                  command.run();
                  onClose();
                }}
                className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm ${
                  index === active ? 'bg-surface-2' : ''
                }`}
              >
                <span>{command.label}</span>
                {command.hint ? (
                  <span className='font-mono text-[11px] text-fg-muted'>
                    {command.hint}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className='px-2 py-3 text-sm text-fg-muted'>
              No matching commands.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
