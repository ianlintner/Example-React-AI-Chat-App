import { useParams } from '@tanstack/react-router';
import { ChatView } from '@/chat/components/ChatView';

export function ChatPage() {
  const { conversationId } = useParams({ from: '/c/$conversationId' });
  return <ChatView conversationId={conversationId} />;
}
