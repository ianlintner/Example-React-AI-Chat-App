# 0003: AI SDK agent loop behind `agent-core`; route names, never model ids

Status: Accepted (2026-11-21)

## Context

The legacy app has 16 persona "agents" in one 1,078-line config and pins `gpt-3.5-turbo` in 12 places (AUDIT.md). The 2026 pattern is one tool-using agent loop with skills, sub-agents for context isolation and an approval gate (RESEARCH-AGENTIC.md). Models are served locally by Switchyard, an OpenAI-compatible gateway with named routes.

## Decision

- The agent loop is the **Vercel AI SDK** (`ToolLoopAgent` / `streamText` with tools) wrapped by our `AgentRuntime` seam in `packages/agent-core`. Apps depend on the seam, not the SDK's agent class.
- `packages/agent-core/src/llm.ts` is the **only** place that creates a provider. It uses `@ai-sdk/openai-compatible` against `LLM_BASE_URL` (default `http://localhost:4000/v1`). `llm.model(tier)` resolves a tier (`fast`, `deep`, `research`) to the route name in `ROUTE_FAST`, `ROUTE_DEEP` or `ROUTE_RESEARCH`.
- Code, tests and fixtures never contain a provider model id. Route names are lowercase slugs validated at boot.
- `LLM_PROVIDER=mock` selects a deterministic, network-free mock model that streams token by token. Tests and CI always use it.
- `LLM_API_KEY` is optional and has no default. It is never logged or echoed in errors.

## Consequences

- Swapping models is a gateway configuration change, not a code change. Cards do not edit Switchyard routes.
- Provider-specific features must go through the OpenAI-compatible surface or a new ADR.

## Alternatives

- **Claude Agent SDK harness.** Strong harness, but provider-bound.
- **Mastra / LangGraph.** More framework than this app needs; they would hide the stream contract.
