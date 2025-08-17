# Implementation Plan

[Overview]
Consolidate and clean the docs directory by standardizing on docs/index.md as the canonical entry point, merging/creating the indexed section pages, and hard-deleting legacy/duplicate files.

This effort unifies documentation into a clear information architecture that matches the current repository. The docs/index.md already defines the target structure (Getting Started, Architecture, Operations, Reference, Examples) but several linked pages do not exist yet and multiple legacy/duplicate files remain. We will implement those missing pages by consolidating existing content, remove duplicates, and ensure all internal links resolve. This improves discoverability, reduces drift, and enables link checking in CI.

The cleanup is limited to documentation and CI checks for documentation; application code is not changed. The approach is incremental, with explicit mappings from legacy sources to new consolidated targets, automated link validation, and a small set of scripted operations to minimize mistakes.

[Types]  
Define a simple mapping schema to guide consolidation and enable scripted verification.

Type system changes: introduce a consolidation rule model for docs-only scripting/validation.

- interface DocPage {
  path: string; // repo-relative path to the target page (e.g., "docs/operations/ci-cd.md")
  title?: string; // optional expected H1
  mustExist: boolean; // after consolidation, this must exist
  sources?: string[]; // legacy files whose content will be merged and then deleted
  notes?: string; // consolidation notes
  }

- interface LinkRule {
  fromPath: string; // file containing the link
  oldLink: string; // original markdown link target
  newLink: string; // replacement link target
  }

- enum Action {
  Create, // create a new consolidated file
  Merge, // merge multiple sources into target file
  Delete, // delete a legacy/duplicate file after merge
  UpdateLinks // update internal links to reflect consolidation
  }

Validation rules:

- All DocPage.mustExist targets present at end.
- No dangling links reported by markdown-link-check across docs/ and root README.md.
- No duplicate basenames in conflicting locations for canonical documents (e.g., api-reference.md must only exist under docs/reference/).

[Files]
We will create missing canonical pages, merge content from legacy sources, update links, and remove duplicates.

New files to be created

- docs/getting-started/quickstart.md
  - Purpose: 10-minute TL;DR to run the demo quickly.
  - Sources: README.md, SETUP-INSTRUCTIONS.md (quickstart portions).
- docs/getting-started/setup.md
  - Purpose: Full setup guide (local/docker).
  - Sources: SETUP-INSTRUCTIONS.md, docs/docker-setup.md, docs/development.md.
- docs/getting-started/troubleshooting.md
  - Purpose: Common issues and fixes for local/dev/test.
  - Sources: SETUP-INSTRUCTIONS.md (troubleshooting parts), docs/development.md (troubleshooting notes if any).
- docs/architecture/system-overview.md
  - Purpose: Canonical system overview replacing architecture.md + system-summary.md.
  - Sources: docs/architecture.md, docs/system-summary.md.
- docs/architecture/components/agents.md
  - Purpose: Unified agents documentation with subsections.
  - Sources: docs/agents.md, docs/goal-seeking-system.md, docs/hold-agent-system.md, docs/entertainment-agents.md, docs/new-entertainment-agents-summary.md, frontend/AGENT_STATUS_IMPLEMENTATION.md (frontend integration subsection).
- docs/operations/observability.md
  - Purpose: Single entry for logs/metrics/traces at a high level.
  - Sources: docs/observability-monitoring.md, docs/docker-observability.md; cross-link Prometheus/Grafana page.
- docs/operations/tracing.md
  - Purpose: OTEL/Zipkin tracing operations + 100% sampling section.
  - Sources: docs/100-percent-sampling-config.md; reference otel-collector-config.yaml.
- docs/operations/ci-cd.md
  - Purpose: Consolidated CI/CD guide.
  - Sources: docs/ci-cd-setup.md, docs/ci-cd-improvements.md, docs/testing-and-ci.md.
- docs/examples/external-app.md
  - Purpose: Pointer and integration notes for external example.
  - Sources: external/Example-React-AI-Chat-App/README.md (curated pointers).

Existing files to be modified

- docs/index.md
  - Update Notes section to remove mention of "legacy files will be removed" once removal is done.
  - Ensure all links point to the above canonical pages.
- docs/reference/api-reference.md
  - Ensure title and intro clarify this is canonical API doc.
- docs/reference/docker-setup.md
  - Keep as deep-dive reference; ensure setup.md links here for optional details.
- README.md (root)
  - Condense to a short overview + direct link to docs/index.md per docs/docs-inventory.csv guidance.
- .markdown-link-check.json
  - Update ignore/include patterns if needed (e.g., ignore Swagger runtime-only endpoints /docs, /docs/json).
- .github/workflows/quality-checks.yml
  - Add markdown link check step for docs and root README.
  - Optionally add remark/markdownlint step if already standardized.

Files to be deleted or moved (hard delete policy for duplicates/legacy)

- Delete duplicates/legacy entry points:
  - docs/INDEX.md (duplicate index)
  - docs/README.md (duplicate index/readme)
- API duplicates:
  - docs/API.md (legacy)
  - docs/api-reference.md (duplicate of docs/reference/api-reference.md)
- Architecture legacy after merge:
  - docs/architecture.md (merged into architecture/system-overview.md)
  - docs/system-summary.md (merged into architecture/system-overview.md)
