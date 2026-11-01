'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createServer, errorResponse, parseRequestBody } = require('../src/server');

const nowIso = '2026-11-01T10:00:00+05:30';
const validOutput = {
  intent: 'create',
  title: 'Call mom',
  datetime: '2026-11-02T18:00:00+05:30',
  snooze_minutes: null,
  needs_clarification: false,
  clarification_question: null,
  reason: 'A future reminder was requested.',
};

async function openServer(t, options = {}) {
  const server = createServer({
    config: { provider: 'gemini', model: 'test-model' },
    parseReminder: async () => validOutput,
    nowProvider: () => nowIso,
    ...options,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test('request validation applies JSON, text length, timezone, and reference-time rules', () => {
  assert.throws(() => parseRequestBody('{'), (error) => error.code === 'INVALID_REQUEST');
  assert.throws(() => parseRequestBody(JSON.stringify({ text: 4 })), (error) => error.code === 'INVALID_REQUEST');
  assert.throws(
    () => parseRequestBody(JSON.stringify({ text: 'x'.repeat(8001) })),
    (error) => error.code === 'INVALID_REQUEST',
  );
  assert.throws(
    () => parseRequestBody(JSON.stringify({ text: 'x', timezone: 'Invalid/Zone' })),
    (error) => error.code === 'INVALID_REQUEST',
  );
  assert.throws(
    () => parseRequestBody(JSON.stringify({ text: 'x', nowIso: '2026-02-30T10:00:00Z' })),
    (error) => error.code === 'INVALID_REQUEST',
  );
  assert.deepEqual(parseRequestBody(JSON.stringify({ text: 'x' })), {
    text: 'x',
    nowIso: undefined,
    timezone: 'Asia/Kolkata',
  });
});

test('health and parse endpoints return secret-free metadata and deterministic checks', async (t) => {
  const baseUrl = await openServer(t, {
    parseReminder: async () => validOutput,
    apiKey: 'private-test-key',
  });
  const health = await fetch(`${baseUrl}/api/health`);
  assert.deepEqual(await health.json(), { status: 'ok', provider: 'gemini', model: 'test-model' });

  const page = await fetch(baseUrl);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /Injection attempt/u);
  assert.doesNotMatch(html, /innerHTML/u);

  const response = await fetch(`${baseUrl}/api/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'call mom tomorrow', nowIso, timezone: 'Asia/Kolkata' }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.result, validOutput);
  assert.deepEqual(body.meta, {
    provider: 'gemini',
    model: 'test-model',
    latencyMs: body.meta.latencyMs,
    nowIso,
    timezone: 'Asia/Kolkata',
  });
  assert.ok(body.checks.length > 0);
  assert.equal(body.checks.every((check) => check.pass), true);
  assert.equal(JSON.stringify(body).includes('private-test-key'), false);
});

test('server supplies an offset-bearing reference instant only when omitted', async (t) => {
  let received;
  const suppliedNow = '2026-11-01T11:00:00+05:30';
  const baseUrl = await openServer(t, {
    nowProvider: () => suppliedNow,
    parseReminder: async (...args) => {
      received = args;
      return validOutput;
    },
  });
  const response = await fetch(`${baseUrl}/api/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'call mom tomorrow' }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(received, ['call mom tomorrow', suppliedNow, 'Asia/Kolkata']);
  assert.equal(body.meta.nowIso, suppliedNow);
  assert.equal(body.meta.timezone, 'Asia/Kolkata');
});

test('malformed, oversized, and overlong requests map to HTTP 400', async (t) => {
  const baseUrl = await openServer(t);
  const malformed = await fetch(`${baseUrl}/api/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(malformed.status, 400);

  const oversized = await fetch(`${baseUrl}/api/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'x'.repeat(10_300) }),
  });
  assert.equal(oversized.status, 400);

  const overlong = await fetch(`${baseUrl}/api/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'x'.repeat(8001) }),
  });
  assert.equal(overlong.status, 400);
});

test('model, provider, and service errors use distinct safe HTTP mappings', async (t) => {
  const cases = [
    ['INVALID_MODEL_JSON', 502, true],
    ['INVALID_MODEL_OUTPUT', 502, true],
    ['PROVIDER_ERROR', 502, false],
    ['SERVICE_ERROR', 503, false],
    ['CONFIG_ERROR', 500, false],
  ];
  for (const [code, status, includesRaw] of cases) {
    await t.test(code, async () => {
      const failure = Object.assign(new Error('do not expose this provider detail'), { code, raw: '{"ok":false}' });
      const baseUrl = await openServer(t, { parseReminder: async () => { throw failure; } });
      const response = await fetch(`${baseUrl}/api/parse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'request', nowIso }),
      });
      const body = await response.json();
      assert.equal(response.status, status);
      assert.equal(body.error.code, code);
      assert.equal(Object.prototype.hasOwnProperty.call(body.error, 'raw'), includesRaw);
      assert.equal(JSON.stringify(body).includes('do not expose this provider detail'), false);
    });
  }
});

test('raw model text containing a secret or prompt phrase is redacted', () => {
  const promptText = 'Private system instruction must never be copied into an output field or public response.';
  const response = errorResponse(
    Object.assign(new Error('invalid output'), {
      code: 'INVALID_MODEL_JSON',
      raw: `private-test-key ${promptText}`,
    }),
    { promptText, apiKey: 'private-test-key' },
  );
  assert.equal(response.status, 502);
  assert.equal(response.body.error.raw, '[redacted]');
  assert.equal(JSON.stringify(response.body).includes('private-test-key'), false);
});

test('frontend contains five examples, keeps output text-safe, and keeps history to ten in memory', () => {
  const htmlPath = path.resolve(__dirname, '..', 'src', 'public', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.equal((html.match(/data-example=/gu) || []).length >= 5, true);
  assert.match(html, /textContent/u);
  assert.match(html, /history\.length = Math\.min\(history\.length, 10\)/u);
  assert.doesNotMatch(html, /\.innerHTML\s*=/u);
  assert.match(html, /Service error/u);
  assert.match(html, /Invalid model response/u);
});
