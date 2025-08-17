# Documentation Consolidation Plan

Purpose

- Execute IA-PROPOSAL.md by merging duplicates, moving files, and removing stale docs.
- Keep PR #1 limited to file moves/renames and scaffolding; content rewrites happen in PR #2.

Scope

- All docs under `docs/`, top-level `README.md`, `SETUP-INSTRUCTIONS.md`, `MIGRATION_COMPLETE.md`, frontend docs, and external example pointers.

Target Directory Skeleton

- docs/index.md
- docs/getting-started/{quickstart.md, setup.md, troubleshooting.md}
- docs/architecture/system-overview.md
- docs/architecture/components/{backend.md, frontend.md, agents.md, message-queue.md, rag-system.md, validation-system.md}
- docs/operations/{observability.md, prometheus-grafana.md, tracing.md, ci-cd.md}
- docs/reference/{api-reference.md, test-bench.md, test-bench-openapi.yaml, code-quality.md, docker-setup.md, 100-percent-sampling-config.md, youtube-embedding.md}
- docs/examples/external-app.md
- docs/assets/\*

Moves, merges, and removals (by source)

Entry points

- docs/INDEX.md + docs/README.md → MERGE → docs/index.md
  - Action: create `docs/index.md` (new), copy content from both, dedupe.
  - Owner: docs
- README.md (root) → KEEP, slim and point to docs/index.md
  - Action: Update later in PR #2.

Architecture and system overview

- docs/system-summary.md + docs/architecture.md → MERGE → docs/architecture/system-overview.md
  - Action: create target, merge content in PR #2.
  - Owner: docs

Components

- docs/backend.md → MOVE → docs/architecture/components/backend.md
  - Owner: backend
- docs/frontend.md → MOVE → docs/architecture/components/frontend.md
  - Owner: frontend
- docs/agents.md + docs/goal-seeking-system.md + docs/hold-agent-system.md + docs/entertainment-agents.md + docs/new-entertainment-agents-summary.md → MERGE → docs/architecture/components/agents.md
  - Additional: merge frontend/AGENT_STATUS_IMPLEMENTATION.md section into “Frontend integration”
  - Owner: backend + frontend
- docs/message-queue-system.md → RENAME/MOVE → docs/architecture/components/message-queue.md
  - Owner: backend
- docs/rag-system.md → RENAME/MOVE → docs/architecture/components/rag-system.md
  - Owner: backend
- docs/validation-system.md → RENAME/MOVE → docs/architecture/components/validation-system.md
  - Owner: backend

Operations

- docs/observability-monitoring.md + docs/docker-observability.md → MERGE → docs/operations/observability.md
  - Owner: devops
- docs/prometheus-grafana-migration.md → MOVE/RETITLE → docs/operations/prometheus-grafana.md
  - Owner: devops
- New: docs/operations/tracing.md (Zipkin/OTel; link otel-collector-config.yaml, sample-zipkin-trace.json)
  - Owner: devops
- docs/ci-cd-setup.md + docs/ci-cd-improvements.md (+ CI parts of docs/testing-and-ci.md) → MERGE → docs/operations/ci-cd.md
  - Owner: devops

Reference

- docs/API.md + docs/api-reference.md → MERGE → docs/reference/api-reference.md
  - Owner: backend
- docs/test-bench-system.md → MOVE/RETITLE → docs/reference/test-bench.md
  - Owner: backend
- docs/test-bench-openapi.yaml → MOVE → docs/reference/test-bench-openapi.yaml
  - Owner: backend
- docs/code-quality-setup.md → MOVE/RETITLE → docs/reference/code-quality.md
  - Owner: docs
- docs/docker-setup.md → Merge basics into docs/getting-started/setup.md; optionally MOVE deep dive → docs/reference/docker-setup.md
  - Owner: devops
- docs/100-percent-sampling-config.md → EVALUATE: integrate into tracing or KEEP → docs/reference/100-percent-sampling-config.md
  - Owner: devops
- docs/youtube-embedding.md → EVALUATE: keep/move to docs/reference/youtube-embedding.md or delete if feature is removed
  - Owner: frontend

Getting started

- SETUP-INSTRUCTIONS.md → MOVE/MERGE → docs/getting-started/setup.md
  - Owner: devops
- New: docs/getting-started/quickstart.md (docker-compose TL;DR)
  - Owner: docs
- New: docs/getting-started/troubleshooting.md
  - Owner: docs

Examples

- New: docs/examples/external-app.md (pointer to external/Example-React-AI-Chat-App/README.md)
  - Owner: docs

Non-doc file inside docs

- docs/React.code-workspace → MOVE OUT of docs/ (e.g., repo root or .vscode/)
  - Owner: maintainers

Frontend docs clean-up

- frontend/README.md → KEEP, minimize; link to docs/index.md
  - Owner: frontend
- frontend/AGENT_STATUS_IMPLEMENTATION.md → MERGE into docs/architecture/components/agents.md (#frontend-integration)
  - Owner: frontend

Historical/cleanup candidates

- MIGRATION_COMPLETE.md → EVALUATE: archive or delete (if only historical)
  - Owner: maintainers
- docs/new-features-overview.md → EVALUATE: integrate into system-overview or changelog; then delete
  - Owner: docs

Planned git operations (for PR #1; content merges in PR #2)

- Directory scaffold (no content yet):
  - mkdir -p docs/getting-started docs/architecture/components docs/operations docs/reference docs/examples
- Pure moves/renames (no content rewrite):
  - git mv docs/backend.md docs/architecture/components/backend.md
  - git mv docs/frontend.md docs/architecture/components/frontend.md
  - git mv docs/message-queue-system.md docs/architecture/components/message-queue.md
  - git mv docs/rag-system.md docs/architecture/components/rag-system.md
  - git mv docs/validation-system.md docs/architecture/components/validation-system.md
  - git mv docs/prometheus-grafana-migration.md docs/operations/prometheus-grafana.md
  - git mv docs/test-bench-system.md docs/reference/test-bench.md
  - git mv docs/test-bench-openapi.yaml docs/reference/test-bench-openapi.yaml
  - git mv docs/code-quality-setup.md docs/reference/code-quality.md
  - (optional) git mv docs/docker-setup.md docs/reference/docker-setup.md
  - (optional) git mv docs/React.code-workspace React.code-workspace

Notes

- docs/INDEX.md, docs/README.md → defer deletion until `docs/index.md` is populated (PR #2).
- API docs and system overview merges → PR #2 (content work).
- frontend/AGENT_STATUS_IMPLEMENTATION.md merge → PR #2 (content work).
- SETUP-INSTRUCTIONS.md move and dedupe with docker-setup basics → PR #2.

Owners

- Backend: api-reference, backend components, test-bench docs.
- Frontend: frontend architecture, Agents frontend integration, user-facing features like YouTube embedding.
- DevOps: operations, observability, tracing, ci-cd, docker.
- Docs: IA, entry points, getting-started, examples, link hygiene.

Risks and mitigations

- Broken links post-move → Run link checker in PR #2 after content updates.
- Out-of-date API content → Align with backend routes and OpenAPI during PR #2.
- Duplicate entry during transition → Keep legacy files until `docs/index.md` is ready, then remove.

PR sequencing

- PR #1 (this plan): create folders, perform git mv for pure moves/renames, add placeholder stubs where necessary.
- PR #2: merge duplicated content, write docs/index.md, update root README, fix links, remove deprecated pages.
- PR #3: API/OpenAPI alignment and any diagrams; add CI/linting for docs.
