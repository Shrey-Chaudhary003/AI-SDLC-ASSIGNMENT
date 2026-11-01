'use strict';

/*
 * Evaluation runner for Part 1B - ONE pipeline:
 *   dataset -> application call -> Layer 1 (schema) -> Layer 2 (invariants/properties)
 *           -> Layer 3 (semantic score) -> aggregate -> PASS / FAIL
 *
 *   node .harness/run-eval.js --label initial
 *   node .harness/run-eval.js --label final
 *
 * Options: --agent <file>   (default src/agent.js, must export parseReminder(text, nowIso, tz))
 *          --dataset <file> (default evals/dataset.json)
 *          --delay-ms <n>   pause between cases (free-tier rate limits), default from eval-config.json
 *          --only EV-01,EV-02   run a subset (labels starting with dev- only)
 *          --skip-preflight     skip lock/spec checks (labels starting with dev- only)
 *
 * Writes (never edit by hand):
 *   evidence/eval-results-<label>.json   write-once record of this run
 *   evidence/eval-results.json           copy of the latest run
 *   evidence/failure-evidence-<label>.json   only the failing cases, ready to give to the coding agent
 *   evidence/attempt-log.json            append-only audit trail
 * Verdicts: PASS | FAIL | INCOMPLETE (service errors) | INVALID (preflight failed, no model calls made)
 */
const fs = require('node:fs');
const path = require('node:path');
const { sha256, hashFile, walk, readJson, writeJson, sleep, gitCommit } = require('./lib/util');
const { loadManifest, buildManifest, diffManifest } = require('./lib/manifest');
const { evaluateCase, aggregate } = require('./lib/evaluate');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    }
  }
  return args;
}

