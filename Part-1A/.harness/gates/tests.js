'use strict';

const path = require('node:path');
const { walk, packageBin, run, clip, readJson } = require('../lib/util');

function parseTapFailures(stdout) {
  const lines = stdout.split('\n');
  const failures = [];
  lines.forEach((line, i) => {
    const match = line.match(/^\s*not ok \d+ - (.*)$/);
    if (match) {
      failures.push({ name: match[1], detail: lines.slice(i + 1, i + 8).join(' ').trim() });
    }
  });
  return failures;
}

function runNodeTests(root, config, files) {
  const c8 = packageBin(root, 'c8');
  if (!c8) {
    return { status: 127, stdout: '', stderr: 'c8 is not installed' };
  }
  const coverageDir = path.join(root, 'coverage');
  return run(process.execPath, [
    c8, '--all', '--include', 'src/**', '--exclude', 'src/server.js',
    '--reporter', 'text', '--reporter', 'json-summary', '--reports-dir', coverageDir,
    '--check-coverage', '--lines', String(config.minLineCoveragePercent),
    process.execPath, '--test', '--test-reporter=tap', ...files,
  ], { cwd: root, timeoutMs: config.toolTimeoutMs });
}

function runBrowserTests(root, config) {
  const vitest = packageBin(root, 'vitest');
  if (!vitest) {
    return { status: 127, stdout: '', stderr: 'vitest is not installed' };
  }
  return run(process.execPath, [vitest, 'run', '--coverage'], {
    cwd: root,
    timeoutMs: config.toolTimeoutMs,
  });
}

function coverageFinding(root, minimum) {
  const summary = readJson(path.join(root, 'coverage', 'coverage-summary.json'), null);
  const percent = summary && summary.total && summary.total.lines ? summary.total.lines.pct : null;
  if (typeof percent === 'number' && percent < minimum) {
    return { code: 'COVERAGE_BELOW_THRESHOLD', message: `Node line coverage ${percent}% is below ${minimum}%.` };
  }
  return null;
}

function failingNodeTests(result) {
  return parseTapFailures(result.stdout).map((failure) => ({
    code: 'TEST_FAILED',
    message: `${failure.name} :: ${failure.detail}`,
  }));
}

function gateResult(nodeResult, webResult, findings, command) {
  if (nodeResult.status !== 0 && findings.length === 0) {
    findings.push({ code: 'NODE_TEST_RUN_ERROR', message: `${nodeResult.error || nodeResult.stderr || 'Node tests failed.'} ${clip(nodeResult.stdout)}` });
  }
  if (webResult.status !== 0) {
    findings.push({ code: 'VITEST_FAILED', message: clip(webResult.stdout || webResult.stderr || 'Vitest failed.') });
  }
  return {
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    command,
    findings,
    stdout: `${clip(nodeResult.stdout)}\n${clip(webResult.stdout)}`,
    stderr: `${clip(nodeResult.stderr)}\n${clip(webResult.stderr)}`,
  };
}

module.exports = {
  name: 'tests',
  run({ root, config }) {
    const files = walk(root, 'tests').filter((file) => /\.test\.(?:c|m)?js$/.test(file));
    const nodeResult = runNodeTests(root, config, files);
    const webResult = runBrowserTests(root, config);
    const findings = failingNodeTests(nodeResult);
    const coverage = coverageFinding(root, config.minLineCoveragePercent);
    if (coverage) {
      findings.push(coverage);
    }
    return gateResult(nodeResult, webResult, findings, 'node:test + c8 + Vitest/RTL');
  },
};
