'use strict';

// LINT GATE configuration (feedforward rule set).
// Protected file: the coding agent must not edit it (see .harness/harness-rules.md).
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'evidence/**', '.harness/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-shadow': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      complexity: ['error', 12],
    },
  },
];