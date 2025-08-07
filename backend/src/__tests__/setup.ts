// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '0'; // Use random available port for tests

// Global tracing mocks
jest.mock('../tracing/tracer', () => {
  const mockSpan = {
    setAttributes: jest.fn(),
    setStatus: jest.fn(),
    addEvent: jest.fn(),
    end: jest.fn(),
  };

  return {
    tracer: {
      startSpan: jest.fn(() => mockSpan),
    },
    createConversationSpan: jest.fn(() => mockSpan),
    createAgentSpan: jest.fn(() => mockSpan),
    createValidationSpan: jest.fn(() => mockSpan),
    createGoalSeekingSpan: jest.fn(() => mockSpan),
    endSpan: jest.fn(),
    setSpanStatus: jest.fn(),
    addSpanEvent: jest.fn(),
    initializeTracing: jest.fn(),
    context: {},
  };
});

// Global test configuration
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Setup code before all tests
  console.log('🧪 Starting test suite');
});

afterAll(async () => {
  // Cleanup code after all tests
  // Close any database connections, Redis connections, etc.
  console.log('✅ Test suite completed');
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
});

// Mock console methods to reduce noise in tests (only for unit tests)
if (!process.env.INTEGRATION_TESTS) {
  const originalConsole = global.console;
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // Keep warn and error for important messages
    warn: originalConsole.warn,
    error: originalConsole.error,
  };
}
