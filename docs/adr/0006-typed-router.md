# 0006: Typed pre-dispatch router, shadow mode first

Status: Accepted (2026-11-21)

## Context

Legacy routing is a greeting regex, a keyword table and one `gpt-3.5-turbo` classify call per message, twice on the forced path (AUDIT.md). Routing decides cost and capability (skill, model tier, research, plan), so it should be measured and reversible.

## Decision

- A `Router` seam in `agent-core` returns `{skill, tier, needsResearch, needsPlan, confidence, margin, source, mode}` (contract part `route-decision`).
- The primary implementation (card 5) is a typed `choice` decision (TypeSafe Jev). When the margin is below a configured threshold, it falls back to an LLM router.
- It ships in **shadow** mode first. Decisions are logged to Postgres with Prometheus metrics and do not change dispatch. A feature flag switches it to **live** once the shadow data supports it.
- Every decision is emitted to the UI as `data-route-decision` ("why this agent/route").

## Consequences

- Routing quality is observable before it affects users, and the switch is reversible.
- Eval cases for routing join the trajectory suite (card 10).

## Alternatives

- **Always-LLM routing.** Simple, but costly and has no calibrated confidence.
- **A learned router.** Needs the shadow data first; listed under "Later".
