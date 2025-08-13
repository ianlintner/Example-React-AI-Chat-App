const isCI = process.env.CI === 'true' || process.env.CI === true;

const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/__tests__/**',
    '!src/demo/**',
    '!src/**/*.config.ts',
    '!src/**/*.types.ts',
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
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: '50%',
  bail: false,
  passWithNoTests: true,
  errorOnDeprecated: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

// Make coverage informational in CI by not enforcing thresholds.
// Locally (when CI is not set), keep thresholds to guide improvements.
if (!isCI) {
  config.coverageThreshold = {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/agents/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/routes/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  };
}

module.exports = config;
