# 0004: Inngest for durable goal and research runs

Status: Accepted (2026-11-21)

## Context

"Goal-seeking" in 2026 means plans whose steps have executable success predicates. They run with checkpoints, a replan budget, human-approval interrupts and mid-run steering, and they survive worker restarts (PLAN.md §3, cards 7–8). The legacy goal-seeking system is a set of in-memory `Map`s.

## Decision

- Durable runs use **Inngest**, served from `apps/agent` at `/api/inngest` (`inngest/hono`). Locally they run against the Inngest dev server in `compose.dev.yml` (`127.0.0.1:8288`, host networking, no auto-discovery, fixed app URL).
- Each step is an Inngest `step.run` checkpoint. Approvals use `step.waitForEvent`. Steer and cancel are events.
- Step logic lives in `packages/agent-core`. Inngest functions in `apps/agent/src/runs/` are thin orchestration.
- `/api/inngest` mounts only in dev mode (`INNGEST_DEV`) or when `INNGEST_SIGNING_KEY` is set. It never runs unauthenticated outside dev.
- Progress streams to the client as `data-plan` / `data-step` / `data-approval-request` parts (ADR 0002).

## Consequences

- Runs survive agent restarts (card 7's kill-mid-run test).
- The dev server is an extra local container. It is pinned (`inngest/inngest:v1.53.0`).

## Alternatives

- **DBOS.** Postgres-only and fewer moving parts, but a smaller ecosystem and weaker local UI.
- **Temporal.** Heavier to operate for a local showcase.
- **Hand-rolled checkpoints in Postgres.** We would re-implement retries, timers and wait-for-event.
