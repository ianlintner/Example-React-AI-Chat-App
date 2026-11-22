# 0005: Postgres + pgvector for state; Redis for limits and stream resume

Status: Accepted (2026-11-21)

## Context

All legacy state lives in process memory keyed on `socket.id`, so it resets on every reconnect. `mongoose` is installed but never imported (AUDIT.md). The new stack needs persistent threads and runs, user facts with a TTL, vector search for research and memory, rate limits, and resumable streams.

## Decision

- **Postgres 17 + pgvector** (`pgvector/pgvector:0.8.1-pg17`) holds threads, messages, runs, steps, approvals, router shadow logs and `user_facts` (with TTL and user-visible delete). Migrations live in `apps/agent/migrations/`. Access goes through the `RunStore` seam.
- **Redis 8** holds tiered rate limits (ported from `backend/src/rateLimit/tierLimits.ts`) and the per-run chunk buffer for stream resume. Redis is ephemeral: persistence is off in dev.
- Locally both bind to loopback-only host ports (`55432`, `56379`). Postgres uses `trust` auth so there is no default password. Any non-local use must set real credentials.

## Consequences

- One relational store with vectors; no separate vector DB.
- Losing Redis loses only in-flight resume buffers and counters, never durable state.

## Alternatives

- **SQLite + sqlite-vec.** Zero containers, but weaker concurrency and it diverges from likely hosting targets.
- **A dedicated vector DB (Qdrant, etc.).** Another service for no measured need.
