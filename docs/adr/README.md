# Architecture Decision Records

Decisions for the new agentic stack (`apps/`, `packages/`). [`ARCHITECTURE.md`](https://github.com/ianlintner/Example-React-AI-Chat-App/blob/main/ARCHITECTURE.md) (repo root) summarises how they fit together. Evidence and the alternatives considered are in PLAN.md §3–§4, `RESEARCH-AGENTIC.md` and `RESEARCH-UI.md`.

| ADR                                       | Decision                                                   | Status   |
| ----------------------------------------- | ---------------------------------------------------------- | -------- |
| [0001](0001-runtime-and-workspaces.md)    | Hono on Node 22, npm workspaces, local-only runtime        | Accepted |
| [0002](0002-stream-contract.md)           | AI SDK UI message stream + typed data parts, frozen 1.0.0  | Accepted |
| [0003](0003-agent-loop-and-models.md)     | AI SDK agent loop behind `agent-core`; route names only    | Accepted |
| [0004](0004-durable-execution-inngest.md) | Inngest for durable goal and research runs                 | Accepted |
| [0005](0005-data-postgres-redis.md)       | Postgres + pgvector for state, Redis for limits and resume | Accepted |
| [0006](0006-typed-router.md)              | Typed pre-dispatch router, shadow first                    | Accepted |
| [0007](0007-mcp-tools-and-security.md)    | MCP tools with authorisation at the tool boundary          | Accepted |
| [0008](0008-ui-stack.md)                  | TanStack Start, shadcn/Base UI, assistant-ui, AI Elements  | Accepted |

## Format

Each ADR has Context, Decision, Consequences and Alternatives. To change an accepted decision, add a new ADR that supersedes it and update the status here. Do not rewrite history.
