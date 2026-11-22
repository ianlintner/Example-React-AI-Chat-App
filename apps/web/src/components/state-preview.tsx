import { AppShell } from '@/components/shell/app-shell';
import type { ThreadSummary } from '@/components/shell/thread-sidebar';
import { MessageList } from '@/components/shell/message-list';
import {
  AI_STATES,
  previewStates,
  type AiState,
  type PreviewMessage,
} from '@/lib/ui-states';
import { useCallback, useMemo, useState } from 'react';

function isAiState(value: string | null | undefined): value is AiState {
  return !!value && (AI_STATES as readonly string[]).includes(value);
}

const baseThreads: ThreadSummary[] = [
  {
    id: 'thr_001',
    title: 'Vector database comparison',
    updated: 'now',
    status: 'running',
  },
  {
    id: 'thr_002',
    title: 'Weekly research digest',
    updated: '2h',
    status: 'attention',
  },
  { id: 'thr_003', title: 'Query draft', updated: 'yesterday', status: 'idle' },
  { id: 'thr_004', title: 'Failed report run', updated: '2d', status: 'error' },
];

/**
 * Fixture-driven shell preview. `?state=<name>` selects one of the eight
 * contract-derived states. No network calls: CI screenshots are deterministic.
 */
export function StatePreview({
  initialState,
}: {
  initialState?: string | null;
}) {
  const initial = isAiState(initialState) ? initialState : 'empty';
  const [stateName, setStateName] = useState<AiState>(initial);
  const [threads, setThreads] = useState(baseThreads);
  const [activeId, setActiveId] = useState('thr_001');
  const [messages, setMessages] = useState(() => [
    ...previewStates[initial].messages,
  ]);
  const [draft, setDraft] = useState<string | null>(null);

  const state = previewStates[stateName];
  const thread = useMemo(
    () => threads.find(t => t.id === activeId) ?? threads[0]!,
    [threads, activeId],
  );

  const selectState = useCallback((name: AiState) => {
    setStateName(name);
    setMessages([...previewStates[name].messages]);
    setDraft(null);
  }, []);

  const onSelectThread = useCallback(
    (id: string) => {
      if (id === 'new') {
        const next = {
          id: `thr_${Date.now().toString(36)}`,
          title: 'New thread',
          updated: 'now',
          status: 'idle' as const,
        };
        setThreads(current => [next, ...current]);
        setActiveId(next.id);
        selectState('empty');
        return;
      }
      setActiveId(id);
    },
    [selectState],
  );

  const onBranch = useCallback(
    (messageId: string) => {
      setThreads(current => {
        const sameSource = current.filter(t => t.branchOf === messageId).length;
        const suffix = sameSource > 0 ? `_${sameSource + 1}` : '';
        const next = {
          id: `thr_branch_${messageId}${suffix}`,
          title: `Branch from ${messageId}${suffix}`,
          updated: 'now',
          status: 'idle' as const,
          branchOf: activeId,
        };
        setActiveId(next.id);
        return [next, ...current];
      });
    },
    [activeId],
  );

  const onEdit = useCallback((messageId: string, text: string) => {
    // Pre-fill the composer with the original text so a rerun can change it.
    setDraft(text);
    if (messageId !== 'new') return;
    // Suggestion chips in the empty state start a fresh message.
    setMessages([{ id: `msg_${Date.now().toString(36)}`, role: 'user', text }]);
  }, []);

  return (
    <AppShell
      thread={thread}
      state={state}
      messages={messages}
      threads={threads}
      draft={draft}
      onSend={text => {
        setMessages(current => [
          ...current,
          {
            id: `msg_${current.length}_${Date.now().toString(36)}`,
            role: 'user',
            text,
          },
        ]);
        setDraft(null);
        setStateName('streaming');
      }}
      onStop={() => selectState('empty')}
      onSelectThread={onSelectThread}
      onBranch={onBranch}
      onEdit={onEdit}
      commandExtras={AI_STATES.map(name => ({
        id: `state-${name}`,
        label: `Preview state: ${previewStates[name].label}`,
        hint: name,
        run: () => selectState(name),
      }))}
    >
      {/* State switcher is a dev-only affordance, not part of the shipped UI. */}
      <div data-testid='state-controls' className='flex flex-wrap gap-1 p-3'>
        {AI_STATES.map(name => (
          <button
            key={name}
            type='button'
            data-state={name}
            aria-pressed={stateName === name}
            onClick={() => selectState(name)}
            className={`rounded border px-2 py-1 font-mono text-[11px] ${
              stateName === name
                ? 'border-signal bg-surface-2'
                : 'border-border'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      {/* Kept swappable so the panels PR can inject agent annotations. */}
      <MessageListForPreview
        messages={messages}
        onBranch={onBranch}
        onEdit={onEdit}
      />
    </AppShell>
  );
}

function MessageListForPreview({
  messages,
  onBranch,
  onEdit,
}: {
  messages: PreviewMessage[];
  onBranch: (messageId: string) => void;
  onEdit: (messageId: string, text: string) => void;
}) {
  return (
    <MessageList messages={messages} onBranch={onBranch} onEdit={onEdit} />
  );
}
