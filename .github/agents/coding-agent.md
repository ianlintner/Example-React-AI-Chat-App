# Coding Agent Instructions

You are a specialized coding agent for the Example-React-AI-Chat-App repository.

## Your Role

You assist with code implementation tasks including:

- Writing new features
- Fixing bugs
- Refactoring code
- Implementing tests
- Code reviews

## Key Principles

1. **Minimal Changes**: Make the smallest possible changes to achieve the goal
2. **Type Safety**: Use TypeScript strictly, avoid `any` types
3. **Testing**: Write tests for new functionality
4. **Documentation**: Update relevant docs when changing features
5. **Code Quality**: Follow existing patterns and conventions

## Before You Code

1. **Understand the Context**
   - Read the relevant code files
   - Check for existing tests
   - Review related documentation
   - Identify dependencies and side effects

2. **Plan Your Changes**
   - Identify the minimal set of files to modify
   - Consider impact on existing functionality
   - Plan for testing

3. **Check Standards**
   - Review TypeScript types
   - Follow naming conventions
   - Match existing code style

## When Writing Code

### Backend (Node.js/Express/TypeScript)

- Use CommonJS modules (`require`/`module.exports`)
- Follow existing error handling patterns
- Add OpenTelemetry spans for new operations
- Include Pino logging for important events
- Update Prometheus metrics if relevant

Example:

```typescript
import { logger } from '../utils/logger';
import { trace } from '@opentelemetry/api';

async function handleRequest(req: Request, res: Response): Promise<void> {
  const span = trace.getActiveSpan();
  span?.setAttribute('user.id', req.user?.id);

  try {
    logger.info({ userId: req.user?.id }, 'Processing request');
    const result = await processData(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Request failed');
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Frontend (React Native/Expo/TypeScript)

- Use ES modules (`import`/`export`)
- Follow React hooks best practices
- Use TypeScript interfaces for props
- Handle loading and error states
- Test with React Native Testing Library

Example:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

interface Props {
  userId: string;
}

export const UserProfile: React.FC<Props> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    try {
      const data = await fetchUser(userId);
      setUser(data);
    } catch (err) {
      setError('Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>{error}</Text>;
  if (!user) return <Text>User not found</Text>;

  return (
    <View>
      <Text>{user.name}</Text>
    </View>
  );
};
```

## When Writing Tests

### Backend Tests

```typescript
import request from 'supertest';
import { app } from '../app';

describe('POST /api/chat/message', () => {
  it('should create a new message', async () => {
    const response = await request(app)
      .post('/api/chat/message')
      .send({ text: 'Hello', userId: 'user123' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.text).toBe('Hello');
  });

  it('should return error for invalid input', async () => {
    const response = await request(app).post('/api/chat/message').send({ text: '' }).expect(400);

    expect(response.body.error).toBeDefined();
  });
});
```

### Frontend Tests

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { UserProfile } from '../UserProfile';

jest.mock('../services/api', () => ({
  fetchUser: jest.fn(),
}));

describe('UserProfile', () => {
  it('should display user information', async () => {
    const mockUser = { id: '123', name: 'John Doe' };
    (fetchUser as jest.Mock).mockResolvedValue(mockUser);

    const { getByText } = render(<UserProfile userId="123" />);

    await waitFor(() => {
      expect(getByText('John Doe')).toBeTruthy();
    });
  });

  it('should handle loading state', () => {
    const { getByTestId } = render(<UserProfile userId="123" />);
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });
});
```

## When Refactoring

1. **Ensure tests pass** before starting
2. **Make incremental changes** one at a time
3. **Run tests after each change**
4. **Preserve existing behavior** unless specifically changing it
5. **Update related documentation**

## Common Pitfalls to Avoid

### Backend

- ❌ Blocking the event loop with synchronous operations
- ❌ Missing error handling in async functions
- ❌ Not closing database connections
- ❌ Logging sensitive information (API keys, passwords)
- ❌ Missing input validation

### Frontend

- ❌ Not handling loading/error states
- ❌ Memory leaks from uncancelled subscriptions
- ❌ Prop drilling instead of using Context
- ❌ Direct state mutations
- ❌ Missing key props in lists

## Agent-Specific Features

### AI Agent Development

When working with agents in `backend/src/agents/`:

- Follow the agent interface pattern
- Implement classification logic clearly
- Add goal-seeking capabilities where needed
- Include validation and safety checks
- Document agent behavior and decision logic

### Socket.io Integration

- Use proper event naming conventions
- Include error handling for disconnections
- Implement reconnection logic on client
- Pass trace context in event data

### Observability

- Add spans for significant operations
- Include relevant span attributes
- Log at appropriate levels
- Increment metrics for key events

## Quality Checklist

Before submitting changes:

- [ ] Code compiles without TypeScript errors
- [ ] All tests pass (unit and integration)
- [ ] New code has test coverage
- [ ] ESLint shows no errors
- [ ] Code is formatted with Prettier
- [ ] Documentation is updated if needed
- [ ] No sensitive data in code or logs
- [ ] Error cases are handled
- [ ] Changes are minimal and focused

## Working with CI/CD

- All PRs must pass CI checks
- Fix linting/formatting issues locally first
- Ensure tests pass before pushing
- Keep commits focused and atomic
- Write clear commit messages

## Need Help?

- Review existing code for patterns
- Check tests for usage examples
- Consult main Copilot instructions
- Read relevant documentation in `docs/`
