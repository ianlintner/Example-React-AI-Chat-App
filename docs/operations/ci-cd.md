# CI/CD

This project now uses a **single consolidated GitHub Actions workflow** (`.github/workflows/ci.yml`) that orchestrates all quality gates, builds, security scanning, docs validation, and container image publication. All former Google Cloud publishing workflows (GCS site + frontend deploy + auth tests) have been removed.

## Workflow Overview

| Stage | Purpose | Key Tools |
|-------|---------|-----------|
| changes | Path-based change detection to short‑circuit jobs | dorny/paths-filter |
| quality | Formatting, linting, type checking, doc lint/spell/Mermaid | Node 20, markdownlint, cspell |
| backend | Backend tests (Redis service), build, OpenAPI smoke test, coverage upload | Jest, Codecov |
| frontend | Frontend tests, build, coverage upload | Jest, Expo web build |
| docs | Strict MkDocs build + link check (no publish) | MkDocs, linkchecker |
| security | Vulnerability + dependency audit (non‑blocking severity thresholds) | Trivy, npm audit |
| integration | Docker Compose spin‑up + integration/smoke tests | Docker Compose |
| docker | Build & push combined image to Docker Hub (+ optional Azure ACR) | docker/build-push-action |
| ci-success | Aggregates required job results for branch protection | Bash guard script |

## Removed / Deprecated

| Removed | Reason |
|---------|--------|
| `docs-deploy.yml` (stub) | GCS documentation publishing removed; retained as manual noop for history |
| `deploy-frontend.yaml.disabled` (stub) | Static frontend GCS hosting deprecated (container image used) |
| `gcp-auth.yaml` (stub) | GCP OIDC auth test no longer required |
| `azure-docker-push.yml` (stub) | Folded into unified pipeline (`docker` job) |
| `docs-quality.yml` & `quality-checks.yml` (stubs) | Steps merged into `quality` / `docs` jobs |
| `ci-optimized.yml` (stub) | Superseded by consolidated `ci.yml` |
| `ci.yml.disabled` (stub) | Legacy simplified CI retained as noop for reference |

## Branch Protection

Branch protection should require the consolidated status check: `ci-success`. This encapsulates all critical gates without needing to list each job individually.

## Local Parity Commands

```bash
# Run core quality gates locally
npm run install:all
npm run format:check && npm run lint && npm run type-check

# Backend tests + build
cd backend && npm run test:ci && npm run build && cd ..

# Frontend tests + build
cd frontend && npm run test:ci && npm run build && cd ..

# Docs strict build
python -m mkdocs build --strict
```

## Notes

1. Coverage is uploaded per layer (backend/frontend) through Codecov.
2. Docs are validated but not published; any future publish target (Pages, Azure Static Web Apps, etc.) can be added as an additional conditional job.
3. Azure Container Registry push is conditional on secrets being present; otherwise only Docker Hub push runs.
4. Non‑blocking checks (spell, mermaid, linkchecker) log issues but do not fail the pipeline—adjust as needed.

## References

- See `.github/workflows/ci.yml` for authoritative configuration.

