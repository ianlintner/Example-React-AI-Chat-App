import { useQuery } from '@tanstack/react-query';
import type { SessionSnapshot } from './types';

export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

export async function fetchSession(
  signal?: AbortSignal,
): Promise<SessionSnapshot> {
  const res = await fetch('/api/auth/session', {
    credentials: 'include',
    signal,
  });
  if (!res.ok) {
    throw new Error(`Session fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as SessionSnapshot;
  return data;
}

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: ({ signal }) => fetchSession(signal),
    staleTime: 60_000,
    retry: 1,
  });
}