function readPromptText() {
  const files = walk(ROOT, 'prompts').filter((f) => /\.(md|txt)$/.test(f));
  return files.length === 0 ? null : files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

function datasetProblems(dataset, config) {
  const problems = [];
  if (!Array.isArray(dataset)) {
    return ['dataset must be a JSON array'];
  }
  const ids = new Set();
  dataset.forEach((c, i) => {
    const where = `case[${i}] ${c && c.id ? c.id : ''}`.trim();
    for (const key of ['id', 'category', 'reference_now', 'timezone']) {
      if (typeof c[key] !== 'string' || c[key] === '') {
        problems.push(`${where}: "${key}" must be a non-empty string`);
      }
    }
    if (typeof c.input !== 'string') {
      problems.push(`${where}: "input" must be a string (may be empty)`);
    }
    if (!Array.isArray(c.requirement_ids) || c.requirement_ids.length === 0) {
      problems.push(`${where}: "requirement_ids" must be a non-empty array`);
    }
    if (!c.expected || (c.expected.intent === undefined && !Array.isArray(c.expected.allowed_intents))) {
      problems.push(`${where}: "expected" needs "intent" or "allowed_intents"`);
    }
    if (typeof c.rubric !== 'string' || c.rubric === '') {
      problems.push(`${where}: "rubric" must describe when the outcome is acceptable`);
    }
    if (ids.has(c.id)) {
      problems.push(`${where}: duplicate id`);
    }
    ids.add(c.id);
  });
  if (dataset.length < config.min_cases) {
    problems.push(`dataset has ${dataset.length} cases; at least ${config.min_cases} are required`);
  }
  const categories = new Set(dataset.map((c) => c.category));
  if (categories.size < config.min_categories) {
    problems.push(`dataset covers ${categories.size} categories; at least ${config.min_categories} different kinds of case are expected`);
  }
  return problems;
}

function traceabilityProblems(dataset, config) {
  const specFiles = walk(ROOT, 'specs').filter((f) => /(^|\/)spec\.md$/.test(f));
  if (specFiles.length === 0) {
    return { problems: ['no specs/*/spec.md found - run /speckit.specify first'], missing: [] };
  }
  const specText = specFiles.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const needed = new Set(dataset.flatMap((c) => c.requirement_ids || []));
  Object.values(config.requirement_map || {}).flat().forEach((id) => needed.add(id));
  const missing = [...needed].filter((id) => !new RegExp(`\\b${id}\\b`).test(specText)).sort();
  return { problems: missing.map((id) => `${id} is used by the dataset/config but is not defined in spec.md`), missing };
}

function lockProblems() {
  const baseline = loadManifest(ROOT);
  if (!baseline) {
    return ['not locked: run `npm run harness:lock -- --reason "..."` before the evaluation you want to keep as evidence'];
  }
  const { added, removed, changed } = diffManifest(baseline.files, buildManifest(ROOT));
  return [
    ...changed.map((f) => `protected file changed since lock: ${f}`),
    ...added.map((f) => `protected file added since lock: ${f}`),
    ...removed.map((f) => `protected file removed since lock: ${f}`),
  ];
}

function printTable(results) {
  console.log('\n  case   category      L1    L2    L3     status');
  for (const r of results) {
    const l1 = r.layer1 ? (r.layer1.pass ? 'ok' : 'FAIL') : '-';
    const l2 = r.layer2 ? (r.layer2.pass ? 'ok' : r.layer2.skipped ? 'n/a' : 'FAIL') : '-';
    const l3 = r.layer3 ? r.layer3.score.toFixed(2) : '-';
    console.log(`  ${r.id.padEnd(6)} ${String(r.category).padEnd(13)} ${l1.padEnd(5)} ${l2.padEnd(5)} ${l3.padEnd(6)} ${r.status}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = args.label;
  if (typeof label !== 'string' || !/^[A-Za-z0-9._-]+$/.test(label)) {
    console.error('Usage: node .harness/run-eval.js --label <initial|repair1|final|dev-x> [--agent file] [--delay-ms n]');
    return 2;
  }
  const isDev = label.startsWith('dev-');
  const resultFile = path.join(ROOT, 'evidence', `eval-results-${label}.json`);
  if (fs.existsSync(resultFile) && !isDev) {
    console.error(`Refusing to overwrite evidence/eval-results-${label}.json. Use a new label (e.g. repair1).`);
    return 2;
  }
  if ((args.only || args['skip-preflight']) && !isDev) {
    console.error('--only and --skip-preflight are allowed only with labels that start with "dev-".');
    return 2;
  }

  const configFile = path.join(__dirname, 'eval-config.json');
  const schemaFile = path.join(__dirname, 'schema.json');
  const datasetFile = path.resolve(ROOT, args.dataset || 'evals/dataset.json');
  const config = readJson(configFile, null);
  const schema = readJson(schemaFile, null);
  let dataset = readJson(datasetFile, null);
  if (!config || !schema || !dataset) {
    console.error('Could not read eval-config.json, schema.json or the dataset (is it valid JSON?).');
    return 3;
  }
  const weightSum = Object.values(config.weights).reduce((a, b) => a + b, 0);
  const preflight = [];
  if (Math.abs(weightSum - 1) > 1e-9) {
    preflight.push(`weights in eval-config.json sum to ${weightSum}, expected 1`);
  }
  preflight.push(...datasetProblems(dataset, config));
  if (!args['skip-preflight']) {
    preflight.push(...traceabilityProblems(dataset, config).problems, ...lockProblems());
  }
  if (preflight.length > 0) {
    // Nothing was evaluated, so nothing is written: the label stays free for a real run.
    console.error('\nPREFLIGHT FAILED (verdict INVALID, no model calls made, no evidence written):');
    preflight.forEach((p) => console.error(`  - ${p}`));
    return 3;
  }

  if (args.only) {
    const wanted = new Set(String(args.only).split(','));
    dataset = dataset.filter((c) => wanted.has(c.id));
  }

  const agentPath = path.resolve(ROOT, args.agent || 'src/agent.js');
  if (!fs.existsSync(agentPath)) {
    console.error(`Application not found: ${path.relative(ROOT, agentPath)}. Run /speckit.implement first.`);
    return 3;
  }
  const agent = require(agentPath);
  if (typeof agent.parseReminder !== 'function') {
    console.error('The application must export parseReminder(text, nowIso, timezone).');
    return 3;
  }

  const promptText = readPromptText();
  const delayMs = args['delay-ms'] !== undefined ? Number(args['delay-ms']) : config.default_delay_ms;
  console.log(`Evaluating ${dataset.length} cases | label=${label} | delay=${delayMs}ms | prompt-leak check ${promptText ? 'ON' : 'OFF (no prompts/*.md)'}`);

  const results = [];
  for (const testCase of dataset) {
    const result = await evaluateCase(testCase, { agent, config, schema, promptText });
    results.push(result);
    process.stdout.write(`  ${testCase.id} ${result.status}\n`);
    if (delayMs > 0 && testCase !== dataset[dataset.length - 1]) {
      await sleep(delayMs);
    }
  }

  const summary = aggregate(results, config);
  const report = {
    label,
    timestamp: new Date().toISOString(),
    verdict: summary.verdict,
    node: process.version,
    gitCommit: gitCommit(ROOT),
    model: {
      ...(agent.config || {}),
      note: agent.config ? 'from agent.config' : 'agent.config not exported; set LLM_MODEL in the log yourself',
    },
    referenceNowValues: [...new Set(dataset.map((c) => c.reference_now))],
    fingerprints: {
      datasetSha256: hashFile(datasetFile),
      evalConfigSha256: hashFile(configFile),
      schemaSha256: hashFile(schemaFile),
      systemPromptSha256: promptText ? sha256(promptText) : null,
    },
    thresholdDeclared: { threshold: config.threshold, weights: config.weights, datetimeToleranceMinutes: config.datetime_tolerance_minutes },
    aggregate: summary,
    cases: results,
  };

  const failures = results
    .filter((r) => r.status === 'FAIL' || r.belowThreshold)
    .map((r) => ({
      id: r.id,
      category: r.category,
      requirement_ids: r.requirement_ids,
      input: r.input,
      reference_now: dataset.find((c) => c.id === r.id).reference_now,
      expected: dataset.find((c) => c.id === r.id).expected,
      output: r.output,
      failedRequirements: r.failedRequirements,
      layer1Errors: r.layer1 ? r.layer1.errors : [],
      layer2Failed: r.layer2 ? r.layer2.failed : [],
      layer3: r.layer3,
      kind: r.status === 'FAIL' ? 'HARD_GATE_FAILURE' : 'BELOW_SEMANTIC_THRESHOLD',
    }));

  writeJson(resultFile, report);
  writeJson(path.join(ROOT, 'evidence', 'eval-results.json'), report);
  if (failures.length > 0) {
    writeJson(path.join(ROOT, 'evidence', `failure-evidence-${label}.json`), { label, verdict: summary.verdict, aggregate: summary, failures });
  }
  if (!isDev) {
    const logFile = path.join(ROOT, 'evidence', 'attempt-log.json');
    const log = readJson(logFile, []);
    log.push({ attempt: log.length + 1, label, timestamp: report.timestamp, verdict: summary.verdict, layer1Rate: summary.layer1.rate, layer2Rate: summary.layer2.rate, layer3Mean: summary.layer3.meanAllEvaluated, serviceErrorCases: summary.serviceErrorCases, gitCommit: report.gitCommit });
    writeJson(logFile, log);
  }

  printTable(results);
  console.log(`\nLayer 1 (schema)      : ${summary.layer1.passed}/${summary.evaluatedCases}  (required 100%)`);
  console.log(`Layer 2 (properties)  : ${summary.layer2.passed}/${summary.evaluatedCases}  (required 100%)`);
  console.log(`Layer 3 (semantic)    : mean ${summary.layer3.meanAllEvaluated}  (threshold ${config.threshold})`);
  console.log(`Service-error cases   : ${summary.serviceErrorCases}  (not counted as failures; verdict INCOMPLETE if > 0)`);
  console.log(`VERDICT               : ${summary.verdict}`);
  if (failures.length > 0) {
    console.log(`\nGive the coding agent ONLY this file: evidence/failure-evidence-${label}.json`);
  }
  return { PASS: 0, FAIL: 1, INCOMPLETE: 2 }[summary.verdict];
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(3);
  },
);
