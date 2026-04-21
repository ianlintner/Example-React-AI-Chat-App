# web/

Web-first chat UI. Built on Vite + React 19 + TypeScript + Tailwind v4 + TanStack Router/Query + `@assistant-ui/react`, talking to the existing backend over socket.io. Intended to replace `frontend/` (Expo/React Native) after reaching parity. See `../UI_REFACTOR_PLAN.md` for the full multi-workstream plan; this package covers Workstream 0 (spike) and Workstream A (A1–A4).

## What's in here

- `src/app/routes/` — TanStack file-based routes: `/` (conversation list stub), `/c/$conversationId` (chat surface).
- `src/chat/runtime/socketClient.ts` — typed wrapper over `socket.io-client` mirroring auth/reconnection semantics of the legacy `frontend/services/socketService.ts`.
- `src/chat/runtime/SocketChatAdapter.ts` — implements `@assistant-ui/react`'s `ChatModelAdapter`, mapping `stream_start` / `stream_chunk` / `stream_complete` / `stream_error` / `handoff_event` / `attachment` into runtime yields.
- `src/chat/components/ChatView.tsx` — `AssistantRuntimeProvider` shell; connects socket on mount, disconnects on unmount, shows a connection banner.
- `src/store/uiStore.ts` — Zustand store for UI state (sidebar, theme, active conversation).

## Running locally

Backend must be reachable (defaults to `http://localhost:5001` via the Vite `/api` proxy).

```bash
cd web
npm install
npm run dev            # http://localhost:5173
```

To point the proxy at a different backend:

```bash
VITE_API_PROXY_TARGET=https://staging.example.com npm run dev
```

## Scripts

| Script               | What it does                            |
| -------------------- | --------------------------------------- |
| `npm run dev`        | Vite dev server on :5173.               |
| `npm run build`      | Typecheck + production build → `dist/`. |
| `npm run typecheck`  | `tsc -b --noEmit`.                      |
| `npm run lint`       | ESLint over `src/`.                     |
| `npm run test`       | Vitest run.                             |
| `npm run test:watch` | Vitest watch mode.                      |

## Scope of this package (what's done)

- **Workstream 0 spike:** adapter-fit against `@assistant-ui/react@0.12.25` validated against the `.d.ts`. See `../SPIKE_NOTES.md` at worktree root for mapping details and backend follow-ups.
- **A1:** scaffold (this directory, Tailwind v4 tokens, TanStack Router, Query, Zustand, ESLint, Vitest).
- **A2:** typed socket client + reconnection + status listener.
- **A3:** `SocketChatAdapter` with optimistic user message, streaming reconciliation, abort → `cancel_stream`, handoff + attachment metadata capture, unit tests.
- **A4:** router shell with two routes and runtime provider bound per-conversation.

## Out of scope here (tracked in `UI_REFACTOR_PLAN.md`)

- **B** Message surface (virtualized list, bubble, markdown streaming, attachments, agent status, handoff chips, typing indicator).
- **C** Composer (TipTap, slash commands, mentions, emoji, shortcuts).
- **D** State/transport/offline (TanStack Query conversations, snapshot reconcile, outbox, connection banner polish, backend token streaming).
- **E** Quality (accessibility pass, theming polish, mobile safe-area, test infra, observability).
- **F** Cutover (dogfood, prod swap, decommission).

## Known runtime notes

- Backend has no `cancel_stream` handler today. Adapter emits it on abort; it's a no-op on the server until the backend follow-up (tracked in `SPIKE_NOTES.md`) lands.
- Backend emits `stream_chunk.content` cumulatively (not deltas). Adapter handles this by replacing the text part on each yield.
- `frontend/` continues to be the default user-facing surface. Cutover happens under Workstream F.
