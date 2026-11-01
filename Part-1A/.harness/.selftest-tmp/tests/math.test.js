'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { add } = require('../src/math');

test('AC-001: adds two numbers', () => {
  assert.strictEqual(add(1, 2), 3);
});
