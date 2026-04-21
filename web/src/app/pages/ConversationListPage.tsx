import { Link } from '@tanstack/react-router';

export function ConversationListPage() {
  const stubs = [
    { id: 'demo-1', label: 'Demo conversation 1' },
    { id: 'demo-2', label: 'Demo conversation 2' },
  ];
  return (
    <div className="page">
      <h1>Conversations</h1>
      <ul className="list">
        {stubs.map((s) => (
          <li key={s.id}>
            <Link to="/c/$conversationId" params={{ conversationId: s.id }}>
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="muted">
        Placeholder list. Real conversation fetching arrives with Workstream D1 (TanStack Query).
      </p>
    </div>
  );
}
