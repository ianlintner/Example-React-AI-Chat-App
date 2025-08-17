# Documentation Index

A unified documentation entry point for the demo portfolio showcasing AI and modern web engineering patterns. This suite supports hands-on demos, workshops, and code reviews, emphasizing architecture, quality gates, and observability over product completeness.

- Multi-agent orchestration, goal-seeking loops, and RAG
- Mobile-first client (React Native + Expo) with real-time UX
- Production-style reliability: validation, tracing, metrics, dashboards
- TypeScript end-to-end with tests and CI quality gates

Use this page as the single canonical entry to navigate all docs.

## Getting Started

- Quickstart (10-minute TL;DR)
  - [Quickstart](./getting-started/quickstart.md)
- Setup and Configuration
  - [Setup](./getting-started/setup.md)
  - [Troubleshooting](./getting-started/troubleshooting.md)

## Architecture

- System Overview
  - [System Overview](./architecture/system-overview.md) (merged from architecture.md + system-summary.md)
- Components
  - [Backend](./architecture/components/backend.md)
  - [Frontend](./architecture/components/frontend.md)
  - [Agent System](./architecture/components/agents.md)
  - [Message Queue](./architecture/components/message-queue.md)
  - [RAG System](./architecture/components/rag-system.md)
  - [Validation System](./architecture/components/validation-system.md)

## Operations

- Observability
  - [Observability & Monitoring](./operations/observability.md)
  - [Prometheus & Grafana](./operations/prometheus-grafana.md)
  - [Tracing (OTEL/Zipkin)](./operations/tracing.md)
- CI/CD
  - [CI/CD](./operations/ci-cd.md)

## Reference

- API
  - [API Reference (OpenAPI)](./reference/api-reference.md)
  - Swagger UI (runtime): /docs
  - OpenAPI JSON (runtime): /docs/json
- Quality and Tools
  - [Code Quality](./reference/code-quality.md)
  - [Docker Setup (optional)](./reference/docker-setup.md)
- Test Bench
  - [Test Bench Overview](./reference/test-bench.md)
  - [Test Bench OpenAPI](./reference/test-bench-openapi.yaml)

## Examples

- External Example App: see external/Example-React-AI-Chat-App/
- [Example Integration Notes](./examples/external-app.md)

## Notes

- API documentation is generated from code using swagger-jsdoc + swagger-ui-express. UI available at /docs and JSON at /docs/json when the backend is running.
- Documentation is organized under: getting-started, architecture, operations, reference, examples.
