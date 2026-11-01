'use strict';

/*
 * Harness runner for Part 1A.
 *   node .harness/run-harness.js <label>        e.g. initial | repair1 | final
 *
 * Runs six gates and records structured evidence (never edit these files by hand):
 *   evidence/harness-results/<label>.json            full results incl. stdout/stderr
 *   evidence/harness-results/<label>.findings.json   ONLY the failing findings (feed this to the agent)
 *   evidence/harness-results/<label>.traceability.json  AC-ID -> test mapping
 *   evidence/attempt-log.json                         append-only audit trail of every run
 * Labels are write-once (an existing label is refused) except labels starting with "dev-".
 */
const fs = require('node:fs');
const path = require('node:path');
const { readJson, writeJson, gitCommit } = require('./lib/util');
const { loadManifest } = require('./lib/manifest');
const { sha256 } = require('./lib/util');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evidence', 'harness-results');
const GATES = ['integrity', 'static', 'secrets', 'lint', 'security', 'build', 'tests'].map((n) => require(`./gates/${n}`));

function runGate(gate, ctx) {
  const started = Date.now();
  try {
    return { ...gate.run(ctx), durationMs: Date.now() - started };
  } catch (error) {
    return {
      status: 'ERROR',
      command: gate.name,
      findings: [{ code: 'GATE_CRASH', message: String(error && error.stack ? error.stack : error) }],
      durationMs: Date.now() - started,
    };
  }
}

function main() {
  const label = process.argv[2];
  if (!label || !/^[A-Za-z0-9._-]+$/.test(label)) {
    console.error('Usage: node .harness/run-harness.js <label>   (letters, digits, . _ -)');
    return 2;
  }
  const isDev = label.startsWith('dev-');
  const resultFile = path.join(OUT_DIR, `${label}.json`);
  if (fs.existsSync(resultFile) && !isDev) {
    console.error(`Refusing to overwrite evidence/harness-results/${label}.json. Use a new label (e.g. repair1).`);
    return 2;
  }

  const config = readJson(path.join(ROOT, '.harness', 'harness-config.json'), {});
  const ctx = { root: ROOT, config, label };
  const gates = {};
  const artifacts = {};

  for (const gate of GATES) {
    if (gate.name === 'tests' && gates.integrity && gates.integrity.status !== 'PASS') {
      gates.tests = {
        status: 'SKIPPED',
        command: 'node --test',
        findings: [{ code: 'SKIPPED_INTEGRITY_FAILED', message: 'Dynamic checks skipped until protected-file findings are resolved (same rule as Lab Sheet 2).' }],
        durationMs: 0,
      };
      continue;
    }
    const result = runGate(gate, ctx);
    if (result.artifact) {
      artifacts[result.artifact.name] = result.artifact.data;
      delete result.artifact;
    }
    gates[gate.name] = result;
  }

  const overall = Object.values(gates).every((g) => g.status === 'PASS') ? 'PASS' : 'FAIL';
  const manifest = loadManifest(ROOT);
  const report = {
    label,
    timestamp: new Date().toISOString(),
    overall,
    node: process.version,
    gitCommit: gitCommit(ROOT),
    lockedBaselineSha256: manifest ? sha256(JSON.stringify(manifest.files)) : null,
    gates,
  };

  const failing = Object.entries(gates)
    .filter(([, g]) => g.status !== 'PASS')
    .map(([gate, g]) => ({ gate, status: g.status, command: g.command, findings: g.findings }));
  writeJson(resultFile, report);
  writeJson(path.join(OUT_DIR, `${label}.findings.json`), { label, overall, failingGates: failing });
  if (artifacts.traceability) {
    writeJson(path.join(OUT_DIR, `${label}.traceability.json`), artifacts.traceability);
  }
  if (!isDev) {
    const logFile = path.join(ROOT, 'evidence', 'attempt-log.json');
    const log = readJson(logFile, []);
    log.push({
      attempt: log.length + 1,
      label,
      timestamp: report.timestamp,
      overall,
      gitCommit: report.gitCommit,
      gates: Object.fromEntries(Object.entries(gates).map(([k, g]) => [k, g.status])),
    });
    writeJson(logFile, log);
  }

  console.log(`\nHARNESS RESULT  label=${label}`);
  for (const [name, g] of Object.entries(gates)) {
    console.log(`  ${name.padEnd(10)} ${g.status.padEnd(8)} ${g.findings.length} finding(s)`);
  }
  console.log(`  OVERALL    ${overall}`);
  if (overall === 'FAIL') {
    console.log(`\nFeed ONLY this file back to the coding agent: evidence/harness-results/${label}.findings.json`);
  }
  return overall === 'PASS' ? 0 : 1;
}

process.exit(main());
