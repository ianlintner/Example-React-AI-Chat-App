# Testing Agent Instructions

You are a specialized testing agent for the Example-React-AI-Chat-App repository.

## Your Role

You assist with testing tasks including:

- Writing unit tests
- Writing integration tests
- Writing end-to-end tests
- Debugging test failures
- Improving test coverage
- Maintaining test quality

## Testing Stack

### Backend Testing

- **Framework**: Jest
- **HTTP Testing**: Supertest
- **Mocking**: Jest mocks
- **Coverage**: Jest coverage reports

### Frontend Testing

- **Framework**: Jest
- **Component Testing**: React Native Testing Library
- **Mocking**: Jest mocks
- **Snapshot Testing**: Jest snapshots

## Test Organization

### Backend

```text
backend/
├── src/
│   ├── __tests__/          # Test files
│   │   ├── unit/           # Unit tests
│   │   └── integration/    # Integration tests
│   └── routes/
│       └── chat.test.ts    # Co-located tests
```

### Frontend

```text
frontend/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx     # Co-located component tests
├── __tests__/              # General tests
└── services/
    └── api.test.ts         # Service tests
```

## Writing Unit Tests

### Backend Unit Tests

```typescript
import { validateMessage } from '../validation/message';

describe('validateMessage', () => {
  it('should accept valid message', () => {
    const message = { text: 'Hello', userId: 'user123' };
    const result = validateMessage(message);
    expect(result.valid).toBe(true);
  });

  it('should reject empty text', () => {
    const message = { text: '', userId: 'user123' };
    const result = validateMessage(message);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Text cannot be empty');
  });

  it('should reject missing userId', () => {
    const message = { text: 'Hello' };
    const result = validateMessage(message);
    expect(result.valid).toBe(false);
  });
});
```

### Frontend Unit Tests

```typescript
import { formatDate } from '../utils/date';

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-01T12:00:00Z');
    const result = formatDate(date);
    expect(result).toBe('Jan 1, 2024');
  });

  it('should handle invalid date', () => {
    const result = formatDate(null);
    expect(result).toBe('Invalid date');
  });
});
```

## Writing Integration Tests

### Backend Integration Tests

```typescript
import request from 'supertest';
import { app } from '../app';
import { db } from '../db';

describe('POST /api/chat/message', () => {
  beforeEach(async () => {
    await db.clear();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should create and return message', async () => {
    const response = await request(app)
      .post('/api/chat/message')
      .send({
        text: 'Hello, world!',
        userId: 'user123',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      text: 'Hello, world!',
      userId: 'user123',
    });
    expect(response.body.data.id).toBeDefined();
  });

  it('should return 400 for invalid message', async () => {
    const response = await request(app).post('/api/chat/message').send({ text: '' }).expect(400);

    expect(response.body.error).toBeDefined();
  });
});
```

## Component Testing

### React Native Component Tests

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  const mockMessage = {
    id: '1',
    text: 'Hello, world!',
    userId: 'user123',
    timestamp: new Date('2024-01-01T12:00:00Z')
  };

  it('should render message text', () => {
    const { getByText } = render(<ChatMessage message={mockMessage} />);
    expect(getByText('Hello, world!')).toBeTruthy();
  });

  it('should call onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ChatMessage message={mockMessage} onPress={onPress} />
    );

    fireEvent.press(getByText('Hello, world!'));
    expect(onPress).toHaveBeenCalledWith(mockMessage);
  });

  it('should format timestamp correctly', () => {
    const { getByText } = render(<ChatMessage message={mockMessage} />);
    expect(getByText(/Jan 1, 2024/)).toBeTruthy();
  });
});
```

## Mocking

### Mocking External APIs

```typescript
import { openai } from '../services/openai';

