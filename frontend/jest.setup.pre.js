// Early Jest setup to avoid Expo winter runtime importing during tests
// These mocks run before the environment is set up and before other setup files.

// Reduce noisy logs during tests unless explicitly overridden
process.env.EXPO_PUBLIC_LOG_LEVEL =
  process.env.EXPO_PUBLIC_LOG_LEVEL || 'error';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

// Expo SDK 53’s import.meta polyfill can get pulled in via transforms. Stub it out early.
try {
  // Native/runtime variants used by Metro platform resolution
  jest.doMock('expo/src/winter/runtime.native', () => ({}));
  jest.doMock('expo/src/winter/runtime', () => ({}));
  // In case any code resolves via the package root alias
  jest.doMock('expo/winter/runtime', () => ({}));
} catch (_) {
  // If these files don’t resolve in some envs, swallow the error.
}

// Provide a minimal ImportMetaRegistry so any transformed `import.meta` reads don’t blow up
if (!globalThis.__ExpoImportMetaRegistry) {
  Object.defineProperty(globalThis, '__ExpoImportMetaRegistry', {
    configurable: true,
    enumerable: false,
    get() {
      return { url: null };
    },
  });
}
