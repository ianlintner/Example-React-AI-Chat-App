# Workstream 0 — Adapter Spike Notes

**Outcome: PASS.** `@assistant-ui/react@0.12.25` `ChatModelAdapter` accommodates the existing backend's socket.io event shape without structural changes.

## Evidence (type-level)

Confirmed against the installed `.d.ts` of `@assistant-ui/react@0.12.25` + `@assistant-ui/core@0.1.14`:

- `ChatModelAdapter.run({ messages, abortSignal, runConfig, context, unstable_getMessage })` returns `Promise<ChatModelRunResult> | AsyncGenerator<ChatModelRunResult, void>`.
- `ChatModelRunResult = { content?: readonly ThreadAssistantMessagePart[], status?: MessageStatus, metadata?: { custom?: Record<string, unknown>, ... } }`.
- `TextMessagePart = { type: 'text', text: string }`.
- `useLocalRuntime(chatModel, options?)` is the entry point for mounting the adapter.

## Event mapping (backend → adapter yields)

| Backend event                       | Adapter action                                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stream_start`                      | yield `{ content: [{ type: 'text', text: '' }], status: { type: 'running' } }`                                                                                                         |
| `stream_chunk` (cumulative content) | yield `{ content: [{ type: 'text', text: chunk.content }], status: { type: 'running' } }`                                                                                              |
| `stream_complete`                   | yield `{ content: [{ type: 'text', text: final }], status: { type: 'complete', reason: 'stop' }, metadata: { custom: { agentUsed, confidence, attachments, isProactive, handoff } } }` |
| `stream_error`                      | yield `{ status: { type: 'incomplete', reason: 'error', error } }`                                                                                                                     |
| `handoff_event` (pre-stream)        | store on adapter state; merge into final `metadata.custom.handoff`                                                                                                                     |
| `attachment` (mid-stream)           | accumulate; emit in final `metadata.custom.attachments`                                                                                                                                |
| `AbortSignal`                       | emit `cancel_stream` to backend (no-op until backend handler added — see follow-up 1)                                                                                                  |

Backend emits cumulative `content` on each `stream_chunk` (not deltas), which is compatible — assistant-ui replaces `content[0].text` on each yield.

## Key finding

No mismatches. Proceeding with A1–A4 implementation. Fallback (Option 2: fork Vercel `ai-chatbot`) not needed.

## Backend follow-ups (out of scope for this PR)

1. **`cancel_stream` handler.** `backend/src/socket/socketHandlers.ts:800–1121` has no `socket.on('cancel_stream', ...)`. Adapter emits it on abort; today it is silently ignored. Follow-up: add abort-signal check inside the `for (let i = 0; i < words.length; i++)` loop at lines 1035–1050.
2. **`sync_conversation` on reconnect.** D2 workstream requires a replay-since endpoint; currently not implemented. Fallback at the frontend uses a full REST history refetch on reconnect.
3. **Token-level streaming.** D5 — `socketHandlers.ts:1032–1050` splits by spaces + `setTimeout(30ms)`. Switch to upstream LLM's native token streaming.

## Version matrix (pinned in `web/package.json`)

- `react` `react-dom` — 19.0.0
- `@assistant-ui/react` — 0.12.25
- `socket.io-client` — 4.8.1
- `@tanstack/react-router` — 1.95.1 (declarative, not file-based for A1–A4)
- `@tanstack/react-query` — 5.62.14
- `zustand` — 5.0.2
- `vite` — 5.4.11
- `typescript` — 5.8.3
- `vitest` — 2.1.8 + `@testing-library/react` 16.1.0
- `@typescript-eslint/*` — 8.28.0 (required for TS 5.8 support)

## Deviations from UI_REFACTOR_PLAN.md

- **Tailwind v4 deferred.** `@tailwindcss/vite@4.0.0` threw `Cannot convert undefined or null to object` on our `globals.css` with or without `@theme` tokens; the build loop spent more time than the A1 scaffold should. Plain CSS (with CSS custom properties for the color tokens) is good enough for placeholder pages. Workstream B can add Tailwind v4 + shadcn when the message surface actually needs it — and will benefit from a patch release by then.
- **`@assistant-ui/react-markdown` deferred.** `0.2.14` pins `peer @assistant-ui/react@^0.5.60`, incompatible with `@assistant-ui/react@0.12.25`. Markdown rendering lives in Workstream B anyway; we'll pick the compatible version then.
- **TanStack file-based routing deferred.** `@tanstack/router-vite-plugin` generates `src/routeTree.gen.ts` at build time, but our build ordering (`tsc` → `vite`) makes the first-ever build fail before the plugin runs. Switched to declarative route construction in `src/main.tsx` — same router, fewer moving parts. Revisit if the route count grows past ~5.
- **Vite pinned to 5.4.** vitest 2.1.x pulls its own vite 5 via peer dep; having both vite 5 (vitest's) and vite 6 (ours) produced type conflicts. Downgrading our vite to 5.4 eliminates the dual-install.
