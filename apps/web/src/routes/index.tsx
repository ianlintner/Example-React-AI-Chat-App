import { LiveChat } from '@/components/live-chat';
import { StatePreview } from '@/components/state-preview';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
  validateSearch: (search: Record<string, unknown>) => ({
    state: typeof search.state === 'string' ? search.state : undefined,
  }),
});

/** `/` is the Instrument Panel shell; `?state=…` selects a fixture state. */
function Home() {
  const { state } = Route.useSearch();
  return state ? <StatePreview initialState={state} /> : <LiveChat />;
}
