# Code Quality Setup Guide

This document outlines the comprehensive code quality tools and processes implemented in this project.

## Overview

The project now includes:

- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier for consistent code style
- **Testing**: Jest with comprehensive coverage reporting
- **Pre-commit hooks**: Husky + lint-staged
- **CI/CD**: GitHub Actions for automated quality checks
- **Security**: Vulnerability scanning with Trivy

## Tools Configuration

### ESLint

- **Backend**: TypeScript-specific rules with Prettier integration
- **Frontend**: React Native + TypeScript rules with Prettier integration
- **Rules**: Strict typing, consistent styling, React best practices

### Prettier

- Consistent code formatting across all file types
- Integration with ESLint to prevent conflicts
- Pre-commit hook ensures all code is formatted

### Jest Testing

- **Backend Coverage Thresholds**: 80% (85% for agents, 75% for routes)
- **Frontend Coverage Thresholds**: 70% (75% for components, 80% for hooks)
- Multiple coverage formats: HTML, LCOV, JSON, Cobertura
- Separate unit and integration test configurations

### Husky Pre-commit Hooks

- Automatic linting and formatting before commits
- TypeScript type checking
- Prevents broken code from being committed

## Available Scripts

### Root Level Commands

```bash
# Formatting
npm run format              # Format all files
npm run format:check        # Check formatting without changes
npm run format:backend      # Format backend only
npm run format:frontend     # Format frontend only

# Linting
npm run lint               # Lint all code
npm run lint:fix           # Fix linting issues
npm run lint:backend       # Lint backend only
npm run lint:frontend      # Lint frontend only

# Type Checking
npm run type-check         # Check all TypeScript
npm run type-check:backend # Check backend TypeScript
npm run type-check:frontend # Check frontend TypeScript

# Testing & Coverage
npm run coverage           # Run tests with coverage
npm run coverage:backend   # Backend coverage only
npm run coverage:merge     # Merge coverage reports
npm run coverage:report    # Generate coverage reports
```

### Backend Commands

```bash
cd backend

# Testing
npm test                   # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage      # Tests with coverage
npm run test:watch         # Watch mode

# Code Quality
npm run lint               # Lint TypeScript files
npm run lint:fix           # Fix linting issues
npm run format             # Format code
npm run format:check       # Check formatting
npm run typecheck          # TypeScript checking
```

### Frontend Commands

```bash
cd frontend

# Testing
npm test                   # Run tests
npm run test:watch         # Watch mode
npm run test:coverage      # Tests with coverage
npm run test:ci            # CI mode

# Code Quality
npm run lint               # Lint files
npm run lint:fix           # Fix linting issues
npm run format             # Format code
npm run format:check       # Check formatting
npm run type-check         # TypeScript checking
```

## Coverage Thresholds

### Backend

- **Global**: 80% across all metrics
- **Agents Module**: 85% (critical business logic)
- **Routes Module**: 75% (API endpoints)

### Frontend

- **Global**: 70% across all metrics
- **Components**: 75% (UI components)
- **Hooks**: 80% (custom React hooks)

## CI/CD Integration

### Quality Checks Workflow

The GitHub Actions workflow runs on every push and PR:

1. **Multi-Node Testing**: Tests on Node.js 18.x and 20.x
2. **Code Formatting**: Prettier format checking
3. **Linting**: ESLint checks for all code
4. **Type Checking**: TypeScript compilation
5. **Testing**: Full test suite with coverage
6. **Security Scanning**: Trivy vulnerability scan
7. **Dependency Audit**: npm audit for security issues
8. **Coverage Upload**: Codecov integration

### Security Features

- **Trivy Scanner**: Identifies vulnerabilities in dependencies
- **Dependency Audit**: High-level security issue detection
- **SARIF Upload**: Security results integrated with GitHub

## Pre-commit Process

When you commit code, the following happens automatically:

1. **lint-staged** runs on changed files:
   - ESLint fixes issues
   - Prettier formats code
2. **TypeScript** type checking
3. **Success**: Commit proceeds if all checks pass
4. **Failure**: Commit blocked with error details

## Configuration Files

### Core Configuration

- `.prettierrc` - Prettier formatting rules
- `.prettierignore` - Files to skip formatting
- `codecov.yml` - Coverage reporting config
- `.husky/pre-commit` - Pre-commit hook script

### Backend Configuration

- `backend/.eslintrc.js` - ESLint rules
- `backend/jest.config.js` - Jest testing config

### Frontend Configuration

- `frontend/eslint.config.js` - ESLint rules
- `frontend/jest.config.js` - Jest testing config
- `frontend/jest.setup.js` - Test environment setup

## Getting Started

1. **Install Dependencies**:

   ```bash
   npm run install:all
   ```

2. **Setup Git Hooks**:

   ```bash
   npm run prepare
   ```

3. **Run Quality Checks**:

   ```bash
   npm run lint
   npm run format:check
   npm run type-check
   npm run coverage
   ```

4. **Fix Issues**:
   ```bash
   npm run lint:fix
   npm run format
   ```

## Best Practices

### Writing Tests

- Aim for high coverage but focus on quality
- Test critical business logic thoroughly
- Use descriptive test names
- Mock external dependencies
- Test both happy and error paths

### Code Style

- Let Prettier handle formatting
- Follow ESLint rules for best practices
- Use TypeScript strictly (avoid `any`)
- Keep functions small and focused
- Write self-documenting code

### Git Workflow

- Commit frequently with descriptive messages
- Let pre-commit hooks catch issues early
- Review coverage reports in PRs
- Address security vulnerabilities promptly

## Troubleshooting

### Common Issues

1. **Pre-commit Hook Fails**:
   - Run `npm run lint:fix` and `npm run format`
   - Check TypeScript errors with `npm run type-check`

2. **Coverage Below Threshold**:
   - Add tests for uncovered code paths
   - Review coverage reports in `coverage/` directory

3. **ESLint Conflicts**:
   - Rules are configured to work with Prettier
   - Run `npm run lint:fix` to auto-fix issues

4. **Type Errors**:
   - Fix TypeScript issues before committing
   - Use `npm run type-check` to identify problems

For more details, see the individual configuration files and CI/CD workflow definitions.
