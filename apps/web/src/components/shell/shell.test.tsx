import { AI_STATES, previewStates } from '@/lib/ui-states';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';
import { Composer } from './composer';
import { CommandPalette } from './command-palette';
import { MessageList } from './message-list';
import { ThreadSidebar } from './thread-sidebar';

afterEach(cleanup);

const threads = [
  { id: 'thr_1', title: 'Run one', updated: 'now', status: 'running' as const },
  {
    id: 'thr_2',
    title: 'Run two',
    updated: '2h',
    status: 'attention' as const,
  },
];
const shellArgs = {
  thread: threads[0]!,
  threads,
  state: previewStates.empty,
  messages: [],
  onSend: vi.fn(),
  onStop: vi.fn(),
  onSelectThread: vi.fn(),
  onBranch: vi.fn(),
  onEdit: vi.fn(),
};

describe('shell panels', () => {
  it('marks the active thread and reports run status', () => {
    render(
      <ThreadSidebar
        threads={threads}
        activeId='thr_1'
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onOpenPalette={vi.fn()}
      />,
    );
    expect(
      screen
        .getByRole('button', { name: /Run one/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.getAllByTestId('run-status')).toHaveLength(2);
  });

  it('sends a trimmed message and clears the composer', () => {
    const onSend = vi.fn();
    render(<Composer running={false} onSend={onSend} onStop={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(input, { target: { value: '  hello  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(onSend).toHaveBeenCalledWith('hello');
    expect((input as HTMLTextAreaElement).value).toBe('');
  });

  it('shows Stop during a run and disables sending when limited', () => {
    const { rerender } = render(
      <Composer running onSend={vi.fn()} onStop={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /stop/i })).toBeTruthy();
    rerender(
      <Composer
        running={false}
        onSend={vi.fn()}
        onStop={vi.fn()}
        disabledReason='limited'
      />,
    );
    expect(
      (screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
  });

  it('offers branching and editing on user messages', () => {
    const onBranch = vi.fn();
    const onEdit = vi.fn();
    render(
      <MessageList
        messages={[{ id: 'm1', role: 'user', text: 'hi' }]}
        onBranch={onBranch}
        onEdit={onEdit}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /branch from message m1/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /edit message m1/i }));
    expect(onBranch).toHaveBeenCalledWith('m1');
    expect(onEdit).toHaveBeenCalledWith('m1', 'hi');
  });

  it('filters commands from the keyboard palette', () => {
    render(
      <CommandPalette
        open
        onClose={vi.fn()}
        commands={[
          { id: 'new', label: 'New thread', run: vi.fn() },
          { id: 'canvas', label: 'Toggle canvas', run: vi.fn() },
        ]}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Search commands' });
    fireEvent.change(input, { target: { value: 'canvas' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByText('Toggle canvas')).toBeTruthy();
  });

  it('opens a mobile sheet with dialog semantics', () => {
    render(<AppShell {...shellArgs} messages={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open threads' }));
    expect(screen.getByRole('dialog', { name: 'Threads' })).toBeTruthy();
  });

  it('defines all eight contract-derived AI states', () => {
    expect(AI_STATES).toHaveLength(8);
    for (const name of AI_STATES) {
      expect(previewStates[name].label).toBeTruthy();
    }
  });
});
