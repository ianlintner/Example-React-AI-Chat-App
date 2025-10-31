# GitHub Copilot Instructions for Example-React-AI-Chat-App

This document provides guidance for GitHub Copilot when working with this repository.

## Project Overview

This is a portfolio demo project showcasing AI-enabled, real-time chat applications with modern web engineering patterns. It consists of:

- **Frontend**: React Native mobile client using Expo, TypeScript, and Socket.io
- **Backend**: Node.js Express 5 server with TypeScript, multi-agent AI orchestration, and Socket.io
- **Architecture**: Event-driven messaging, WebSocket streaming, observability with OpenTelemetry
- **Monitoring**: Prometheus metrics, Grafana dashboards, Jaeger tracing

## Repository Structure

```text
├── backend/                 # Node.js backend (TypeScript, Express, Socket.io)
│   ├── src/agents/          # AI agent classification, routing, goal-seeking, RAG
│   ├── src/routes/          # REST and WebSocket endpoints
│   ├── src/validation/      # Response validation and safety checks
│   ├── src/tracing/         # OpenTelemetry tracing helpers
│   └── src/metrics/         # Prometheus metrics
├── frontend/                # React Native frontend (Expo, TypeScript)
│   ├── app/                 # Screens and navigation (Expo Router)
│   ├── components/          # Reusable UI components
│   └── services/            # API and Socket.io services
├── docs/                    # MkDocs documentation
├── tests/                   # End-to-end tests
└── shared/                  # Shared types and utilities
```

## Technology Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express 5
- **Language**: TypeScript (CommonJS modules)
- **Real-time**: Socket.io server
- **AI/LLM**: OpenAI SDK, custom agent orchestration
- **Observability**: OpenTelemetry, Pino logging, Prometheus metrics
- **Testing**: Jest
- **Database**: In-memory (demo), with MongoDB/Postgres interfaces

### Frontend

- **Framework**: React Native 0.79.x
- **Platform**: Expo ~53.x
- **Language**: TypeScript
- **Navigation**: Expo Router
- **UI**: React Native Paper, Expo components
- **Real-time**: Socket.io client
- **Testing**: Jest, React Native Testing Library

## Coding Standards

### TypeScript

- Use TypeScript for all new code (both frontend and backend)
- Enable strict type checking
- Avoid `any` types; use proper type definitions
- Export types and interfaces for shared use
- Use CommonJS modules (`require`/`module.exports`) for backend
- Use ES modules (`import`/`export`) for frontend

### Code Style

- **Formatting**: Prettier (config in `.prettierrc`)
- **Linting**: ESLint (configs in respective directories)
- **Line Length**: Max 100 characters
- **Naming**:
  - camelCase for variables and functions
  - PascalCase for components and classes
  - UPPER_CASE for constants

### Comments

- Add JSDoc comments for public APIs and complex functions
- Keep inline comments minimal and meaningful
- Document "why" not "what" when commenting

## Development Workflow

### Setup

```bash
# Install all dependencies
npm run install:all

# Start development servers
npm run dev              # Both frontend and backend
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only
```

### Testing

```bash
npm run test             # Run all tests
npm run test:backend     # Backend tests only
npm run test:frontend    # Frontend tests only
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage    # Generate coverage report
```

### Quality Checks

```bash
npm run lint             # Lint all code
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format all code
npm run format:check     # Check formatting
npm run type-check       # TypeScript type checking
```

### Building

```bash
npm run build            # Build both frontend and backend
npm run build:backend    # Build backend (TypeScript to JavaScript)
npm run build:frontend   # Build frontend (Expo web export)
```

## Testing Guidelines

### Backend Tests

- Place tests in `__tests__` directories or `.test.ts` files
- Use Jest and appropriate mocking libraries
- Test structure: Arrange, Act, Assert
- Mock external dependencies (OpenAI API, databases, etc.)
- Test both success and error cases
- Integration tests should test complete request/response flows

### Frontend Tests

- Place tests in `__tests__` directories or `.test.tsx` files
- Use Jest and React Native Testing Library
- Test user interactions and component behavior
- Mock API calls and Socket.io connections
- Test accessibility features
- Snapshot tests for complex UI components

### Test Naming

- Use descriptive test names: `should return error when user is not authenticated`
- Group related tests with `describe` blocks
- Use `it` or `test` for individual test cases

## AI/Agent Development

### Agent Structure

- Agents are in `backend/src/agents/`
- Each agent has classification, routing, and execution logic
- Use goal-seeking patterns for complex interactions
- Implement validation and safety checks

### RAG (Retrieval-Augmented Generation)

- RAG content is curated and stored in `backend/src/agents/rag/`
- Use RAG for demo scenarios that work without API keys
- Structure content for easy retrieval and contextual relevance

## Observability

### Logging

- Use Pino logger (structured logging)
- Include trace context in logs
- Log levels: debug, info, warn, error
- Avoid logging sensitive data (API keys, user data)

