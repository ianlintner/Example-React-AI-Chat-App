# 0002: AI SDK UI message stream with typed data parts, frozen at 1.0.0

Status: Accepted (2026-11-21)

## Context

The legacy app fakes streaming by re-emitting a finished reply word by word (`socketHandlers.ts:1095`). Its events are untyped Socket.IO messages keyed on `socket.id`. The new UI needs plans, steps, approvals, citations, artifacts and handoffs on one stream. That stream must be resumable after a disconnect and shared by the web app and the embed.

## Decision

- The wire format is the **AI SDK UI message stream** (SSE, header `x-vercel-ai-ui-message-stream: v1`). `@assistant-ui/react` and AI SDK `useChat` consume it natively.
- `packages/contract` defines `AgentUIMessage = UIMessage<MessageMetadata, AgentDataParts>`. Custom state is carried as `data-<name>` parts validated by Zod: `route-decision`, `plan`, `step`, `approval-request`, `citation`, `artifact`, `handoff`.
- Entity parts are written with chunk `id` equal to the entity id (`planId`, `stepId`, …) so clients reconcile in place.
- Request bodies are defined there too. `POST /chat` uses the `DefaultChatTransport` shape; there are also approval decisions, steer and health.
- Untrusted input is validated with `validateAgentMessages`, which rejects unknown `data-*` parts.
- Deterministic fixtures (`@agent-chat/contract/fixtures`) feed tests, Storybook, MSW and screenshot states.
- **Compatibility.** `CONTRACT_VERSION` is `1.0.0`. Adding an optional field is a minor change. A rename, removal, enum narrowing or new required field is breaking: it needs a superseding ADR, a major version bump and coordinated client updates.

## Consequences

- No custom protocol to maintain; we get AI SDK tooling, tool-call parts and reasoning parts for free.
- Resume (card 4) replays buffered chunks from Redis by cursor. The contract does not change.
- Model ids never appear on the wire. Metadata carries `tier` only.

## Alternatives

- **AG-UI events.** A similar shape, but it would need an adapter for assistant-ui and the AI SDK. We can still add one later at the edge.
- **Custom WebSocket protocol.** This is what the legacy app does. It has no resume semantics and no ecosystem.
