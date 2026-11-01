'use strict';

// SECURITY / SAST GATE configuration (eslint-plugin-security).
// Protected file: the coding agent must not edit it.
//
// Deliberate, documented decision made BEFORE implementation:
//   security/detect-non-literal-fs-filename is OFF because a JSON-file CLI must open a
//   path that comes from configuration, so the rule would flag every storage call and
//   could only be "fixed" by suppression, which this harness forbids. Mention this as a
//   known limitation in evidence/harness-log.md.
const security = require('eslint-plugin-security');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'evidence/**', '.harness/**', 'tests/**'] },
  security.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
];