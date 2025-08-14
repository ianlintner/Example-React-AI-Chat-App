# Demo Portfolio Documentation: AI + Modern Web Engineering Patterns

This documentation suite supports a demo portfolio project designed to showcase current, high‑impact technologies and patterns in AI and modern web app engineering. The goal is to demonstrate architecture, quality gates, and observability end‑to‑end—not to ship a product.

- Demonstrates multi‑agent orchestration, goal‑seeking loops, and RAG
- Mobile‑first client using React Native + Expo with real‑time UX
- Production‑style quality: validation, tracing, metrics, dashboards
- TypeScript across the stack, with tests and CI quality gates

> This repository is intentionally demo‑oriented for interviews, workshops, and code reviews. Patterns and tradeoffs are highlighted; complete product hardening is out of scope.

## Table of Contents

- [Demo Portfolio Documentation: AI + Modern Web Engineering Patterns](#demo-portfolio-documentation-ai--modern-web-engineering-patterns)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
    - [Key Features](#key-features)
  - [What This Demo Shows](#what-this-demo-shows)
  - [Quick Start (Demo Focus)](#quick-start-demo-focus)
  - [Demo Modes](#demo-modes)
  - [Documentation Structure](#documentation-structure)
  - [Technology Stack](#technology-stack)
    - [Frontend (Mobile‑First with React Native)](#frontend-mobilefirst-with-react-native)
    - [Backend (Node.js)](#backend-nodejs)
    - [Observability \& Ops](#observability--ops)
    - [Quality \& CI](#quality--ci)
  - [Getting Help](#getting-help)

## Overview

This demo portfolio implements a real‑time AI chat system with a multi‑agent architecture, optional LLM calls (OpenAI), curated RAG content for offline/demo use, and enterprise‑style observability.

It is optimized to:
- Communicate patterns clearly (routing, validation, RAG, observability)
- Be easy to run and present (Expo app + local backend)
- Provide realistic signals and dashboards for traceability

### Key Features

- 💬 Real‑time chat with multi‑agent orchestration
- 🎯 Goal‑seeking behavior with proactive steps
- 📚 RAG‑backed content for offline/demo scenarios
- ✅ Response validation and safety gates
- 🔄 WebSocket streaming and event‑driven flows
- 📈 Metrics, logs, and distributed tracing (Prometheus, Grafana, Jaeger)
- ⚙️ TypeScript end‑to‑end with tests and CI checks

## What This Demo Shows

- AI patterns: agent routing/classification, goal‑seeking loops, RAG curation, safety
- Systems patterns: evented messaging, streaming, backpressure awareness
- Reliability patterns: metrics, logs, traces; dashboards for live walkthroughs
- Delivery patterns: test pyramid, linting/formatting, CI quality gates
- DX patterns: clear module boundaries, docs, and demo scenarios

## Quick Start (Demo Focus)

Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI: `npm i -g @expo/cli`
- Optional: OpenAI API key (demo works offline via RAG + stubs)
- Optional: Docker (monitoring stack)

Setup
```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Configure environment (OpenAI key optional for demo)
cp backend/.env.example backend/.env
# Add your OpenAI API key to backend/.env if you want live model calls

# Run the demo
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start    # Expo: press i for iOS simulator or scan QR with Expo Go
```

Monitoring & Docs (optional)
- API Docs: http://localhost:3000/api/docs
- Grafana: http://localhost:5001
- Prometheus: http://localhost:9090
- Jaeger: http://localhost:16686

Start monitoring stack:
```bash
docker-compose up
```

## Demo Modes

- No‑Key Mode (Recommended for quick demo)
  - Uses curated RAG content and stubs
  - Demonstrates routing, validation, metrics, and traces
- Live LLM Mode (Optional)
  - Add OpenAI API key to `backend/.env`
  - Show end‑to‑end live model calls with the same quality gates

Suggested 10‑minute walkthrough:
1) Chat + Agents: observe routing and goal‑seeking behavior.
2) Validation: trigger safe/unsafe responses and inspect validation outputs.
3) Observability: open Grafana and Jaeger while interacting; show latencies and flows.
4) RAG Demo: run without API key to demonstrate curated/offline behavior.

## Documentation Structure

- [📋 Architecture Guide](./ARCHITECTURE.md) or [Legacy Architecture](./architecture.md)
- [📖 Documentation Index](./INDEX.md)
- [🤖 Agents](./agents.md)
- [🎯 Goal‑Seeking System](./goal-seeking-system.md)
- [📚 RAG System](./rag-system.md)
- [📈 Observability & Monitoring](./observability-monitoring.md)
- [⚙️ Backend Guide](./backend.md)
- [📱 Frontend Guide](./frontend.md)
- [🧪 Testing & CI](./testing-and-ci.md)
- [🐳 Docker Observability](./docker-observability.md)
- [⚙️ CI/CD Setup](./ci-cd-setup.md)

Feature overviews:
- [🆕 New Features Overview](./new-features-overview.md)
- [🎪 New Entertainment Agents Summary](./new-entertainment-agents-summary.md)
- [📞 Hold Agent System](./hold-agent-system.md)

## Technology Stack

### Frontend (Mobile‑First with React Native)
- React Native + Expo
- TypeScript
- Expo Router (navigation)
- Socket.io Client (real‑time)
- Jest + React Native Testing Library

### Backend (Node.js)
- Node.js 18+, Express 5
- TypeScript
- Socket.io Server (real‑time)
- Optional LLM integration (OpenAI)
- In‑memory storage (demo‑friendly), ready for Mongo/Postgres
- Jest + Supertest

### Observability & Ops
- OpenTelemetry (tracing)
- Prometheus (metrics)
- Grafana (dashboards)
- Jaeger (distributed tracing)
- Docker Compose for local monitoring

### Quality & CI
- ESLint + Prettier
- Jest unit/integration tests
- GitHub Actions workflows

## Getting Help

- Review the [Documentation Index](./INDEX.md) for topic‑based navigation
- Check [Architecture Guide](./ARCHITECTURE.md) for diagrams and design decisions
- Raise questions or suggestions via GitHub issues

---

Built to demonstrate pragmatic, modern AI + web engineering patterns with clarity and traceability.
