const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const prettier = require('eslint-plugin-prettier');
const globals = require('globals');

module.exports = [
  // Ignore patterns first
  {
    ignores: [
      'coverage/**',
      'dist/**', 
      '.expo/**',
      'node_modules/**',
      'build/**',
      'public/**',
      '*.config.js',
      'jest.setup.js',
      'scripts/**',
      '**/*.bundle.js',
      '**/*.min.js',
    ],
  },
  
  // Base JavaScript configuration
  js.configs.recommended,
  
  // Main configuration for TypeScript and React files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        __DEV__: 'readonly',
        process: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
      prettier,
    },
    settings: {
      react: {
        version: 'detect',
      },
      'react-native/style-sheet-object-names': ['StyleSheet', 'styles'],
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-require-imports': 'off',

      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'warn',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native specific rules
      'react-native/no-unused-styles': 'error',
      'react-native/no-inline-styles': 'warn',
      'react-native/no-color-literals': 'warn',
      'react-native/split-platform-components': 'off',
      'react-native/no-raw-text': 'off',
      'react-native/no-single-element-style-arrays': 'error',

      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
      'no-undef': 'off', // Handled by TypeScript
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': ['error', 'never'],
      'arrow-spacing': 'error',
      // Remove conflicting comma-dangle rule - handled by Prettier
      'semi': 'off', // Handled by Prettier
      'quotes': 'off', // Handled by Prettier
      'jsx-quotes': 'off', // Handled by Prettier

      // Prettier integration - let Prettier handle all formatting
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          jsxSingleQuote: true,
          trailingComma: 'all',
          semi: true,
          printWidth: 80,
          tabWidth: 2,
          useTabs: false,
          endOfLine: 'lf',
          bracketSpacing: true,
          bracketSameLine: false,
          arrowParens: 'avoid',
        },
      ],
    },
  },
  
  // Test files configuration
  {
    files: ['**/__tests__/**/*', '**/*.test.{js,jsx,ts,tsx}', '**/__mocks__/**/*'],
    languageOptions: {
      globals: {
        ...globals.jest,
        global: 'writable',
        process: 'readonly',
        require: 'readonly',
        jest: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      'react-native/no-raw-text': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  
  // Node.js files configuration
  {
    files: ['**/*.config.js', 'jest.setup.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        process: 'readonly',
        global: 'writable',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
      'no-console': 'off',
    },
  },
];