- Agents legacy after merge:
  - docs/agents.md
  - docs/goal-seeking-system.md
  - docs/hold-agent-system.md
  - docs/entertainment-agents.md
  - docs/new-entertainment-agents-summary.md
- Backend page legacy after confirmation:
  - docs/backend.md (content must be reflected in docs/architecture/components/backend.md; if gaps exist, merge there first, then delete)
- Ops legacy after merge:
  - docs/docker-observability.md (into operations/observability.md)
  - docs/observability-monitoring.md (into operations/observability.md)
  - docs/ci-cd-setup.md (into operations/ci-cd.md)
  - docs/ci-cd-improvements.md (into operations/ci-cd.md)
  - docs/testing-and-ci.md (into operations/ci-cd.md)
- Setup legacy after merge:
  - SETUP-INSTRUCTIONS.md (root) (into getting-started/setup.md and troubleshooting.md)
- Optional/evaluate (keep for now; not duplicates):
  - docs/100-percent-sampling-config.md (if fully incorporated into operations/tracing.md, then delete; else keep as deep-dive referenced from tracing.md)
  - docs/IA-PROPOSAL.md, docs/CONSOLIDATION-PLAN.md (keep as internal notes; do not link from index)
  - docs/prometheus-grafana-migration.md (link from operations/prometheus-grafana.md if kept as separate deep-dive; otherwise consolidate)

Configuration updates

- Ensure quality checks workflow runs markdown-link-check on:
  - README.md
  - docs/\*_/_.md
- Verify .prettier settings are applied to new files (.prettierrc exists).
- If adopting remark-lint later, add config at .remarkrc (deferred; not mandatory for this cleanup).

[Functions]
No runtime code functions are modified; implement a small set of maintenance scripts/commands to automate the consolidation.

New helper commands (to be executed manually during implementation)

- Link validation
  - npx markdown-link-check -q -c .markdown-link-check.json README.md
  - find docs -name "\*.md" -print0 | xargs -0 -I{} npx markdown-link-check -q -c .markdown-link-check.json "{}"
- Duplicate detection (sanity)
  - find docs -type f -name "\*.md" -exec basename {} \; | awk '{print tolower($0)}' | sort | uniq -c | awk '$1>1{print $0}'
- Grep for missing canonical targets (post-merge)
  - grep -R "(./architecture/system-overview.md)" docs || true
  - grep -R "(./operations/tracing.md)" docs || true
  - grep -R "(./operations/ci-cd.md)" docs || true

Proposed implementation script stubs (if desired in future; not required to complete)

- scripts/docs/consolidate.sh
  - merge_files "$target" "${sources[@]}" # manual curated merges
  - delete_files "${legacy[@]}"
  - update_links "${rules[@]}"

Modified functions

- None in application code.

Removed functions

- None.

[Classes]
No application classes are modified; this is documentation-only reorganization.

New classes

- None.

Modified classes

- None.

Removed classes

- None.

[Dependencies]
Introduce or use existing documentation tooling in CI to prevent regressions.

- markdown-link-check (CLI)
  - Purpose: Validate internal and external links in markdown.
  - Integration: Via GitHub Actions (quality-checks.yml).
  - Version: Use latest stable via npx; no lockfile changes required.
- Optional (deferred): remark-cli + plugins for linting style (headings, lists, code fences).

[Testing]
Validate links, structure, and absence of duplicates to ensure documentation integrity.

- Automated link checks
  - Run markdown-link-check across README.md and docs/\*_/_.md.
  - Configure .markdown-link-check.json to ignore runtime-only URLs (/docs, /docs/json).
- Structural checks
  - Verify docs/index.md links resolve (no 404s).
  - Verify no duplicate canonical basenames (api-reference.md exists only in docs/reference/).
- Manual spot-checks
  - Open key consolidated pages to ensure merged content has accurate headings:
    - docs/architecture/system-overview.md
    - docs/operations/ci-cd.md
    - docs/architecture/components/agents.md
    - docs/getting-started/quickstart.md

[Implementation Order]
Execute consolidation in an order that keeps links mostly valid and simplifies deletion.

1. Create missing canonical targets with initial skeleton content:
   - getting-started/{quickstart.md, setup.md, troubleshooting.md}
   - architecture/system-overview.md
   - architecture/components/agents.md
   - operations/{observability.md, tracing.md, ci-cd.md}
   - examples/external-app.md
2. Merge content from legacy sources into the above targets (curated copy/edit), ensuring each target has an H1 and coherent structure.
3. Update docs/index.md to ensure all links point to the canonical targets (remove “legacy will be removed” note).
4. Update README.md to be a concise overview with a prominent link to docs/index.md.
5. Run markdown-link-check across README.md and docs/\*_/_.md; fix any broken links and anchors.
6. Hard-delete duplicates and legacy files that are now consolidated:
   - docs/INDEX.md, docs/README.md, docs/API.md, docs/api-reference.md
   - docs/architecture.md, docs/system-summary.md
   - agents-related top-level files listed above
   - docs/backend.md (after confirming parity with components/backend.md)
   - ops/setup CI docs merged into operations/ci-cd.md
   - SETUP-INSTRUCTIONS.md (root) merged into getting-started
7. Re-run link checks; ensure no dangling links remain.
8. Commit changes with a clear message summarizing the consolidation and deleted files.
