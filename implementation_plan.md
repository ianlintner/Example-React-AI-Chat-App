# Implementation Plan

[Overview]
Evaluate and standardize the docs/ content using existing templates and best practices, consolidate legacy pages, and add comprehensive Mermaid diagrams aligned with the current system.

This initiative improves information architecture, ensures consistent writing and structure, and visualizes key flows (system overview, queues, RAG, validation, observability, CI/CD). Scope is limited to docs/ only. Navigation will reflect user journeys, duplicate legacy pages will be merged, and diagrams will follow a unified style (colors, direction, legend). Deliverables include refreshed content, added diagrams in priority sections, and mkdocs.yml updates that keep strict builds green.

The plan aligns with DOCS-STANDARDIZATION-PLAN.md and uses templates from docs/\_templates. All changes are documentation-only (no runtime code changes), and will be validated via local mkdocs build --strict and CI quality checks.

[Types]
Introduce content schemas and diagram conventions to standardize documentation artifacts.

- Frontmatter (optional; when used):
  - title: string
  - status: enum ["Active","Deprecated","Experimental"] (default "Active")
  - owner: string (team or individual)
  - last_updated: YYYY-MM-DD
  - tags: string[]
- Component Doc Schema (applies to docs/architecture/components/\*.md):
  - Required sections: Overview, Architecture (with Mermaid), Key Concepts, Configuration, API Reference or Events (if applicable), Integration Points, Monitoring & Observability, Development, Testing Strategy, Deployment, Troubleshooting, Security Considerations, Runbooks, Related
  - Validation: each component doc must include at least 1 Mermaid diagram and a "Related Documentation" subsection with cross-links
- ADR Schema (docs/architecture/decisions/ADR-XXX-\*.md):
  - Required: Status, Date, Authors, Reviewers, Context, Decision, Consequences (Positive/Negative/Neutral), Implementation Notes, Related Decisions
- Mermaid Diagram Conventions (global):
  - Direction: TB for system overviews; LR for flows/sequence where appropriate
  - Class palette (consistent across docs):
    - service: fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    - external: fill:#fff3e0,stroke:#e65100,stroke-width:2px
    - data: fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    - queue: fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
  - Always include: clear labels; keep diagrams focused (~10–12 nodes); include a short legend when non-obvious

[Files]
Create missing index pages, consolidate legacy documents, enhance component and operations pages with diagrams, and update mkdocs.yml.

- New files to be created:
  - docs/architecture/index.md
    - Purpose: landing for architecture section; links to system overview, components, and decisions.
  - docs/getting-started/index.md
    - Purpose: landing for getting started; quick links to quickstart, setup, troubleshooting.
  - docs/architecture/decisions/README.md
    - Purpose: ADR intro + index of decisions; guidance on when/how to add ADRs.
  - docs/examples/code-samples.md
    - Purpose: centralized small code snippets referenced by docs.
  - docs/operations/runbooks.md
    - Purpose: operational runbooks (scale, backup/restore, incidents).

- Existing files to be modified (content and diagrams):
  - docs/index.md
    - Add concise product intro; prominent links to Getting Started and Architecture; add a small overview diagram.
  - docs/architecture/system-overview.md
    - Add high-level system diagram: Frontend, API, Message Queue, Agents, RAG, Validator, Metrics/Tracing sinks; cross-link to component pages.
  - docs/architecture/architecture.md
    - Merge/retire into docs/architecture/index.md or expand with unique content only; eliminate duplication with system-overview.
  - docs/architecture/components/agents.md
    - Add agent types and interactions diagram; list agent responsibilities and data flows.
  - docs/architecture/components/backend.md
    - Add flow diagram: HTTP -> routes -> services -> queue -> validator; align to component template (Configuration/API/Monitoring sections).
  - docs/architecture/components/frontend.md
    - Add sequence diagram: UI event -> socket/API -> backend -> response -> UI render; align to template.
  - docs/architecture/components/message-queue.md
    - Add queue topology and lifecycle diagram including: priority (1–10), delays, retries with exponential backoff, DLQ, and health endpoints; document API endpoints from the excerpt.
  - docs/architecture/components/rag-system.md
    - Add sequence diagram: searchForAgent pipeline; clarify ContentItem structure, categories, tags; show fallback behavior.
  - docs/architecture/components/validation-system.md
    - Add sequence for validation pipeline; map metrics emitted (counters, histograms) to Prometheus labels; show pass/fail thresholds and issue categories.
  - docs/operations/observability.md
    - Add OTEL pipeline diagram: SDKs -> OTEL Collector -> Jaeger (traces) / Prometheus (metrics) -> Grafana; link to dashboards and config files.
  - docs/operations/tracing.md
    - Add request trace path diagram (ingress -> components -> egress); mention sampling/exporters knobs and OpenAPI verification context.
  - docs/operations/ci-cd.md
    - Add CI pipeline diagram: lint -> type-check -> test -> docs build (strict) -> link checks -> publish (if any); reference .github/workflows/docs-quality.yml.
  - docs/reference/api-reference.md
    - Ensure live endpoints, tags, and how to fetch static OpenAPI are documented; add cross-links to relevant routes.
  - docs/getting-started/quickstart.md, docs/getting-started/setup.md, docs/getting-started/troubleshooting.md
    - Normalize cross-links and admonitions; ensure consistency with new section landing pages.

