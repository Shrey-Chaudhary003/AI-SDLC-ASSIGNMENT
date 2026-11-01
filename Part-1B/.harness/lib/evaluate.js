'use strict';

// Evaluation core: call the application with retries, classify failures, run the three layers,
// aggregate. API/service problems (429, 5xx, timeouts) are recorded as SERVICE_ERROR and are
// never counted as application or evaluation failures.
const { layer1 } = require('../layer1');
const { layer2 } = require('../layer2');
const { layer3 } = require('../layer3');
const { sleep } = require('./util');

const SERVICE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const SERVICE_MESSAGE = /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|timed out|timeout|HTTP (?:429|5\d\d)|rate limit|quota/i;

function classifyError(error) {
  if (error && error.code === 'INVALID_MODEL_JSON') {
    return { kind: 'invalid_json', message: `model output was not valid JSON${error.raw ? `: ${String(error.raw).slice(0, 200)}` : ''}` };
  }
  const status = error && (error.status || error.statusCode);
  const isService =
    (error && error.code === 'SERVICE_ERROR') ||
    SERVICE_STATUS.has(status) ||
    (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) ||
    SERVICE_MESSAGE.test(String(error && error.message));
  return { kind: isService ? 'service' : 'app', message: String(error && error.message ? error.message : error) };
}

async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`timed out after ${ms} ms`), { name: 'TimeoutError' })), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function callAgent(agent, testCase, config) {
  let lastError = null;
  for (let attempt = 1; attempt <= config.service_retries; attempt += 1) {
    try {
      const raw = await withTimeout(
        Promise.resolve(agent.parseReminder(testCase.input, testCase.reference_now, testCase.timezone)),
        config.case_timeout_ms,
      );
      if (typeof raw === 'string') {
        try {
          return { output: JSON.parse(raw), attempts: attempt };
        } catch {
          return { error: { kind: 'invalid_json', message: `model output was not valid JSON: ${raw.slice(0, 200)}` }, attempts: attempt };
        }
      }
      return { output: raw, attempts: attempt };
    } catch (error) {
      lastError = classifyError(error);
      if (lastError.kind !== 'service' || attempt === config.service_retries) {
        return { error: lastError, attempts: attempt };
      }
      await sleep(config.service_backoff_ms * attempt);
    }
  }
  return { error: lastError, attempts: config.service_retries };
}

function failedRequirements(testCase, config, layer1Result, layer2Result) {
  const ids = new Set();
  const map = config.requirement_map || {};
  if (!layer1Result.pass) {
    (map.layer1_schema || []).forEach((id) => ids.add(id));
  }
  for (const f of layer2Result.failed || []) {
    const mapped = map[f.check];
    (mapped || testCase.requirement_ids).forEach((id) => ids.add(id));
  }
  return [...ids].sort();
}

async function evaluateCase(testCase, { agent, config, schema, promptText }) {
  const started = Date.now();
  const base = { id: testCase.id, category: testCase.category, input: testCase.input, requirement_ids: testCase.requirement_ids };
  const called = await callAgent(agent, testCase, config);
  const latencyMs = Date.now() - started;

  if (called.error && called.error.kind === 'service') {
    return { ...base, status: 'SERVICE_ERROR', attempts: called.attempts, latencyMs, error: called.error.message };
  }
  if (called.error) {
    const l1 = { pass: false, errors: [called.error.kind === 'invalid_json' ? called.error.message : `agent threw: ${called.error.message}`] };
    return {
      ...base, status: 'FAIL', attempts: called.attempts, latencyMs, output: null,
      layer1: l1, layer2: { pass: false, skipped: true, failed: [] }, layer3: { score: 0, skipped: true },
      failedRequirements: failedRequirements(testCase, config, l1, { failed: [] }),
    };
  }

  const l1 = layer1(called.output, schema);
  const l2 = l1.pass ? layer2(called.output, testCase, config, promptText) : { pass: false, skipped: true, failed: [] };
  const l3 = l1.pass && l2.pass ? layer3(called.output, testCase, config) : { score: 0, skipped: true };
  return {
    ...base,
    status: l1.pass && l2.pass ? 'PASS' : 'FAIL',
    belowThreshold: l3.score < config.threshold,
    attempts: called.attempts,
    latencyMs,
    output: called.output,
    layer1: l1,
    layer2: l2,
    layer3: l3,
    failedRequirements: failedRequirements(testCase, config, l1, l2),
  };
}

const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const round = (x) => Number(x.toFixed(4));

function aggregate(results, config) {
  const evaluated = results.filter((r) => r.status !== 'SERVICE_ERROR');
  const serviceErrors = results.filter((r) => r.status === 'SERVICE_ERROR');
  const rate = (n) => (evaluated.length === 0 ? 0 : round(n / evaluated.length));
  const layer1Pass = evaluated.filter((r) => r.layer1.pass).length;
  const layer2Pass = evaluated.filter((r) => r.layer2.pass).length;
  const layer3Mean = round(mean(evaluated.map((r) => r.layer3.score)));
  const gatedScores = evaluated.filter((r) => !r.layer3.skipped).map((r) => r.layer3.score);

  const categories = {};
  for (const r of evaluated) {
    const c = (categories[r.category] = categories[r.category] || { cases: 0, hardGateFailures: 0, scores: [] });
    c.cases += 1;
    c.hardGateFailures += r.status === 'FAIL' ? 1 : 0;
    c.scores.push(r.layer3.score);
  }
  const byCategory = Object.fromEntries(
    Object.entries(categories).map(([k, v]) => [k, { cases: v.cases, hardGateFailures: v.hardGateFailures, layer3Mean: round(mean(v.scores)) }]),
  );

  let verdict;
  if (evaluated.length === 0 || serviceErrors.length > 0) {
    verdict = 'INCOMPLETE';
  } else if (layer1Pass === evaluated.length && layer2Pass === evaluated.length && layer3Mean >= config.threshold) {
    verdict = 'PASS';
  } else {
    verdict = 'FAIL';
  }
  return {
    verdict,
    totalCases: results.length,
    evaluatedCases: evaluated.length,
    serviceErrorCases: serviceErrors.length,
    layer1: { passed: layer1Pass, rate: rate(layer1Pass), required: 1 },
    layer2: { passed: layer2Pass, rate: rate(layer2Pass), required: 1 },
    layer3: { meanAllEvaluated: layer3Mean, meanOverHardGatePassed: round(mean(gatedScores)), threshold: config.threshold, casesBelowThreshold: evaluated.filter((r) => r.layer3.score < config.threshold).length },
    byCategory,
  };
}

module.exports = { evaluateCase, aggregate, classifyError };
