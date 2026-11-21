# 0001: Hono on Node 22, npm workspaces, local-only runtime

Status: Accepted (2026-11-21)

## Context

The legacy app is an Express + Socket.IO server with all state in process memory (AUDIT.md). It has three frontends and about 2,300 LOC of AKS/Flux/Istio infra for one demo. PLAN.md scopes the rewrite to local development, with no hosting. Later hosting (Workers + Durable Objects or similar) must stay cheap to add.

## Decision

- TypeScript end to end. Runtime is **Node 22** (`engines.node >= 22`).
- HTTP server is **Hono** (`apps/agent`) on `@hono/node-server`. Hono runs unchanged on Workers, Bun and Deno, so a later move does not need a rewrite.
- **npm workspaces** with `apps/*` (agent, web) and `packages/*` (contract, agent-core, ui). Packages export TypeScript source, so there is no package build step. Vite and `tsx` compile it.
- Local services run through `compose.dev.yml` (podman or Docker): Postgres + pgvector, Redis and the Inngest dev server. Everything binds to `127.0.0.1`.
- `npm run dev` starts the services and both apps. The legacy apps keep their own installs until card 12.

## Consequences

- One install and one lockfile for the new stack. The legacy `backend/` and `frontend/` locks are untouched.
- Source-exported packages mean consumers need a TS-aware toolchain (Vite, tsx, Vitest), which all of ours are.
- There is no container image or deploy target for the new stack. That is intentional (PLAN.md D2/D3).

## Alternatives

- **Express/Fastify.** These are Node-only and would lock us out of edge runtimes.
- **pnpm/Turborepo.** Better at caching, but adds tooling for five workspaces. We can revisit if build times hurt.
- **Python + Pydantic AI.** This would split the contract across languages (PLAN.md §3).
