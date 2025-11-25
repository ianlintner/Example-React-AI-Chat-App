# Architecture Overview

This section provides comprehensive documentation of the AI Goal-Seeking System's architecture, from high-level system design to detailed component specifications.

## System Design

- **[System Overview](./system-overview.md)** - High-level architecture and component relationships
- **[Architecture Guide](./architecture.md)** - Detailed technical architecture and design decisions

## Components

Detailed documentation for each system component:

- **[Agent System](./components/agents.md)** - AI agents, classification, and goal-seeking behavior
- **[Backend Services](./components/backend.md)** - API routes, services, and business logic
- **[Frontend App](./components/frontend.md)** - React Native interface and user experience
- **[Message Queue](./components/message-queue.md)** - Asynchronous message processing and queuing
- **[RAG System](./components/rag-system.md)** - Retrieval-augmented generation for content
- **[Validation Pipeline](./components/validation-system.md)** - AI response quality assurance

## Technical Decisions

- **[Architecture Decision Records](./decisions/README.md)** - Documented architectural decisions and their rationale

## System Overview Diagram

```mermaid
graph TB
    %% Define classes for consistent styling
    classDef service fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef data fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef queue fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px

    %% External actors and systems
    User[👤 User]:::external
    OpenAI[OpenAI API]:::external
    Redis[(Redis)]:::data

    %% Frontend layer
    Frontend[React Native Frontend]:::service
    
    %% Backend services
    API[Express API Gateway]:::service
    Socket[WebSocket Handler]:::service
    
    %% Core processing
    Queue[Message Queue]:::queue
    Agents[AI Agent System]:::service
    RAG[RAG Content System]:::data
    Validator[Response Validator]:::service
    
    %% Observability
    Metrics[Prometheus Metrics]:::data
    Traces[Jaeger Traces]:::data
    Grafana[Grafana Dashboards]:::external

    %% Connections
    User --> Frontend
    Frontend --> API
    Frontend --> Socket
    API --> Queue
    Socket --> Queue
    Queue --> Agents
    Agents --> RAG
    Agents --> OpenAI
    Agents --> Validator
    Validator --> Metrics
    API --> Traces
    Socket --> Traces
    Agents --> Traces
    Queue --> Redis
    Metrics --> Grafana
    Traces --> Grafana
```

## Authoring Guide

When contributing to architecture documentation, please use the provided templates:

- **Components**: Follow the [Component Template](../_templates/component-template.md) structure
- **Decisions**: Use the [ADR Template](../_templates/adr-template.md) format
- **How-To Guides**: Apply the [How-To Template](../_templates/how-to-template.md) structure

## Related Documentation

- [Getting Started Guide](../getting-started/index.md)
- [Operations & Monitoring](../operations/observability.md)
- [API Reference](../reference/api-reference.md)
