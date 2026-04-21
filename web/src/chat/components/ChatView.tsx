import { useEffect, useMemo, useState } from 'react';
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { SocketChatAdapter } from '@/chat/runtime/SocketChatAdapter';
import { getSocketClient } from '@/chat/runtime/socketClient';
import type { ConnectionStatus } from '@/chat/runtime/types';

interface ChatViewProps {
  conversationId: string;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const client = useMemo(() => getSocketClient(), []);
  const adapter = useMemo(
    () => new SocketChatAdapter({ conversationId, client }),
    [conversationId, client],
  );
  const runtime = useLocalRuntime(adapter);
  const [status, setStatus] = useState<ConnectionStatus>(client.status);

  useEffect(() => {
    client.connect();
    client.emit('join_conversation', conversationId);
    const unsub = client.onStatus(setStatus);
    return () => {
      client.emit('leave_conversation', conversationId);
      unsub();
    };
  }, [client, conversationId]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className='chat'>
        <ConnectionBanner status={status} />
        <div className='chat__body'>
          <p className='muted'>
            Chat UI primitives (Thread, MessageList, Composer) land with
            Workstreams B &amp; C. Runtime is wired — open devtools to see
            socket events flowing for conversation <code>{conversationId}</code>
            .
          </p>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}

function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status === 'connected' || status === 'idle') return null;
  const label =
    status === 'connecting'
      ? 'Connecting…'
      : status === 'reconnecting'
        ? 'Reconnecting…'
        : 'Offline — messages will send when you are back.';
  return <div className='banner'>{label}</div>;
}
