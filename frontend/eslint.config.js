const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const prettier = require('eslint-plugin-prettier');
const testingLibrary = require('eslint-plugin-testing-library');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  js.configs.recommended,
  ...compat.extends(
    'expo',
    '@react-native',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react-native/all',
    'prettier'
  ),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        __DEV__: 'readonly',
        ...require('globals').browser,
        ...require('globals').es2022,
        ...require('globals').node,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
      '@typescript-eslint': typescriptEslint,
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
      '@typescript-eslint/prefer-const': 'error',
      '@typescript-eslint/no-var-requires': 'off',

      // React rules
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'warn',
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
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': ['error', 'never'],
      'arrow-spacing': 'error',
      'comma-dangle': ['error', 'always-multiline'],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'jsx-quotes': ['error', 'prefer-double'],

      // Prettier integration
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          trailingComma: 'always',
          semi: true,
          printWidth: 100,
          tabWidth: 2,
          useTabs: false,
          endOfLine: 'lf',
        },
      ],
    },
  },
  // Test files configuration
  {
    files: ['**/__tests__/**/*', '**/*.test.{js,jsx,ts,tsx}'],
    plugins: {
      'testing-library': testingLibrary,
    },
    languageOptions: {
      globals: {
        ...require('globals').jest,
      },
    },
    rules: {
      ...testingLibrary.configs.react.rules,
      'react-native/no-raw-text': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // JavaScript files configuration
  {
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
];
