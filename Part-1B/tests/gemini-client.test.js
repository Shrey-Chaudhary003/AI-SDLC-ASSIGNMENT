'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createGeminiClient } = require('../src/gemini-client');

function okResponse(text) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

function failedResponse(status) {
  return { ok: false, status };
}

test('Gemini requests JSON at low temperature and extracts candidate text', async () => {
  let request;
  const client = createGeminiClient({
    apiKey: 'sample-test-key',
    model: 'sample-model',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return okResponse('{"intent":"clarify"}');
    },
    timeoutSignal: (milliseconds) => ({ timeout: milliseconds }),
  });

  const text = await client.generateContent({
    systemPrompt: 'Prompt text',
    text: 'remind me',
    nowIso: '2026-11-01T10:00:00+05:30',
    timezone: 'Asia/Kolkata',
  });

  assert.equal(text, '{"intent":"clarify"}');
  assert.match(request.url, /\/v1beta\/models\/sample-model:generateContent$/u);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['x-goog-api-key'], 'sample-test-key');
  assert.equal(request.options.signal.timeout, 45_000);
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.generationConfig, { temperature: 0.1, responseMimeType: 'application/json' });
  assert.equal(body.systemInstruction.parts[0].text, 'Prompt text');
  assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), {
    text: 'remind me',
    nowIso: '2026-11-01T10:00:00+05:30',
    timezone: 'Asia/Kolkata',
  });
  assert.equal(request.url.includes('sample-test-key'), false);
});

test('Gemini retries only 429 and 503 with increasing delays', async () => {
  const statuses = [429, 503];
  const delays = [];
  let attempts = 0;
  const client = createGeminiClient({
    apiKey: 'sample-test-key',
    model: 'sample-model',
    fetchImpl: async () => {
      attempts += 1;
      return statuses.length > 0 ? failedResponse(statuses.shift()) : okResponse('{"ok":true}');
    },
    sleep: async (milliseconds) => delays.push(milliseconds),
  });

  assert.equal(await client.generateContent({}), '{"ok":true}');
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test('exhausted rate-limit retries are a service error with status', async () => {
  let attempts = 0;
  const client = createGeminiClient({
    apiKey: 'sample-test-key',
    model: 'sample-model',
    fetchImpl: async () => {
      attempts += 1;
      return failedResponse(429);
    },
    sleep: async () => {},
  });

  await assert.rejects(
    client.generateContent({}),
    (error) => error.code === 'SERVICE_ERROR' && error.status === 429,
  );
  assert.equal(attempts, 3);
});

test('non-retriable provider errors and other server errors are classified without retry', async (t) => {
  for (const [status, code] of [[400, 'PROVIDER_ERROR'], [500, 'SERVICE_ERROR']]) {
    await t.test(`HTTP ${status}`, async () => {
      let attempts = 0;
      const client = createGeminiClient({
        apiKey: 'sample-test-key',
        model: 'sample-model',
        fetchImpl: async () => {
          attempts += 1;
          return failedResponse(status);
        },
        sleep: async () => {},
      });
      await assert.rejects(
        client.generateContent({}),
        (error) => error.code === code && error.status === status,
      );
      assert.equal(attempts, 1);
    });
  }
});

test('network and timeout failures are service errors', async (t) => {
  for (const error of [
    Object.assign(new Error('network detail'), { code: 'ECONNRESET' }),
    Object.assign(new Error('timeout detail'), { name: 'TimeoutError' }),
  ]) {
    await t.test(error.name, async () => {
      const client = createGeminiClient({
        apiKey: 'sample-test-key',
        model: 'sample-model',
        fetchImpl: async () => { throw error; },
      });
      await assert.rejects(client.generateContent({}), (cause) => cause.code === 'SERVICE_ERROR');
    });
  }
});

test('unreadable successful provider response is surfaced as a service error', async () => {
  const client = createGeminiClient({
    apiKey: 'sample-test-key',
    model: 'sample-model',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }),
  });
  await assert.rejects(client.generateContent({}), (error) => error.code === 'SERVICE_ERROR');
});