### Metrics

- Prometheus metrics in `backend/src/metrics/`
- Track request counts, durations, errors
- Custom metrics for agent operations and AI calls

### Tracing

- OpenTelemetry spans for all major operations
- Include relevant attributes in spans
- Trace context propagation across services

## API Development

### REST Endpoints

- Follow RESTful conventions
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Return appropriate status codes
- Include error messages in responses
- Document with Swagger/OpenAPI (available at `/api/docs`)

### WebSocket Events

- Use Socket.io for real-time communication
- Event naming: `chat:message`, `agent:response`, etc.
- Include correlation IDs for tracing
- Handle connection errors and reconnection

## Documentation

### Code Documentation

- Document complex algorithms and business logic
- Keep README files updated in subdirectories
- Use JSDoc for exported functions and classes

### Project Documentation

- Main documentation in `docs/` (MkDocs format)
- Update relevant docs when changing features
- Test documentation builds: `npm run docs:validate`

### Markdown Standards

- Follow Markdown linting rules (`.markdownlint.yml`)
- Check links: `npm run docs:links`
- Validate Mermaid diagrams: `npm run docs:mermaid`

## Environment Configuration

### Backend Environment Variables

Required variables in `backend/.env`:

- `OPENAI_API_KEY`: OpenAI API key (optional for demo with RAG)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `ENABLE_TRACING`: Enable OpenTelemetry tracing
- `JAEGER_ENDPOINT`: Jaeger collector endpoint

### Frontend Environment Variables

Optional variables in `frontend/.env`:

- `EXPO_PUBLIC_API_URL`: Backend API URL

## CI/CD

### GitHub Actions

- Workflows in `.github/workflows/`
- CI runs on all PRs: linting, type checking, tests
- Quality checks enforced before merge
- Deployment workflows for staging and production

### Pre-commit Hooks

- Husky configured for pre-commit checks
- Runs linting and formatting on staged files
- Validates Mermaid diagrams in docs

## Common Patterns

### Error Handling

```typescript
// Backend
try {
  const result = await someOperation();
  return res.json({ success: true, data: result });
} catch (error) {
  logger.error({ error }, 'Operation failed');
  return res.status(500).json({ error: 'Internal server error' });
}

// Frontend
try {
  const response = await apiCall();
  setData(response.data);
} catch (error) {
  console.error('API call failed:', error);
  setError('Failed to load data');
}
```

### Async Operations

- Use `async`/`await` for asynchronous code
- Handle promise rejections
- Use proper cancellation for cleanup

### State Management

- React hooks for local state
- Context API for shared state
- Avoid prop drilling

## Performance Considerations

### Backend Performance

- Use connection pooling for databases
- Implement rate limiting for API endpoints
- Cache responses where appropriate
- Monitor memory usage with metrics

### Frontend Performance

- Optimize component re-renders (React.memo, useMemo, useCallback)
- Lazy load screens and components
- Optimize images and assets
- Handle list virtualization for long lists

## Security

### Backend Security

- Validate all user inputs
- Sanitize data before processing
- Use environment variables for secrets
- Implement rate limiting
- Follow OWASP security guidelines

### Frontend Security

- Don't store sensitive data in AsyncStorage
- Validate WebSocket messages
- Handle authentication tokens securely

## Debugging

### Backend Debugging

- Use debug logs during development
- Check OpenTelemetry traces in Jaeger
- Monitor metrics in Grafana
- Use Node.js debugger or IDE debugging

### Frontend Debugging

- React Developer Tools
- Expo Developer Tools
- Network tab for API calls
- React Native Debugger

## Dependencies

### Adding Dependencies

- Check for security vulnerabilities before adding
- Prefer well-maintained packages
- Document why the dependency is needed
- Update package.json and package-lock.json

### Updating Dependencies

- Test thoroughly after updates
- Check for breaking changes
- Update CI/CD if needed

## Best Practices

1. **Write tests first** for critical features (TDD when appropriate)
2. **Keep functions small** and focused on single responsibility
3. **Use meaningful names** for variables, functions, and files
4. **Avoid premature optimization** - profile before optimizing
5. **Document edge cases** and assumptions
6. **Handle errors gracefully** with user-friendly messages
7. **Keep commits atomic** and focused on single changes
8. **Write clear commit messages** following conventional commits
9. **Review your own code** before requesting reviews
10. **Update documentation** as you change code

## Resources

- [Project README](../README.md)
- [API Documentation](http://localhost:3000/api/docs) (when backend is running)
- [Live Documentation](http://example-docs.hugecat.net/)
- [Architecture Overview](../docs/architecture/system-overview.md)
- [Getting Started Guide](../docs/getting-started/quickstart.md)

## Questions or Issues?

- Check existing documentation in `docs/`
- Review related tests for usage examples
- Consult README files in subdirectories
- Look at similar implementations in the codebase
