Title: Documentation Information Architecture (IA) Proposal

Objectives

- Single canonical entry point for all docs.
- Eliminate duplication and outdated pages.
- Organize content by lifecycle: Getting Started, Architecture, Operations, Reference, Examples.
- Make maintenance straightforward with clear ownership and conventions.

Pain points observed

- Multiple entry points (docs/INDEX.md and docs/README.md) and a long root README.
- Duplicate/overlapping topics (API docs, CI/CD docs, observability).
- Several "new-\*" and "overview" pages that look like transitional content.
- VS Code workspace file inside docs (not user-facing).
- External example app docs not clearly surfaced from main docs.

Target structure (canonical entry = docs/index.md)

- docs/index.md (Merge of docs/INDEX.md and docs/README.md)
  - Purpose: Welcome, table of contents, audiences, pointers to key workflows.

- docs/getting-started/
  - quickstart.md (TL;DR, run via docker-compose)
  - setup.md (Merge SETUP-INSTRUCTIONS.md + docker basics from docs/docker-setup.md)
  - troubleshooting.md (Ports, env vars, common errors)

- docs/architecture/
  - system-overview.md (Merge docs/system-summary.md + docs/architecture.md)
  - components/
    - backend.md (Move from docs/backend.md; link to key modules and routes)
    - frontend.md (Move from docs/frontend.md; add component map)
    - agents.md (Merge docs/agents.md, goal-seeking-system.md, hold-agent-system.md, entertainment-agents.md, new-entertainment-agents-summary.md; add “Frontend integration” section that absorbs frontend/AGENT_STATUS_IMPLEMENTATION.md)
    - message-queue.md (Move/rename from docs/message-queue-system.md)
    - rag-system.md (Move/rename from docs/rag-system.md)
    - validation-system.md (Move/rename from docs/validation-system.md)
  - diagrams/ (optional if we add Mermaid/PlantUML exports)

- docs/operations/
  - observability.md (Merge docs/observability-monitoring.md + docker-observability pieces)
  - prometheus-grafana.md (Merge docs/prometheus-grafana-migration.md; link grafana/dashboards JSON)
  - tracing.md (Zipkin/OTel; link otel-collector-config.yaml and sample traces)
  - ci-cd.md (Merge docs/ci-cd-setup.md + docs/ci-cd-improvements.md + CI parts of docs/testing-and-ci.md)

- docs/reference/
  - api-reference.md (Merge docs/API.md + docs/api-reference.md; ensure alignment with code and docs/test-bench-openapi.yaml)
  - test-bench.md (Move/rename from docs/test-bench-system.md; link docs/test-bench-openapi.yaml)
  - code-quality.md (Keep docs/code-quality-setup.md)
  - docker-setup.md (If not fully merged into getting-started/setup.md, keep as a deep dive here)
  - 100-percent-sampling-config.md (Integrate into tracing/observability or keep as reference if still needed)
  - youtube-embedding.md (Keep only if feature is active; otherwise deprecate)

- docs/examples/
  - external-app.md (Curated pointer to external/Example-React-AI-Chat-App with brief usage; keep full example in external/)

- assets
  - docs/assets/\* (Keep images and diagrams; update references after moves)

Root README slimming

- Keep concise: 1-2 paragraphs overview, architecture diagram image, badges, minimal quickstart, and a “Read full docs” link to docs/index.md.

Mapping from current files to target

- docs/INDEX.md + docs/README.md → docs/index.md
- docs/API.md + docs/api-reference.md → docs/reference/api-reference.md
- docs/system-summary.md + docs/architecture.md → docs/architecture/system-overview.md
- docs/backend.md → docs/architecture/components/backend.md
- docs/frontend.md → docs/architecture/components/frontend.md
- docs/agents.md + docs/goal-seeking-system.md + docs/hold-agent-system.md + docs/entertainment-agents.md + docs/new-entertainment-agents-summary.md → docs/architecture/components/agents.md (sections)
- docs/message-queue-system.md → docs/architecture/components/message-queue.md
- docs/rag-system.md → docs/architecture/components/rag-system.md
- docs/validation-system.md → docs/architecture/components/validation-system.md
- docs/ci-cd-setup.md + docs/ci-cd-improvements.md (+ CI parts of docs/testing-and-ci.md) → docs/operations/ci-cd.md
- docs/observability-monitoring.md + docs/docker-observability.md → docs/operations/observability.md
- docs/prometheus-grafana-migration.md → docs/operations/prometheus-grafana.md
- docs/testing-and-ci.md → Merge CI parts into docs/operations/ci-cd.md; leave testing strategy portions in reference or add a dedicated testing.md if warranted
- docs/docker-setup.md → Merge basics into docs/getting-started/setup.md; optionally keep deep dive under docs/reference/docker-setup.md
- docs/100-percent-sampling-config.md → Integrate into docs/operations/tracing.md or keep under docs/reference/
- docs/test-bench-system.md → docs/reference/test-bench.md
- docs/test-bench-openapi.yaml → docs/reference/test-bench-openapi.yaml (move into reference subdir)
- docs/youtube-embedding.md → Keep or deprecate based on feature status
- docs/React.code-workspace → move out of docs/ (not documentation)
- frontend/README.md → Minimize and link to docs/index.md; keep project-specific npm scripts/commands
- frontend/AGENT_STATUS_IMPLEMENTATION.md → Merge as “Frontend integration” section in agents.md
- external/Example-React-AI-Chat-App/README.md → Keep in place; add docs/examples/external-app.md pointer

Conventions and style

- Headings structure: H1 title, H2 sections, H3 detail. Include “Audience”, “Prerequisites”, and “Last updated” at top.
- Link hygiene: relative links only within docs/, centralized assets in docs/assets/.
- Code formatting: use Prettier for Markdown; lint with markdownlint; optional prose lint (Vale).
- Diagrams: prefer Mermaid blocks in Markdown. If using external tools, keep source files under docs/architecture/diagrams/.

Ownership

- Backend docs owner: backend team (align to CODEOWNERS if present).
- Frontend docs owner: frontend team.
- Operations docs owner: DevOps/Infra.
- Reference/API docs owner: backend team (API), docs maintainer for final review.
- Examples owner: docs maintainer.

Open questions for decision

- Do we want to generate OpenAPI from code (preferred), or keep curated docs/test-bench-openapi.yaml for now?
- Do we keep a Markdown-only repo for this pass, or introduce a site generator (MkDocs/Docusaurus)? Recommendation: defer generator; stabilize IA first.
- Where to surface testing strategy? Options:
  - Integrate into reference/testing.md
  - Or keep in operations/ci-cd.md if mostly CI-centric
- 100-percent-sampling-config.md: integrate into tracing, or keep as a separate reference?

Acceptance criteria

- docs/index.md exists and is the only canonical entry page.
- No duplicate topics remain after merges.
- Root README is concise and links to docs/index.md.
- All internal links updated and validated by link checker.
- API doc parity with backend routes and OpenAPI file.

Next steps after approval

1. Create folders/files per target structure (empty placeholders as needed).
2. Add docs/CONSOLIDATION-PLAN.md with exact move/merge actions and owners.
3. Perform PR #1: structure and file moves only.
4. Perform PR #2: content merges, rewrites, and link updates.
5. Add docs quality gates (markdownlint, link checker) in CI.
