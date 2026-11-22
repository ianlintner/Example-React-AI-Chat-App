# 0007: MCP tools with authorisation at the tool boundary

Status: Accepted (2026-11-21)

## Context

Legacy "deferral" between personas is prose in prompts. OWASP LLM 2026 ranks excessive agency #3, and MCP tool poisoning is a live risk (RESEARCH-AGENTIC.md). The legacy app also hard-coded a JWT fallback secret, which card 1 removed.

## Decision

- Tools come in through an **MCP client** (stateless 2026-07-28 revision) plus local tools (youtube/gif/music/dice, card 6), all behind the `ToolRegistry` seam.
- Each `Skill` declares `allowedTools`. `ToolRegistry.toolsFor(skill, principal)` returns only allowed and authorised tools. Model output never extends permissions.
- Authorisation happens at the tool boundary against the caller's `Principal` (signed anonymous or user identity).
- Tools with `write`, `external` or `spend` risk emit `data-approval-request` with the real (secret-masked) payload and block until a human decides.
- MCP Apps UI renders only `ui://` resources in a sandboxed iframe (`artifact.kind = 'mcp-app'`) under a strict CSP.
- No default secrets anywhere. Configuration fails closed, and errors never echo secret values.

## Consequences

- Prompt injection can at worst propose an action; it cannot authorise one.
- Approval UX is a first-class UI state (card 9).

## Alternatives

- **Prompt-level tool restrictions only.** Not a security boundary.
- **A2A / multi-agent crews.** Mostly hype for a single app (RESEARCH-AGENTIC.md §7).
