# 0008: TanStack Start, shadcn/ui on Base UI, assistant-ui and AI Elements

Status: Accepted (2026-11-21)

## Context

There are three legacy frontends: Expo RN, a Vite + assistant-ui app and an embed widget. The agent UI needs desktop-class panels (plan checklist, tool timeline, approval cards, artifacts canvas, citations) that RN cannot host without forks. RESEARCH-UI.md scores TanStack Start 4.55, Next 16 4.05 and Expo 2.55.

## Decision

- **TanStack Start + React 19** (`apps/web`) with file-based routes; `routeTree.gen.ts` is committed. SSR is verified by running e2e against `vite preview`.
- **Tailwind v4** with tokens from `packages/ui`, and **shadcn/ui on Base UI** (`components.json`, style `base-*`).
- **`@assistant-ui/react`** is the chat runtime, connected to `/chat` via its AI SDK adapter (card 4).
- **shadcn AI Elements** are copied in through the registry (`@ai-elements`) for Plan, Queue, Confirmation, Sources, Inline Citation, Checkpoint and Shimmer. More are added as cards need them. Vendored copies get only type fixes.
- **Instrument Panel** visual direction (RESEARCH-UI.md §4): graphite `#0B0D0F`, amber `#F5A524`, self-hosted Inter Variable + JetBrains Mono, light/dark via a `.dark` class set before paint, and reduced-motion collapse. Light accent `#9A5B00` meets WCAG AA contrast.
- **Quality gate:** Storybook 10 with the a11y addon, Vitest + Testing Library, Playwright with `@axe-core/playwright` (WCAG 2.2 AA tags), and `toHaveScreenshot` for the 8 AI states (card 9).

## Consequences

- Expo/RN is dropped at card 12. A Capacitor or Tauri shell can come later if a store listing is ever needed.
- The embed (card 11) reuses the contract and tokens as a Shadow DOM web component.

## Alternatives

- **Next 16.** Heavier server coupling.
- **React Router 7 / SvelteKit.** Lower scores and a weaker assistant-ui fit.
- **Radix-based shadcn.** Base UI is the current shadcn default and is actively maintained.
