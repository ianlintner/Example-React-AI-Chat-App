# Contributing to Example React AI Chat App

Thank you for your interest in contributing to this project! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [GitHub Copilot](#github-copilot)

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Expo CLI: `npm i -g @expo/cli`
- Optional: OpenAI API key
- Optional: Docker (for monitoring stack)

### Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/Example-React-AI-Chat-App.git
   cd Example-React-AI-Chat-App
   ```

2. Install dependencies:

   ```bash
   npm run install:all
   ```

3. Create environment files:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

4. Add your OpenAI API key to `backend/.env` (optional for demo):

   ```text
   OPENAI_API_KEY=your_key_here
   ```

5. Start the development servers:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates

Examples:

- `feature/add-user-profiles`
- `fix/message-timestamp-bug`
- `docs/update-api-documentation`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Test additions or updates
- `chore:` - Maintenance tasks

Examples:

```text
feat(chat): add message reactions
fix(api): resolve CORS issue on production
docs(readme): update setup instructions
test(agents): add unit tests for RAG agent
```

## Code Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict type checking
- Avoid `any` types - use proper type definitions
- Export types and interfaces for shared use

### Code Style

- **Formatting**: Prettier (automatic via pre-commit hooks)
- **Linting**: ESLint (automatic via pre-commit hooks)
- **Line Length**: Max 100 characters
- **Naming Conventions**:
  - `camelCase` for variables and functions
  - `PascalCase` for components and classes
  - `UPPER_CASE` for constants

### Comments

- Add JSDoc comments for public APIs
- Document complex algorithms and business logic
- Explain "why" not "what" in comments
- Keep inline comments minimal and meaningful

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:backend
npm run test:frontend
npm run test:unit
npm run test:integration

# Run with coverage
npm run coverage

# Run in watch mode
npm run test:watch
```

### Writing Tests

- Place tests near the code they test (co-located)
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies
- Test both success and error cases
- Maintain test coverage above 80%

See [Testing Agent Instructions](.github/agents/testing-agent.md) for detailed guidelines.

## Documentation

### Code Documentation

- Update relevant docs when changing features
- Keep README files current in subdirectories
- Use JSDoc for exported functions and classes

### Project Documentation

Documentation is in `docs/` using MkDocs format:

```bash
# Preview documentation locally
mkdocs serve

# Or use Docker
docker-compose up docs
```

### Markdown Standards

- Follow `.markdownlint.yml` rules
- Validate links: `npm run docs:links`
- Check Mermaid diagrams: `npm run docs:mermaid`

See [Documentation Agent Instructions](.github/agents/documentation-agent.md) for detailed guidelines.

## Pull Request Process

### Before Submitting

1. **Update your branch**:

   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run quality checks**:

   ```bash
   npm run lint
   npm run format:check
   npm run type-check
   npm test
   ```

3. **Update documentation** if needed

4. **Test your changes** thoroughly

### Submitting the PR

1. Push your branch to your fork:

   ```bash
   git push origin your-branch-name
   ```

2. Create a pull request on GitHub

3. Fill out the PR template completely

4. Link related issues (e.g., "Closes #123")

5. Request review from maintainers

### PR Review

- Address review comments promptly
- Keep discussions focused and respectful
- Update PR based on feedback
- Ensure CI checks pass

### After Merge

- Delete your feature branch
- Update your local main branch:
  ```bash
  git checkout main
  git pull origin main
  ```

## GitHub Copilot

This repository includes GitHub Copilot Agent Instructions to help with development. If you use GitHub Copilot, it will automatically reference these instructions to provide better context-aware suggestions.

### Copilot Instructions

- **Main Instructions**: [.github/copilot-instructions.md](.github/copilot-instructions.md)
- **Coding Agent**: [.github/agents/coding-agent.md](.github/agents/coding-agent.md)
- **Documentation Agent**: [.github/agents/documentation-agent.md](.github/agents/documentation-agent.md)
- **Testing Agent**: [.github/agents/testing-agent.md](.github/agents/testing-agent.md)

These instructions include:

- Project structure and architecture
- Coding standards and patterns
- Testing guidelines
- Documentation standards
- Common patterns and examples

## Code Review Guidelines

### For Authors

- Keep PRs focused and reasonably sized
- Provide context in the PR description
- Respond to comments constructively
- Test your changes thoroughly

### For Reviewers

- Be respectful and constructive
- Focus on code quality and maintainability
- Test the changes if possible
- Approve when satisfied with the changes

## Quality Checks

The following checks run automatically on PRs:

### Linting

```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

### Type Checking

```bash
npm run type-check
```

### Formatting

```bash
npm run format
npm run format:check
```

### Tests

```bash
npm test
npm run test:ci  # CI mode with coverage
```

## Pre-commit Hooks

Husky runs automatic checks before commits:

- Linting on staged files
- Formatting on staged files
- Mermaid diagram validation

To bypass (use sparingly):

```bash
git commit --no-verify
```

## Common Issues

### Dependencies

If you encounter dependency issues:

```bash
# Clean and reinstall
npm run clean
npm run install:all
```

### Environment Variables

Make sure environment files are configured:

- `backend/.env` - Backend configuration
- `frontend/.env` - Frontend configuration (optional)

### Port Conflicts

Default ports:

- Backend: 3000
- Frontend: 8081 (Expo)
- Grafana: 5001
- Prometheus: 9090

Change ports in `.env` files if conflicts occur.

## Getting Help

- **Documentation**: Check the [docs/](docs/) directory
- **Issues**: Browse existing [GitHub Issues](https://github.com/ianlintner/Example-React-AI-Chat-App/issues)
- **Discussions**: Start a [GitHub Discussion](https://github.com/ianlintner/Example-React-AI-Chat-App/discussions)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Collaborate openly

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

If you have questions about contributing:

1. Check this document and the project documentation
2. Search existing issues and discussions
3. Open a new issue with the `question` label
4. Reach out to maintainers

Thank you for contributing! 🚀
