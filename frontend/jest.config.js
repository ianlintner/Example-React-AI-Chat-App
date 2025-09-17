const isCI = process.env.CI === 'true' || process.env.CI === true;

const config = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.pre.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.(ts|tsx|js)', '**/*.(test|spec).(ts|tsx|js)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'types/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'cobertura',
  ],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.js',
    // Prevent Expo winter runtime from loading in Jest
    '^expo/src/winter/runtime(\\.native)?$': '<rootDir>/__mocks__/expo-winter-runtime.js',
    '^expo/winter/runtime$': '<rootDir>/__mocks__/expo-winter-runtime.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
};

// Make coverage informational in CI by not enforcing thresholds.
// Locally (when CI is not set), keep thresholds to guide improvements.
if (!isCI) {
  config.coverageThreshold = {
    global: {
      branches: 33,
      functions: 61,
      lines: 61,
      statements: 61,
    },
    './components/': {
      branches: 55,
      functions: 64,
      lines: 60,
      statements: 60,
    },
    './hooks/': {
      branches: 66,
      functions: 33,
      lines: 41,
      statements: 41,
    },
  };
}

module.exports = config;