- Files to be deleted or moved (consolidation and cleanup):
  - docs/backend.md → Merge content into docs/architecture/components/backend.md (then delete).
  - docs/api-reference.md (root) → Consolidate with docs/reference/api-reference.md (then delete root file).
  - docs/architecture.md (root) → Merge unique content into docs/architecture/index.md (then delete or convert to redirect note).
  - docs/system-summary.md → Incorporate relevant content into docs/architecture/index.md (then delete).
  - docs/architecture/components/\_sources/\* (if present) → integrate source notes into the appropriate component pages, then remove \_sources dir.
  - Ensure all orphaned docs are either linked in nav or removed if superseded.

- Configuration updates:
  - mkdocs.yml
    - Add "Getting Started: Overview" (getting-started/index.md) and "Architecture: Overview" (architecture/index.md).
    - Ensure all component pages are in nav under Architecture > Components.
    - Add "Technical Decisions" pointing to docs/architecture/decisions/.
    - Optional: add mkdocs plugins git-revision-date-localized and minify as per standardization plan (ensure CI installs these).

[Functions]
No runtime code functions change; add documentation validation processes and (optional) helper scripts.

- New/modified documentation workflows:
  - Lint docs (markdownlint): enforce structure/style rules.
  - Spell check (cspell): enforce technical vocabulary list.
  - Strict build (mkdocs build --strict): gate broken links and structure issues.
  - Optional link checking against local mkdocs serve (CI).
  - Soft gate: ensure key component and ops pages contain at least one Mermaid diagram (checked during review).

[Classes]
No application classes change. Documentation “classes” are templates and their required sections.

- Enforce usage of:
  - docs/\_templates/component-template.md for component pages.
  - docs/\_templates/adr-template.md for decisions.
  - docs/\_templates/how-to-template.md for runbooks/how-to style content.
- Add an “Authoring Guide” note in docs/architecture/index.md linking to templates to guide contributors.

[Dependencies]
Documentation tooling updates only.

- MkDocs plugins (mkdocs.yml and CI):
  - mkdocs-git-revision-date-localized-plugin
  - mkdocs-minify-plugin
- Existing markdown extensions (pymdownx.superfences with mermaid) remain enabled.
- CI installs:
  - pip: mkdocs-material, mkdocs-git-revision-date-localized-plugin, mkdocs-minify-plugin
  - npm: markdownlint-cli2, cspell

[Testing]
Use CI quality gates and local strict builds to validate changes.

- Local developer checks:
  - mkdocs build --strict
  - markdownlint-cli2 "docs/\*_/_.md" "\*.md"
  - cspell "docs/\*_/_.md" "\*.md"
- CI (docs-quality.yml):
  - Ensure steps to install plugins, lint, spell-check, strict build, and optionally run linkchecker against mkdocs serve.
- Manual visual validation:
  - Verify all new Mermaid diagrams render and remain readable on narrow widths.
  - Click-through nav for updated sections; ensure no 404s.

[Implementation Order]
Execute in phases to minimize nav breakage and keep builds green.

1. Preparation and IA
   - Create landing pages: docs/architecture/index.md and docs/getting-started/index.md.
   - Update mkdocs.yml to include new landing pages and add Architecture > Technical Decisions section.
   - Run mkdocs build --strict to confirm baseline.

2. Consolidate Legacy Content
   - Merge docs/backend.md → docs/architecture/components/backend.md (then delete original).
   - Consolidate docs/api-reference.md (root) → docs/reference/api-reference.md (then delete root file).
   - Merge docs/architecture.md (root) → docs/architecture/index.md (remove duplicate content).
   - Merge docs/system-summary.md → docs/architecture/index.md.
   - Remove docs/architecture/components/\_sources/\* after merging any unique content.

3. Component Pages Upgrade (apply component-template)
   - agents.md: add interaction overview diagram; fill key sections (Integration Points, Monitoring).
   - backend.md: add flow diagram; document key routes and their relation to services/queue; add Monitoring & Observability section.
   - frontend.md: add LR sequence diagram from UI to backend and back; add Testing Strategy section.
   - message-queue.md: add queue lifecycle diagram; document priority/delay/retry/DLQ; embed health/stats endpoints as examples.
   - rag-system.md: add sequence for searchForAgent; document ContentItem schema and categories/tags.
   - validation-system.md: add validation pipeline diagram; map metrics (counters/histograms) to labels; document pass/fail and issues.

4. Operations Pages Upgrade
   - observability.md: add OTEL pipeline diagram; link to provisioning files and dashboards.
   - tracing.md: add request path and sampling/exporters diagram; cross-link to swagger docs usage during debugging.
   - ci-cd.md: add pipeline diagram; reference docs-quality.yml checks and common failures with remedies.
   - Add docs/operations/runbooks.md to centralize operational runbooks; include stubs for scaling and backup/restore.

5. Getting Started Consistency
   - quickstart.md, setup.md, troubleshooting.md: normalize admonitions, ensure nav links point to new Overview pages; add Related links at bottoms.

6. Examples and Code Samples
   - Create docs/examples/code-samples.md; extract small, repeated code fragments from reference pages to reduce duplication; link back.

7. Decisions Index
   - Create docs/architecture/decisions/README.md; seed with ADR links (if any); add guidance for new ADRs.

8. mkdocs.yml Finalization
   - Ensure every page exists in nav; remove any orphaned files or add to nav intentionally.
   - Consider enabling mkdocs-git-revision-date-localized-plugin and mkdocs-minify-plugin; ensure CI installs.

9. Quality Gates and Final Verification
   - Run mkdocs build --strict locally; fix broken links.
   - Run markdownlint and cspell; tune ignore lists minimally.
   - Review Mermaid diagrams for consistency of classes and orientation; add short legends if necessary.

10. Completion

- Document changes in docs/IMPLEMENTATION-COMPLETE.md (changelog of documentation refactor).
- Ensure CI docs-quality workflow passes on PR.
