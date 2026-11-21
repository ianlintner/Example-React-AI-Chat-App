/// <reference types="vite/client" />
import { THEME_INIT_SCRIPT } from '@agent-chat/ui';
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Agent Chat' },
      { name: 'color-scheme', content: 'dark light' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: Outlet,
  notFoundComponent: () => (
    <main className='p-6 text-fg'>
      <h1 className='text-lg font-semibold'>Not found</h1>
    </main>
  ),
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The theme script sets `class` before paint; suppress the mismatch.
    <html lang='en' className='dark' suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className='min-h-dvh bg-bg font-sans text-fg antialiased'>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