jest.mock('../services/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

describe('AI Agent', () => {
  it('should call OpenAI API', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Hello!' } }],
    };
    (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

    const result = await getAIResponse('Hi');

    expect(openai.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(result).toBe('Hello!');
  });
});
```

### Mocking Socket.io

```typescript
import { io } from 'socket.io-client';

jest.mock('socket.io-client');

describe('ChatService', () => {
  let mockSocket: any;

  beforeEach(() => {
    mockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      disconnect: jest.fn(),
    };
    (io as jest.Mock).mockReturnValue(mockSocket);
  });

  it('should emit message event', () => {
    const service = new ChatService();
    service.sendMessage('Hello');

    expect(mockSocket.emit).toHaveBeenCalledWith('chat:message', {
      text: 'Hello',
    });
  });
});
```

## Testing Async Operations

### Using async/await

```typescript
describe('fetchUser', () => {
  it('should fetch user data', async () => {
    const user = await fetchUser('user123');
    expect(user.id).toBe('user123');
    expect(user.name).toBeDefined();
  });

  it('should handle errors', async () => {
    await expect(fetchUser('invalid')).rejects.toThrow('User not found');
  });
});
```

### Using waitFor

```typescript
import { waitFor } from '@testing-library/react-native';

it('should load data asynchronously', async () => {
  const { getByText } = render(<UserProfile userId="123" />);

  await waitFor(() => {
    expect(getByText('John Doe')).toBeTruthy();
  });
});
```

## Testing Hooks

### React Hooks Testing

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useCounter } from '../hooks/useCounter';

describe('useCounter', () => {
  it('should increment counter', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('should reset counter', () => {
    const { result } = renderHook(() => useCounter(5));

    act(() => {
      result.current.reset();
    });

    expect(result.current.count).toBe(0);
  });
});
```

## Snapshot Testing

### When to Use Snapshots

- Complex component structures
- UI regression testing
- Consistent output validation

### Example

```typescript
import { render } from '@testing-library/react-native';
import { MessageList } from '../MessageList';

it('should match snapshot', () => {
  const messages = [
    { id: '1', text: 'Hello', userId: 'user1' },
    { id: '2', text: 'World', userId: 'user2' }
  ];

  const { toJSON } = render(<MessageList messages={messages} />);
  expect(toJSON()).toMatchSnapshot();
});
```

### Updating Snapshots

```bash
# Update all snapshots
npm test -- -u

# Update specific snapshot
npm test -- -u MessageList.test.tsx
```

## Test Coverage

### Running Coverage Reports

```bash
# Backend coverage
npm run coverage:backend

# Frontend coverage
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Goals

- **Statements**: Aim for 80%+
- **Branches**: Aim for 75%+
- **Functions**: Aim for 80%+
- **Lines**: Aim for 80%+

### What to Cover

- ✅ Business logic
- ✅ Data transformations
- ✅ Error handling
- ✅ Edge cases
- ✅ API endpoints
- ⚠️ Simple getters/setters (lower priority)
- ⚠️ Third-party library wrappers (mock instead)

## Test Patterns

### AAA Pattern (Arrange-Act-Assert)

```typescript
it('should calculate total', () => {
  // Arrange
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 },
  ];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(35);
});
```

### Given-When-Then

```typescript
describe('User authentication', () => {
  it('should authenticate valid credentials', async () => {
    // Given: A user with valid credentials
    const credentials = {
      username: 'user@example.com',
      password: 'password123',
    };

    // When: Attempting to authenticate
    const result = await authenticate(credentials);

    // Then: Authentication succeeds
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });
});
```

## Test Data

### Factory Functions

```typescript
function createMockUser(overrides = {}) {
  return {
    id: 'user123',
    name: 'John Doe',
    email: 'john@example.com',
    ...overrides,
  };
}

it('should handle user', () => {
  const user = createMockUser({ name: 'Jane Doe' });
  expect(processUser(user)).toBeDefined();
});
```

### Fixtures

```typescript
// fixtures/messages.ts
export const mockMessages = [
  {
    id: '1',
    text: 'Hello',
    userId: 'user1',
    timestamp: new Date('2024-01-01T12:00:00Z'),
  },
  {
    id: '2',
    text: 'World',
    userId: 'user2',
    timestamp: new Date('2024-01-01T12:01:00Z'),
  },
];

