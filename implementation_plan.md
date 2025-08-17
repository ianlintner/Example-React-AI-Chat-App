# Implementation Plan

[Overview]
Create a unified, maintainable documentation system with a single canonical entry point, consolidate duplicate pages, and introduce code-generated OpenAPI docs for the Express + TypeScript backend using a minimal-refactor approach. The work is staged across PRs to de-risk changes: scaffold and moves first, content merges next, OpenAPI generation and CI quality gates afterward.

This plan executes the existing IA strategy (IA-PROPOSAL.md, CONSOLIDATION-PLAN.md) by:

- Consolidating docs into a clear IA: getting-started, architecture, operations, reference, examples
- Removing duplicate entry points and transitional pages
- Aligning API docs with code via swagger-jsdoc + swagger-ui-express (minimal refactor)
- Adding docs linting and link checking in CI to prevent regressions
- Keeping the root README slim while pointing to docs/index.md

Why this is needed:

- Current docs contain duplicated topics (e.g., multiple architecture and API pages) and multiple entry points (docs/README.md, docs/INDEX.md)
- API documentation may drift from reality without code generation
- A clear IA improves onboarding, demo flow, and long-term maintainability
- CI quality gates will keep docs current and unbroken

[Types]  
Introduce minimal type system scaffolding for documentation metadata and API schema references, without refactoring core application code.

- DocFrontMatter (Markdown metadata; optional)
  - title: string
  - audience: 'all' | 'dev' | 'dev-backend' | 'dev-frontend' | 'devops' | 'maintainers'
  - owner: 'docs' | 'backend' | 'frontend' | 'devops' | 'maintainers'
  - lastUpdated: string (ISO date)
  - status: 'active' | 'deprecated'
- OpenAPI Generation Config (JS object in code)
  - openapi: '3.0.0' | '3.1.0'
  - info: { title: string; version: string; description?: string }
  - servers: Array<{ url: string; description?: string }>
  - apis: string[] (glob patterns to scan JSDoc blocks)
- API Models (TypeScript interfaces leveraged by JSDoc)
  - Message, Conversation, ChatRequest, ChatResponse (already present in docs; ensure parity in code comments for swagger-jsdoc)

[Files]
Perform structured moves, merges, and stubs creation to match the target IA. No content rewrites in PR #1 beyond scaffolding and pure moves.

