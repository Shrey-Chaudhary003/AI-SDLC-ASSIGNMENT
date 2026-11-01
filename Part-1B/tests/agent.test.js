'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const previousKey = process.env.GEMINI_API_KEY;
const previousModel = process.env.LLM_MODEL;
process.env.GEMINI_API_KEY = 'unit-test-key-not-a-credential';
process.env.LLM_MODEL = 'unit-test-model';
const { config, parseReminder } = require('../src/agent');

test.after(() => {
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = previousKey;
  if (previousModel === undefined) delete process.env.LLM_MODEL;
  else process.env.LLM_MODEL = previousModel;
});

function providerResponse(text) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

function validOutput() {
  return {
    intent: 'create',
    title: 'Call mom',
    datetime: '2026-11-02T18:00:00+05:30',
    snooze_minutes: null,
    needs_clarification: false,
    clarification_question: null,
    reason: 'A future reminder was requested.',
  };
}

test('exports the secret-free Gemini config and returns the model object without alteration', async (t) => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return providerResponse(JSON.stringify(validOutput()));
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  assert.deepEqual(config, { provider: 'gemini', model: 'unit-test-model', temperature: 0.1 });
  const output = await parseReminder('Remind me to call mom tomorrow at 6pm', '2026-11-01T10:00:00+05:30', 'Asia/Kolkata');
  assert.deepEqual(output, validOutput());
  assert.equal(captured.options.headers['x-goog-api-key'], 'unit-test-key-not-a-credential');
  assert.equal(captured.url.includes('unit-test-key-not-a-credential'), false);
});

test('invalid model JSON fails with original raw text and no repair', async (t) => {
  const originalFetch = globalThis.fetch;
  const raw = '```json\n{"intent":"create"}\n```';
  globalThis.fetch = async () => providerResponse(raw);
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    parseReminder('make a reminder', '2026-11-01T10:00:00+05:30', 'Asia/Kolkata'),
    (error) => error.code === 'INVALID_MODEL_JSON' && error.raw === raw,
  );
});

test('parsed but invalid output fails with raw evidence', async (t) => {
  const originalFetch = globalThis.fetch;
  const invalid = { ...validOutput(), datetime: '2026-11-01T09:00:00+05:30' };
  const raw = JSON.stringify(invalid);
  globalThis.fetch = async () => providerResponse(raw);
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    parseReminder('make a reminder', '2026-11-01T10:00:00+05:30', 'Asia/Kolkata'),
    (error) => error.code === 'INVALID_MODEL_OUTPUT' && error.raw === raw,
  );
});

test('input validation requires an injected reference instant and valid timezone', async () => {
  await assert.rejects(
    parseReminder('remind me', 'invalid', 'Asia/Kolkata'),
    (error) => error.code === 'INVALID_REQUEST',
  );
  await assert.rejects(
    parseReminder('remind me', '2026-11-01T10:00:00+05:30', 'Invalid/Zone'),
    (error) => error.code === 'INVALID_REQUEST',
  );
});
