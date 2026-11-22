import { Composer } from './composer';
import { CommandPalette, type PaletteCommand } from './command-palette';
import { MessageList } from './message-list';
import { MobileSheet } from './mobile-sheet';
import { StatusDot, ThreadSidebar, type ThreadSummary } from './thread-sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import type { PreviewMessage, PreviewState } from '@/lib/ui-states';
import { cn } from '@/lib/utils';
import { MenuIcon, PanelLeftIcon } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

/**
 * Instrument Panel shell: status-aware threads, live composer, branching,
 * ⌘K palette, light/dark parity and mobile bottom sheets. Agent-specific
 * panels are injected by the panels PR through `renderAnnotations`.
 */
export function AppShell({
  thread,
  state,
  messages,
  threads,
  onSend,
  onStop,
  onSelectThread,
  onBranch,
  onEdit,
  renderAnnotations,
  commandExtras = [],
  composer,
  children,
}: {
  thread: ThreadSummary;
  state: PreviewState;
  messages: PreviewMessage[];
  threads: ThreadSummary[];
  onSend: (text: string) => void;
  onStop: () => void;
  onSelectThread: (id: string) => void;
  onBranch: (messageId: string) => void;
  onEdit: (messageId: string, text: string) => void;
  renderAnnotations?: (message: PreviewMessage) => ReactNode;
  commandExtras?: PaletteCommand[];
  /** Optional replacement for the demo composer (used by the live runtime). */
  composer?: ReactNode;
  children?: ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'threads' | 'status' | null>(
    null,
  );
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(open => !open);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const newThread = useCallback(() => {
    onSelectThread('new');
  }, [onSelectThread]);

  const commands: PaletteCommand[] = [
    { id: 'new', label: 'New thread', hint: '⌘N', run: newThread },
    {
      id: 'toggle-sidebar',
      label: 'Toggle thread sidebar',
      run: () => setSidebarOpen(o => !o),
    },
    { id: 'stop', label: 'Stop the current run', run: onStop },
    ...threads.map(t => ({
      id: `thread-${t.id}`,
      label: `Open: ${t.title}`,
      hint: t.id,
      run: () => onSelectThread(t.id),
    })),
    ...commandExtras,
  ];

  const running = state.status === 'running';
  const limited = state.status === 'limited';

  return (
    <div className='flex h-dvh min-h-0 flex-col bg-bg text-fg'>
      <header className='flex items-center gap-3 border-b border-border px-3 py-2'>
        <button
          type='button'
          aria-label='Open threads'
          onClick={() => setMobilePanel('threads')}
          className='min-h-11 min-w-11 rounded border border-border md:hidden'
        >
          <MenuIcon className='mx-auto size-4' aria-hidden />
        </button>
        <button
          type='button'
          aria-label='Toggle sidebar'
          aria-pressed={sidebarOpen}
          onClick={() => setSidebarOpen(o => !o)}
          className='hidden min-h-11 min-w-11 rounded border border-border md:block'
        >
          <PanelLeftIcon className='mx-auto size-4' aria-hidden />
        </button>
        <div className='min-w-0 flex-1'>
          <h1 className='truncate text-sm font-semibold'>{thread.title}</h1>
          <p className='flex items-center gap-1.5 font-mono text-[11px] text-fg-muted'>
            <StatusDot status={state.status} /> {state.label} · {thread.id}
          </p>
        </div>
        <button
          type='button'
          onClick={() => setMobilePanel('status')}
          className='rounded border border-border px-2 py-1.5 text-xs md:hidden'
        >
          Status
        </button>
        <ThemeToggle />
      </header>

      <div className='flex min-h-0 flex-1'>
        <aside
          className={cn(
            'w-64 shrink-0 border-r border-border p-3',
            'hidden md:block',
            sidebarOpen ? '' : 'md:hidden',
          )}
        >
          <ThreadSidebar
            threads={threads}
            activeId={thread.id}
            onSelect={onSelectThread}
            onNew={newThread}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        </aside>

        <main className='flex min-w-0 flex-1 flex-col'>
          {state.banner ? (
            <div
              role='status'
              className={cn(
                'border-b px-4 py-3 text-sm',
                state.banner.tone === 'error'
                  ? 'border-err/40 bg-err/10'
                  : 'border-warn/40 bg-warn/10',
              )}
            >
              <strong className='block font-medium'>
                {state.banner.title}
              </strong>
              <span className='text-fg-muted'>{state.banner.body}</span>
              {state.banner.action ? (
                <button
                  type='button'
                  onClick={() => onSend(state.banner!.action!)}
                  className='ml-3 underline underline-offset-2'
                >
                  {state.banner.action}
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            className='min-h-0 flex-1 overflow-y-auto'
            data-testid='message-viewport'
          >
            {children ?? (
              <MessageList
                messages={messages}
                onBranch={onBranch}
                onEdit={(id, text) => {
                  setEditing(id);
                  onEdit(id, text);
                }}
                renderAnnotations={renderAnnotations}
              />
            )}
          </div>

          {composer ?? (
            <Composer
              running={running}
              onSend={text => {
                setEditing(null);
                onSend(text);
              }}
              onStop={onStop}
              disabledReason={
                limited
                  ? 'Rate limited — the fast route is still available.'
                  : undefined
              }
              editing={editing}
              onCancelEdit={() => setEditing(null)}
            />
          )}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />
      <MobileSheet
        open={mobilePanel === 'threads'}
        onClose={() => setMobilePanel(null)}
        title='Threads'
      >
        <ThreadSidebar
          threads={threads}
          activeId={thread.id}
          onSelect={id => {
            onSelectThread(id);
            setMobilePanel(null);
          }}
          onNew={() => {
            newThread();
            setMobilePanel(null);
          }}
          onOpenPalette={() => {
            setMobilePanel(null);
            setPaletteOpen(true);
          }}
        />
      </MobileSheet>
      <MobileSheet
        open={mobilePanel === 'status'}
        onClose={() => setMobilePanel(null)}
        title='Run status'
      >
        <p className='text-sm'>
          <StatusDot status={state.status} /> {state.label}
        </p>
        <p className='mt-2 text-xs text-fg-muted'>
          {state.banner?.body ?? 'No active limits.'}
        </p>
      </MobileSheet>
    </div>
  );
}
