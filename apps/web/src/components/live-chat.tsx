import { AppShell } from './shell/app-shell';
import type { ThreadSummary } from './shell/thread-sidebar';
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
} from '@assistant-ui/react';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { DefaultChatTransport } from 'ai';
import { PencilIcon, SplitIcon, SquareIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RouteDecisionChip } from './RouteDecisionChip';

const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? 'http://127.0.0.1:8787';

const liveThread: ThreadSummary = {
  id: 'live',
  title: 'Agent session',
  updated: 'now',
  status: 'idle',
};

/**
 * Real chat: assistant-ui runtime over the contract's `/chat` stream, inside
 * the Instrument Panel shell. Fixture-driven states live in StatePreview.
 */
export function LiveChat() {
  const [threadId, setThreadId] = useState(
    () => `thr_web_${crypto.randomUUID()}`,
  );
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${AGENT_URL}/chat`,
        credentials: 'include',
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { id: id || threadId, messages, trigger: 'submit-message' },
        }),
      }),
    [threadId],
  );
  const runtime = useChatRuntime({
    transport,
    onThreadIdChange: next => setThreadId(next ?? threadId),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <LiveShell threadId={threadId} />
    </AssistantRuntimeProvider>
  );
}

/** Inside the provider so runtime state/actions are available to the shell. */
function LiveShell({ threadId }: { threadId: string }) {
  const aui = useAui();
  const isRunning = useAuiState(s => s.thread.isRunning);
  const thread: ThreadSummary = {
    ...liveThread,
    id: threadId,
    status: isRunning ? 'running' : 'idle',
  };
  const state = useMemo(
    () => ({
      label: isRunning ? 'Running' : 'Ready',
      status: (isRunning ? 'running' : 'idle') as 'running' | 'idle',
      messages: [],
    }),
    [isRunning],
  );

  return (
    <AppShell
      thread={thread}
      threads={[thread]}
      state={state}
      messages={[]}
      onSend={() => {}}
      onStop={() => aui.thread.cancelRun()}
      onSelectThread={id => {
        if (id === 'new') aui.threads.switchToNewThread();
      }}
      onBranch={() => {}}
      onEdit={() => {}}
      composer={<LiveComposer />}
    >
      <ThreadPrimitive.Root className='h-full'>
        <ThreadPrimitive.Viewport className='h-full overflow-y-auto'>
          <ThreadPrimitive.Empty>
            <div className='p-8 text-center text-sm text-fg-muted'>
              Send a message to start the run.
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{
              UserMessage: LiveUser,
              AssistantMessage: LiveAssistant,
            }}
          />
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
      <p data-testid='thread-id' className='sr-only'>
        Thread: {threadId}
      </p>
    </AppShell>
  );
}

function LiveUser() {
  return (
    <MessagePrimitive.Root className='m-3 ml-auto max-w-[85%] rounded-lg border border-border bg-surface-2 p-3 text-sm'>
      <MessagePrimitive.Content />
      <div className='mt-2 flex justify-end gap-1'>
        <ActionBarPrimitive.Root>
          <ActionBarPrimitive.Edit
            aria-label='Edit message'
            className='rounded p-1 text-fg-muted hover:bg-accent hover:text-fg'
          >
            <PencilIcon className='size-3.5' aria-hidden />
          </ActionBarPrimitive.Edit>
        </ActionBarPrimitive.Root>
        <BranchPickerPrimitive.Root>
          <BranchPickerPrimitive.Next
            aria-label='Branch to next version'
            className='rounded p-1 text-fg-muted hover:bg-accent hover:text-fg'
          >
            <SplitIcon className='size-3.5' aria-hidden />
          </BranchPickerPrimitive.Next>
        </BranchPickerPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

function LiveAssistant() {
  return (
    <MessagePrimitive.Root className='m-3 rounded-lg border border-border bg-surface p-3 text-sm'>
      <MessagePrimitive.Parts
        components={{
          data: { by_name: { 'route-decision': RouteDecisionChip } },
        }}
      />
    </MessagePrimitive.Root>
  );
}

function LiveComposer() {
  return (
    <div className='border-t border-border bg-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'>
      {/* Root renders the form assistant-ui uses for Enter-to-submit. */}
      <ComposerPrimitive.Root className='flex items-end gap-2'>
        <ComposerPrimitive.Input
          aria-label='Message'
          placeholder='Ask the agent…'
          rows={2}
          className='min-h-11 flex-1 resize-none rounded border border-border bg-surface p-2 text-sm'
        />
        <ComposerPrimitive.Cancel className='flex min-h-11 items-center gap-1.5 rounded border border-border px-3 text-sm hover:bg-surface-2'>
          <SquareIcon className='size-3.5 fill-current' aria-hidden /> Stop
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send className='min-h-11 rounded bg-signal px-3 text-sm font-medium text-signal-contrast disabled:opacity-40'>
          Send message
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </div>
  );
}
