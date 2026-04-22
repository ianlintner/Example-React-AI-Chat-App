import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginBanner, ModelTierBadge } from '../LoginBanner';
import type { SessionSnapshot } from '../types';

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function mockFetch(snapshot: SessionSnapshot) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => snapshot,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('LoginBanner + ModelTierBadge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows banner + Free badge for anonymous callers', async () => {
    mockFetch({
      tier: 'anonymous',
      authenticated: false,
      user: { id: 'anon_x', name: 'Guest', email: 'x@anon.local' },
      loginUrl: '/oauth2/start',
    });

    renderWithClient(
      <>
        <ModelTierBadge />
        <LoginBanner />
      </>,
    );

    await waitFor(() =>
      expect(screen.getByText(/Sign in/)).toBeInTheDocument(),
    );
    expect(screen.getByText('Free')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute('href', '/oauth2/start');
  });

  it('hides banner and shows Pro badge for authenticated callers', async () => {
    mockFetch({
      tier: 'authenticated',
      authenticated: true,
      user: {
        id: 'u1',
        name: 'Ian',
        email: 'ian@example.com',
        provider: 'oauth2',
      },
      loginUrl: null,
    });

    renderWithClient(
      <>
        <ModelTierBadge />
        <LoginBanner />
      </>,
    );

    await waitFor(() => expect(screen.getByText('Pro')).toBeInTheDocument());
    expect(screen.queryByText(/Sign in/)).not.toBeInTheDocument();
  });
});
