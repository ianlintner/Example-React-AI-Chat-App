# Demo Portfolio Documentation: AI + Modern Web Engineering Patterns

This documentation suite supports a demo portfolio project designed to showcase current, high‑impact technologies and patterns in AI and modern web app engineering. The goal is to demonstrate architecture, quality gates, and observability end‑to‑end — not to ship a product.

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
- Delivery patterns: test pyramid, lint
