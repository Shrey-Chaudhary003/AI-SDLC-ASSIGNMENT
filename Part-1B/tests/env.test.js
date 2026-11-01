'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { getConfig, loadEnv } = require('../src/env');

test('loadEnv accepts supported values and preserves existing environment values', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'reminder-env-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, '.env');
  fs.writeFileSync(file, [
    '',
    '# ignored',
    'GEMINI_API_KEY=sample-test-key',
    'LLM_MODEL="sample-model"',
    'UNSUPPORTED=value',
    'MALFORMED',
  ].join('\n'));

  const env = { GEMINI_API_KEY: 'existing-test-key' };
  loadEnv(file, env);
  assert.equal(env.GEMINI_API_KEY, 'existing-test-key');
  assert.equal(env.LLM_MODEL, 'sample-model');
  assert.equal(env.UNSUPPORTED, undefined);
  assert.equal(env.MALFORMED, undefined);
});

test('loadEnv leaves a missing optional .env file alone', () => {
  const env = {};
  loadEnv(path.join(os.tmpdir(), 'reminder-agent-missing-env-file'), env);
  assert.deepEqual(env, {});
});

test('getConfig requires both values and does not expose a key in its public configuration shape', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'reminder-config-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, '.env');
  fs.writeFileSync(file, 'GEMINI_API_KEY=sample-test-key\nLLM_MODEL=sample-model\n');

  const runtime = getConfig({ filePath: file, env: {} });
  assert.equal(runtime.provider, 'gemini');
  assert.equal(runtime.model, 'sample-model');
  assert.equal(runtime.temperature, 0.1);
  assert.equal(runtime.apiKey, 'sample-test-key');

  assert.throws(
    () => getConfig({ filePath: path.join(directory, 'missing'), env: {} }),
    (error) => error.code === 'CONFIG_ERROR',
  );
});
