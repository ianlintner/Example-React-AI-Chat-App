module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:prettier/recommended',
  ],
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'error',
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    curly: ['warn', 'all'],
    'no-throw-literal': 'error',
    'prefer-template': 'warn',
    'prettier/prettier': 'error',
    '@typescript-eslint/no-var-requires': 'off',
  },
  overrides: [
    {
      files: ['**/__tests__/**/*', '**/*.test.ts', '**/*.test.tsx', '**/*.integration.test.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-types': 'off',
        'no-console': 'off',
        'prefer-template': 'off'
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.js',
    '!.eslintrc.js',
  ],
};