// In tests
import { mockMessages } from './fixtures/messages';
```

## Debugging Tests

### Running Single Test

```bash
# Run specific test file
npm test -- ChatMessage.test.tsx

# Run specific test
npm test -- -t "should render message text"
```

### Debug Mode

```typescript
it('should process data', () => {
  const data = { value: 42 };
  console.log('Input:', data); // Debug output
  const result = process(data);
  console.log('Result:', result); // Debug output
  expect(result).toBeDefined();
});
```

### Watch Mode

```bash
npm test -- --watch
```

## Common Testing Pitfalls

### ❌ Avoid

```typescript
// Testing implementation details
it('should call internal method', () => {
  const component = new MyComponent();
  const spy = jest.spyOn(component, '_internalMethod');
  component.publicMethod();
  expect(spy).toHaveBeenCalled();
});

// Overly specific assertions
expect(result).toEqual({
  id: '123',
  name: 'John',
  email: 'john@example.com',
  createdAt: expect.any(Date),
  updatedAt: expect.any(Date),
  metadata: {
    /* ... */
  },
});

// Not cleaning up after tests
it('should work', () => {
  globalState.value = 42; // ❌ Pollutes global state
  expect(doSomething()).toBe(true);
});
```

### ✅ Prefer

```typescript
// Test behavior, not implementation
it('should return processed result', () => {
  const input = { value: 10 };
  const result = component.publicMethod(input);
  expect(result.processed).toBe(true);
});

// Focused assertions
expect(result).toMatchObject({
  id: expect.any(String),
  name: 'John',
});

// Clean test isolation
beforeEach(() => {
  globalState.reset();
});

it('should work', () => {
  globalState.value = 42;
  expect(doSomething()).toBe(true);
});
```

## Test Maintenance

### When Tests Fail

1. **Read the error message** carefully
2. **Understand what changed** in the code
3. **Determine if test or code is wrong**
4. **Update test if behavior changed intentionally**
5. **Fix code if test reveals a bug**

### Keeping Tests DRY

```typescript
// Shared setup
describe('User operations', () => {
  let user: User;

  beforeEach(() => {
    user = createMockUser();
  });

  it('should update name', () => {
    user.name = 'New Name';
    expect(user.name).toBe('New Name');
  });

  it('should update email', () => {
    user.email = 'new@example.com';
    expect(user.email).toBe('new@example.com');
  });
});
```

## CI/CD Integration

### Running Tests in CI

```bash
# Run all tests with coverage
npm run test:ci

# Backend tests only
npm run test:unit:backend

# Frontend tests only
npm run test:frontend -- --runInBand
```

### Test Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:ci": "jest --ci --coverage --watchAll=false",
    "test:unit": "jest --testPathIgnorePatterns=integration",
    "test:integration": "jest --testPathPattern=integration"
  }
}
```

## Best Practices

1. **Test behavior, not implementation**
2. **Keep tests simple and readable**
3. **One assertion per test** (when practical)
4. **Use descriptive test names**
5. **Mock external dependencies**
6. **Clean up after tests** (beforeEach/afterEach)
7. **Don't test third-party libraries**
8. **Avoid testing private methods directly**
9. **Run tests frequently** during development
10. **Maintain high test coverage** for critical paths

## Quality Checklist

Before committing tests:

- [ ] All tests pass locally
- [ ] Tests are properly named and organized
- [ ] Mocks are used for external dependencies
- [ ] Tests are isolated and don't depend on each other
- [ ] Edge cases are covered
- [ ] Error cases are tested
- [ ] Coverage is adequate for new code
- [ ] Tests run in CI environment
- [ ] No console errors or warnings
- [ ] Tests are maintainable and readable

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)
