# System Overview

High-level architecture, data flows, and responsibilities.

## Context

This demo emphasizes architecture, quality gates, and observability over product completeness.

## Core Components

- Frontend (React Native + Expo)
- Backend (Express/TypeScript)
- Agent System (multi-agent orchestration)
- Message Queue
- RAG System
- Validation & Observability (tracing/metrics/logging)

## Key Flows

- Ingest request -> agent orchestration -> RAG -> validation -> response
- Telemetry: OTEL tracing, Prometheus metrics, logs

---

<!-- Sources to merge (from plan):
- docs/architecture.md
- docs/system-summary.md
-->