- New files to be created
  - docs/index.md (merged entry point; PR #2 content)
  - docs/getting-started/quickstart.md (docker-compose TL;DR; PR #2 content)
  - docs/getting-started/setup.md (merge SETUP-INSTRUCTIONS.md + docker basics; PR #2 content)
  - docs/getting-started/troubleshooting.md (PR #2 content)
  - docs/architecture/system-overview.md (merge system-summary.md + architecture.md; PR #2 content)
  - docs/architecture/components/backend.md (moved)
  - docs/architecture/components/frontend.md (moved)
  - docs/architecture/components/agents.md (merge agents+goal-seeking+hold-agent+entertainment/new-entertainment; PR #2 content)
  - docs/architecture/components/message-queue.md (rename/move)
  - docs/architecture/components/rag-system.md (rename/move)
  - docs/architecture/components/validation-system.md (rename/move)
  - docs/operations/observability.md (merge observability-monitoring + docker-observability; PR #2 content)
  - docs/operations/prometheus-grafana.md (move/retitle)
  - docs/operations/tracing.md (new; include OTEL/Zipkin; PR #2 content)
  - docs/operations/ci-cd.md (merge ci-cd-setup + ci-cd-improvements + CI bits of testing-and-ci; PR #2 content)
  - docs/reference/api-reference.md (merge API.md + api-reference.md; PR #2 content)
  - docs/reference/test-bench.md (move/retitle)
  - docs/reference/test-bench-openapi.yaml (move)
  - docs/reference/code-quality.md (move/retitle from code-quality-setup.md)
  - docs/reference/docker-setup.md (optional deep-dive)
  - docs/reference/100-percent-sampling-config.md (if kept; else integrate into tracing.md)
  - docs/reference/youtube-embedding.md (if feature active; else deprecate)
  - docs/examples/external-app.md (pointer to external example)

- Existing files to be modified
  - README.md (root): slim, link to docs/index.md (PR #2)
  - frontend/README.md: minimize, link to docs/index.md (PR #2)
  - docs/api-reference.md, docs/API.md, docs/architecture.md, docs/system-summary.md, docs/testing-and-ci.md: merged/absorbed per mapping (PR #2)
  - backend/src/routes/\*: add JSDoc swagger blocks for swagger-jsdoc scanning (PR #3)
  - backend/src/routes/swaggerDocs.ts (or equivalent): expose swagger UI and JSON at a single canonical path (prefer /docs and /docs/json); update import path usage in backend/src/index.ts if needed (PR #3)
  - .github/workflows/quality-checks.yml: add markdownlint and link checker steps (PR #3)

- Files to be deleted or moved
  - Pure moves (PR #1):
    - docs/backend.md → docs/architecture/components/backend.md
    - docs/frontend.md → docs/architecture/components/frontend.md
    - docs/message-queue-system.md → docs/architecture/components/message-queue.md
    - docs/rag-system.md → docs/architecture/components/rag-system.md
    - docs/validation-system.md → docs/architecture/components/validation-system.md
    - docs/prometheus-grafana-migration.md → docs/operations/prometheus-grafana.md
    - docs/test-bench-system.md → docs/reference/test-bench.md
    - docs/test-bench-openapi.yaml → docs/reference/test-bench-openapi.yaml
    - docs/code-quality-setup.md → docs/reference/code-quality.md
    - (optional) docs/docker-setup.md → docs/reference/docker-setup.md
    - (optional) docs/React.code-workspace → React.code-workspace (repo root)
  - Defer deletion until replacement exists (PR #2):
    - docs/README.md, docs/INDEX.md → replace with docs/index.md then remove
    - docs/API.md, docs/api-reference.md → replace with docs/reference/api-reference.md then remove
  - Evaluate/remove (PR #2):
    - MIGRATION_COMPLETE.md (archive/remove if purely historical)
    - docs/new-features-overview.md (integrate or remove)
    - docs/youtube-embedding.md (deprecate unless active; else move as reference)

- Configuration file updates
  - backend/package.json: add scripts for swagger JSON generation (optional), keep UI served at runtime
  - root/package.json: add docs lint/link-check scripts
  - .github/workflows/quality-checks.yml: add markdownlint and link-check jobs

[Functions]
Minimal new utility functions and route handlers for OpenAPI serving; function names and signatures below.

- New functions
  - createSwaggerSpec (backend/src/routes/swaggerDocs.ts)
    - Signature: function createSwaggerSpec(): import('openapi-types').OpenAPIV3.Document
    - Purpose: Build swagger-jsdoc configuration and generate OpenAPI spec by scanning JSDoc blocks in backend/src/routes/\*_/_.ts
  - registerSwaggerRoutes (backend/src/routes/swaggerDocs.ts)
    - Signature: function registerSwaggerRoutes(app: import('express').Express, spec: Document, options?: { uiPath?: string; jsonPath?: string }): void
    - Purpose: Serve Swagger UI at /docs and JSON at /docs/json using swagger-ui-express
  - runMarkdownLint (script) (package.json script)
    - Signature: npm run docs:lint
    - Purpose: Lint Markdown files with markdownlint-cli
  - checkDocsLinks (script) (package.json script)
    - Signature: npm run docs:links
    - Purpose: Run link checker across docs (e.g., lychee or markdown-link-check)

- Modified functions
  - backend/src/index.ts (ensure a single canonical docs mountpoint)
    - Current: app.use('/docs', swaggerDocsRoutes)
    - Required changes: confirm path consistency with readme/docs; prefer /docs UI + /docs/json JSON; ensure no duplicate /api/docs path remains; update docs to match
  - backend/src/routes/\* route handlers
    - Add JSDoc annotations with @swagger definitions for endpoints:
      - chatRoutes (/api/chat)
      - conversations (/api/conversations)
      - reactions (/api/reactions)
      - validation (/api/validation)
      - agentTestBench (/api/test-bench)
      - messageQueue (/api/queue)
    - Include schemas for Message, Conversation, ChatRequest, ChatResponse

- Removed functions
  - None

[Classes]
No new classes are required; functional additions are sufficient.

- New classes
  - None

- Modified classes
  - None

- Removed classes
  - None

[Dependencies]
Add minimal, focused dependencies to enable code-generated OpenAPI and docs quality gates.

- Backend (backend/package.json)
  - swagger-jsdoc ^6
  - swagger-ui-express ^5
- Root or Backend (choose one location; root preferred if scripts span repos)
  - markdownlint-cli ^0.39
  - link checker (choose one: lychee-action for CI, or markdown-link-check for local)
- Optional (future)
  - zod + zod-to-openapi (if we migrate to schema-first later)
  - Docusaurus/MkDocs (defer until IA stabilizes)

[Testing]
Add CI steps to validate the docs and the generated OpenAPI; smoke tests for the Swagger endpoint.

- Docs linting
  - markdownlint on all \*.md files (docs/\*\*, README.md, frontend/README.md)
- Link validation
  - Link checker on docs/\*\* with allowlist patterns for local dev URLs (localhost:5001, Jaeger/Grafana)
- OpenAPI smoke test
  - Start backend in CI matrix (or a separate job), curl http://localhost:5001/docs/json, validate that JSON has openapi and paths keys
- Unit tests (optional)
  - If adding utilities for swagger configuration, add minimal tests to assert config shape

[Implementation Order]
Stage the work to minimize churn and breakage.

1. PR #1 — IA Scaffold and Pure Moves
   - Create directories:
     - docs/getting-started, docs/architecture/components, docs/operations, docs/reference, docs/examples
   - Perform pure git mv operations:
     - docs/backend.md → docs/architecture/components/backend.md
     - docs/frontend.md → docs/architecture/components/frontend.md
     - docs/message-queue-system.md → docs/architecture/components/message-queue.md
     - docs/rag-system.md → docs/architecture/components/rag-system.md
     - docs/validation-system.md → docs/architecture/components/validation-system.md
     - docs/prometheus-grafana-migration.md → docs/operations/prometheus-grafana.md
     - docs/test-bench-system.md → docs/reference/test-bench.md
     - docs/test-bench-openapi.yaml → docs/reference/test-bench-openapi.yaml
     - docs/code-quality-setup.md → docs/reference/code-quality.md
     - (optional) docs/docker-setup.md → docs/reference/docker-setup.md
     - (optional) docs/React.code-workspace → React.code-workspace (root)
   - Defer deletion of legacy entry points (docs/README.md, docs/INDEX.md) until docs/index.md exists.

2. PR #2 — Content Merges and Entry-Point Creation
   - Create docs/index.md by merging docs/INDEX.md + docs/README.md (dedupe)
   - Merge docs/system-summary.md + docs/architecture.md → docs/architecture/system-overview.md
   - Merge API docs: docs/API.md + docs/api-reference.md → docs/reference/api-reference.md
   - Create docs/getting-started/{quickstart.md, setup.md, troubleshooting.md}
     - Merge SETUP-INSTRUCTIONS.md and docker basics into setup.md
   - Create docs/operations/{observability.md, tracing.md, ci-cd.md}
     - Merge observability-monitoring + docker-observability → observability.md
     - Merge ci-cd-setup + ci-cd-improvements (+ CI content from testing-and-ci.md) → ci-cd.md
     - Integrate 100-percent-sampling-config.md into tracing.md or keep under reference
   - Create docs/architecture/components/agents.md by merging agents-related docs and integrate frontend/AGENT_STATUS_IMPLEMENTATION.md under “Frontend integration”
   - Evaluate/deprecate: MIGRATION_COMPLETE.md, docs/new-features-overview.md, docs/youtube-embedding.md
   - Update README.md (root) and frontend/README.md to be concise and point to docs/index.md
   - Update all cross-links; run link checker locally

3. PR #3 — Code-Generated OpenAPI + CI Quality Gates
   - Backend: add swagger-jsdoc + swagger-ui-express
   - Implement createSwaggerSpec and registerSwaggerRoutes in backend/src/routes/swaggerDocs.ts (or equivalent module)
   - Add JSDoc blocks to backend/src/routes/\*.ts for:
     - /api/health (already exists as app route)
     - /api/chat (POST)
     - /api/conversations (GET, GET :id, DELETE :id)
     - /api/reactions (if public)
     - /api/validation
     - /api/test-bench
     - /api/queue
   - Expose Swagger UI at /docs and JSON at /docs/json; ensure consistency with docs (unify prior /api/docs mentions)
   - Root/package.json:
     - scripts: "docs:lint", "docs:links"
   - .github/workflows/quality-checks.yml:
     - Add steps to run markdownlint and link checker
     - Optional: start backend in a separate job and curl OpenAPI JSON for smoke test
   - Update docs/reference/api-reference.md to point to /docs (UI) and /docs/json (JSON)

4. PR #4 — Polish and Diagrams (Optional)
   - Add/update Mermaid diagrams as needed and ensure assets are centralized under docs/assets
   - Consider introducing a docs site generator (Docusaurus/MkDocs) only after IA stabilizes
