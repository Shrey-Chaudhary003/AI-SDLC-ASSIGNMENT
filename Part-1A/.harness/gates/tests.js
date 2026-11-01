'use strict';

// GATE 6 - dynamic sensor: run every tests/**/*.test.js with node:test under c8 and
// enforce the line-coverage threshold from harness-config.json.
const path = require('node:path');
const { walk, packageBin, run, clip, readJson } = require('../lib/util');

function parseTapFailures(stdout) {
  const lines = stdout.split('\n');
  const failures = [];
  lines.forEach((line, i) => {
    const match = line.match(/^\s*not ok \d+ - (.*)$/);
    if (match) {
      const detail = [];
      for (let j = i + 1; j < lines.length && detail.length < 14; j += 1) {
        if (/^\s*(?:not ok|ok) \d+ - /.test(lines[j]) || /^\s*1\.\.\d+/.test(lines[j])) {
          break;
        }
        detail.push(lines[j].trim());
      }
      failures.push({ name: match[1], detail: detail.filter(Boolean).join(' | ') });
    }
  });
  return failures;
}

module.exports = {
  name: 'tests',
  run({ root, config }) {
    const testFiles = walk(root, 'tests').filter((f) => /\.test\.(?:c|m)?js$/.test(f));
    const display = `c8 --check-coverage --lines ${config.minLineCoveragePercent} node --test ${testFiles.length} file(s)`;
    if (testFiles.length === 0) {
      return { status: 'FAIL', command: display, findings: [{ code: 'NO_TESTS', message: 'No tests/**/*.test.js files found.' }] };
    }
    const c8 = packageBin(root, 'c8');
    if (!c8) {
      return { status: 'ERROR', command: display, findings: [{ code: 'TOOL_MISSING', message: 'c8 is not installed. Run `npm install`.' }] };
    }
    const coverageDir = path.join(root, 'coverage');
    const result = run(
      process.execPath,
      [
        c8, '--all', '--include', 'src/**', '--reporter', 'text', '--reporter', 'json-summary',
        '--reports-dir', coverageDir, '--check-coverage', '--lines', String(config.minLineCoveragePercent),
        process.execPath, '--test', '--test-reporter=tap', ...testFiles,
      ],
      { cwd: root, timeoutMs: config.toolTimeoutMs },
    );

    const findings = parseTapFailures(result.stdout).map((f) => ({
      code: 'TEST_FAILED',
      message: `${f.name}${f.detail ? ` :: ${f.detail}` : ''}`,
    }));
    const summary = readJson(path.join(coverageDir, 'coverage-summary.json'), null);
    const linePct = summary && summary.total && summary.total.lines ? summary.total.lines.pct : null;
    if (typeof linePct === 'number' && linePct < config.minLineCoveragePercent) {
      findings.push({
        code: 'COVERAGE_BELOW_THRESHOLD',
        message: `Line coverage ${linePct}% is below the required ${config.minLineCoveragePercent}%. Add behaviour (not suppressions) so spec-derived tests exercise it.`,
      });
    }
    if (result.status !== 0 && findings.length === 0) {
      findings.push({ code: 'TEST_RUN_ERROR', message: `Test run exited with ${result.status}. ${result.error || ''} See stdout/stderr.` });
    }
    return {
      status: result.status === 0 && findings.length === 0 ? 'PASS' : 'FAIL',
      command: display,
      findings,
      stdout: clip(result.stdout),
      stderr: clip(result.stderr),
      details: { lineCoveragePercent: linePct, testFiles: testFiles.length },
    };
  },
};
