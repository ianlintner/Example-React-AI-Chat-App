# Testing and CI Setup

This document describes the comprehensive testing and continuous integration setup for the React AI Chat App.

## Overview

The project now includes:
- **Backend Tests**: Jest-based testing with comprehensive coverage
- **Frontend Tests**: Vitest + React Testing Library for component and utility testing
- **GitHub Actions CI**: Automated testing and building on push/PR
- **Local CI Validation**: Script to test CI pipeline locally

## Backend Testing

### Framework: Jest
- **Location**: `backend/src/__tests__/` and `backend/src/agents/__tests__/`
- **Configuration**: `backend/jest.config.js`
- **Setup**: `backend/src/__tests__/setup.ts`

### Test Coverage
- ✅ **RAG Service Tests** (`ragService.test.ts`): Content database, search functionality, agent-specific content retrieval
- ✅ **Agent Classifier Tests** (`classifier.test.ts`): Message classification for different agent types

### Running Backend Tests
```bash
cd backend
npm test              # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Frontend Testing

### Framework: Vitest + React Testing Library
- **Location**: `frontend/src/**/__tests__/`
- **Configuration**: `frontend/vitest.config.ts`
- **Setup**: `frontend/src/test/setup.ts`
- **TypeScript Config**: `frontend/tsconfig.test.json`

### Test Coverage
- ✅ **ChatWindow Component Tests** (10 tests): Conversation rendering, message display, agent indicators, streaming states
- ✅ **Utility Function Tests** (6 tests): Date formatting, email validation, text truncation

### Running Frontend Tests
```bash
cd frontend
npm test              # Run tests in watch mode
npm run test:ci       # Run tests once (CI mode)
npm run test:ui       # Run tests with UI interface
npm run test:coverage # Run tests with coverage report
```

## GitHub Actions CI

### Workflow: `.github/workflows/ci.yml`

The CI pipeline runs on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

### Jobs

#### 1. Backend Test Job
- Installs Node.js 18
- Runs `npm ci` for clean dependency installation
- Executes backend tests with `npm test`
- Builds backend with `npm run build`

#### 2. Frontend Test Job
- Installs Node.js 18
- Runs `npm ci` for clean dependency installation
- Executes frontend tests with `npm run test:ci`
- Runs ESLint with `npm run lint`
- Builds frontend with `npm run build`

#### 3. Integration Test Job
- Depends on both backend and frontend jobs passing
- Verifies both builds completed successfully
- Lists build artifacts to confirm proper compilation

### CI Features
- ✅ Parallel execution of backend and frontend tests
- ✅ Proper Node.js version and dependency caching
- ✅ Clean npm ci installation for reproducible builds
- ✅ Comprehensive error handling
- ✅ Build artifact verification

## Local CI Validation

### Script: `test-ci-locally.bat`

This script replicates the CI pipeline locally:

```bash
test-ci-locally.bat
```

The script:
1. Installs backend dependencies and runs tests/build
2. Installs frontend dependencies and runs tests/linting/build
3. Provides clear success/failure feedback
4. Exits with proper error codes for scripting

## Test Statistics

### Current Test Coverage
- **Backend**: 2 test files with comprehensive agent system coverage
- **Frontend**: 2 test files with 16 total tests covering core components
- **Total**: 18+ tests across the application

### Test Types
- **Unit Tests**: Individual function and component testing
- **Integration Tests**: Service interaction testing
- **Component Tests**: React component rendering and behavior
- **Utility Tests**: Helper function validation

## Development Workflow

### Adding New Tests

#### Backend Tests
```bash
# Create test file in appropriate directory
backend/src/[module]/__tests__/[module].test.ts

# Follow existing patterns:
describe('Module Name', () => {
  test('should do something', async () => {
    // Test implementation
  });
});
```

#### Frontend Tests
```bash
# Create test file alongside component
frontend/src/components/__tests__/ComponentName.test.tsx

# Use React Testing Library:
import { render, screen } from '@testing-library/react'
import Component from '../Component'

describe('Component', () => {
  it('should render correctly', () => {
    render(<Component />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })
})
```

### Running Tests Before Commits

1. **Quick Test**: `npm test` in respective directories
2. **Full CI Check**: Run `test-ci-locally.bat`
3. **Coverage Check**: `npm run test:coverage`

## Continuous Integration Benefits

- ✅ **Automated Quality Assurance**: Every code change is tested
- ✅ **Build Verification**: Ensures deployable artifacts
- ✅ **Parallel Processing**: Fast feedback on multiple test suites
- ✅ **Branch Protection**: Prevents broken code from reaching main branches
- ✅ **Developer Confidence**: Immediate feedback on code changes

## Next Steps

Consider adding:
- **End-to-End Tests**: Cypress or Playwright for full user journey testing
- **Visual Regression Tests**: Component screenshot comparisons
- **Performance Tests**: Bundle size and runtime performance monitoring
- **Security Scanning**: Dependency vulnerability checks
- **Code Coverage Reports**: Integration with services like Codecov

The current setup provides a solid foundation for maintaining code quality and preventing regressions as the project grows.
