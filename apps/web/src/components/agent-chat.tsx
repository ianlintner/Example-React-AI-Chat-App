import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { DefaultChatTransport } from 'ai';
import { useMemo, useState } from 'react';
import { RouteDecisionChip } from './RouteDecisionChip';

const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? 'http://127.0.0.1:8787';

/** Minimal thread + composer. Full agent shell lands in card 9. */
export function AgentChat() {
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
    <section aria-labelledby='chat-heading' className='space-y-2'>
      <h2 id='chat-heading' className='text-sm font-medium'>
        Agent chat
      </h2>
      <p className='text-xs text-fg-muted' data-testid='thread-id'>
        Thread: {threadId}
      </p>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className='flex h-72 flex-col rounded-lg border border-border p-3'>
          <ThreadPrimitive.Viewport className='flex-1 space-y-2 overflow-y-auto'>
            <ThreadPrimitive.Empty>
              <p className='text-sm text-fg-muted'>
                Send a message to start the thread.
              </p>
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages
              components={{
                UserMessage: UserMessage,
                AssistantMessage: AssistantMessage,
              }}
            />
          </ThreadPrimitive.Viewport>
          <ComposerPrimitive.Root className='mt-2 flex gap-2'>
            <ComposerPrimitive.Input
              aria-label='Message'
              placeholder='Ask the agent…'
              className='flex-1 rounded border border-border bg-transparent p-2 text-sm'
            />
            <ComposerPrimitive.Send
              aria-label='Send message'
              className='rounded bg-accent px-3 py-2 text-sm font-medium'
            >
              Send
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
    </section>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className='rounded bg-muted p-2 text-sm'>
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className='rounded border border-border p-2 text-sm'>
      <MessagePrimitive.Parts
        components={{
          data: { by_name: { 'route-decision': RouteDecisionChip } },
        }}
      />
    </MessagePrimitive.Root>
  );
}
