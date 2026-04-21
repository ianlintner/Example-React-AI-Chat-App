import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { ConversationListPage } from '@/app/pages/ConversationListPage';
import { ChatPage } from '@/app/pages/ChatPage';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: function RootLayout() {
    return (
      <div className="app-shell">
        <header className="app-shell__header">Cat-Herding Chat</header>
        <main className="app-shell__main">
          <Outlet />
        </main>
      </div>
    );
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ConversationListPage,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/c/$conversationId',
  component: ChatPage,
});

const routeTree = rootRoute.addChildren([indexRoute, chatRoute]);

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: { queryClient },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
