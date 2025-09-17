const originalError = console.error;

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    // Suppress expected error logs during tests
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('❌ Error processing message') ||
        args[0].includes('💀 Message') ||
        args[0].includes('Failed to connect to Redis') ||
        args[0].includes('Error processing delayed messages') ||
        args[0].includes('Error dequeuing') ||
        args[0].includes('Error peeking queue') ||
        args[0].includes('Redis health check failed'))
    ) {
      return;
    }
    originalError.apply(console, args);
  });
});

afterAll(() => {
  if (console.error && typeof (console.error).mockRestore === 'function') {
    console.error.mockRestore();
  }
});
