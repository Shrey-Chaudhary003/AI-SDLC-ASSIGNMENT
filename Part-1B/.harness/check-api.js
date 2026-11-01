'use strict';

/*
 * Playground check for the Gemini API (run this BEFORE building anything on top of it).
 *   npm run api:check
 *
 * It answers three questions in order, and never prints your key or the request URL:
 *   1. Is GEMINI_API_KEY set in .env?
 *   2. Does the key work, and is LLM_MODEL one of the models this key can use?
 *   3. Can the model return a JSON answer (the same call style the application will use)?
 * Exit code 0 = ready, 1 = something to fix (the message says what).
 */
const fs = require('node:fs');
const path = require('node:path');

function loadEnv(file) {
  if (!fs.existsSync(file)) {
    return;
  }
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    const eq = trimmed.indexOf('=');
    if (!trimmed || trimmed.startsWith('#') || eq < 1) {
      continue;
    }
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}

loadEnv(path.join(__dirname, '..', '.env'));

const key = process.env.GEMINI_API_KEY;
const model = process.env.LLM_MODEL || '';
const base = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 90000;

function fail(message) {
  console.error(`\nNOT READY: ${message}`);
  process.exit(1);
}

function explainHttp(status, body) {
  const detail = body && body.error && body.error.message ? String(body.error.message).slice(0, 200) : '';
  const hints = {
    400: 'The key is not valid, or the request is malformed. Re-copy the key from AI Studio into .env (no quotes, no spaces).',
    401: 'The key was rejected. Create a new key in AI Studio and update .env.',
    403: 'The key is not allowed to use this API (wrong project, API restriction, or your region). Create a fresh key in AI Studio under a new project.',
    404: 'Model or endpoint not found. Pick a model from the list printed by this check and set LLM_MODEL in .env.',
    429: 'Rate limit or daily quota reached. Wait a minute (or until tomorrow for the daily quota). This is a SERVICE problem, not a bug in your code.',
  };
  const hint = hints[status] || (status >= 500 ? 'Google service problem. Try again later. This is not your code.' : 'Unexpected response.');
  return `HTTP ${status}. ${hint}${detail ? ` Server said: ${detail}` : ''}`;
}

async function call(url, options, attempts = 2) {
  let response;
  const started = Date.now();
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      response = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
      break;
    } catch (error) {
      const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
      if (timedOut && attempt < attempts) {
        console.log(`  ..  no answer after ${Math.round(TIMEOUT_MS / 1000)}s, trying once more`);
        continue;
      }
      if (timedOut) {
        fail(`The API did not answer within ${Math.round(TIMEOUT_MS / 1000)}s (twice). Your internet works (the key check passed), so the model is slow or busy. Set another LLM_MODEL in .env (a "flash-lite" one) and run this again, or retry in a few minutes.`);
      }
      fail(`Could not reach the API (${error.name}: ${error.cause && error.cause.code ? error.cause.code : error.message}). Check your internet/VPN/proxy and try again.`);
    }
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, ok: response.ok, body, seconds: ((Date.now() - started) / 1000).toFixed(1) };
}

async function main() {
  console.log('Step 1/3  API key');
  if (!key || key === 'replace_with_your_key') {
    fail('GEMINI_API_KEY is missing. Copy .env.example to .env and paste your key after GEMINI_API_KEY= (see the guide, Unit "Get the Gemini API key").');
  }
  console.log(`  OK  key found (${key.length} characters)`);

  console.log('Step 2/3  Key works and model is available');
  const listed = await call(`${base}/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`, { method: 'GET' });
  if (!listed.ok) {
    fail(explainHttp(listed.status, listed.body));
  }
  const usable = (listed.body.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => String(m.name).replace(/^models\//, ''));
  console.log(`  OK  key accepted; ${usable.length} model(s) support generateContent`);
  if (!model) {
    fail('LLM_MODEL is empty in .env.');
  }
  if (!usable.includes(model)) {
    const flash = usable.filter((n) => /flash/i.test(n) && !/(image|tts|live|audio|embedding|thinking)/i.test(n));
    const suggestions = (flash.length > 0 ? flash : usable).slice(0, 12);
    console.error(`  --  LLM_MODEL="${model}" is not available for this key.`);
    console.error('      Models you can use (pick one, a "flash" or "flash-lite" one is cheapest/fastest):');
    suggestions.forEach((n) => console.error(`        ${n}`));
    fail(`Set LLM_MODEL=<one of the names above> in .env and run "npm run api:check" again.`);
  }
  console.log(`  OK  model "${model}" is available`);

  console.log('Step 3/3  JSON answer from the model');
  const generated = await call(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Reply with exactly this JSON object and nothing else: {"ok": true}' }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  });
  if (!generated.ok) {
    fail(explainHttp(generated.status, generated.body));
  }
  const text = generated.body && generated.body.candidates && generated.body.candidates[0] && generated.body.candidates[0].content
    && generated.body.candidates[0].content.parts && generated.body.candidates[0].content.parts[0] && generated.body.candidates[0].content.parts[0].text;
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (!parsed || parsed.ok !== true) {
    fail(`The model answered, but not with the expected JSON (got: ${String(text).slice(0, 120)}). Try another LLM_MODEL from the list.`);
  }
  console.log(`  OK  the model returned valid JSON (${generated.seconds}s)`);
  console.log(`\nREADY: key works, model "${model}" works. You can start Part 1B.`);
}

main().catch((error) => fail(`Unexpected error: ${error.message}`));
