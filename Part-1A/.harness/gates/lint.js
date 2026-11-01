'use strict';

// GATE 4 (lint) and GATE 5 (security) share this ESLint runner.
const path = require('node:path');
const { packageBin, run, clip } = require('../lib/util');

function runEslint({ root, name, configFile, targets, timeoutMs }) {
  const bin = packageBin(root, 'eslint');
  const display = `eslint --config ${configFile} --max-warnings 0 ${targets.join(' ')}`;
  if (!bin) {
    return {
      status: 'ERROR',
      command: display,
      findings: [{ code: 'TOOL_MISSING', message: 'eslint is not installed. Run `npm install` in this folder.' }],
    };
  }
  const result = run(
    process.execPath,
    [bin, '--config', path.join(root, configFile), '--format', 'json', '--max-warnings', '0', '--no-error-on-unmatched-pattern', ...targets],
    { cwd: root, timeoutMs },
  );
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return {
      status: 'ERROR',
      command: display,
      findings: [{ code: 'TOOL_CRASH', message: `ESLint did not return JSON (exit ${result.status}). ${result.error || ''}` }],
      stdout: clip(result.stdout),
      stderr: clip(result.stderr),
    };
  }
  const findings = [];
  for (const file of report) {
    for (const msg of file.messages) {
      findings.push({
        code: msg.ruleId || 'PARSE_ERROR',
        file: path.relative(root, file.filePath).split(path.sep).join('/'),
        line: msg.line,
        message: msg.message,
        severity: msg.severity === 2 ? 'error' : 'warning',
      });
    }
  }
  if (report.length === 0) {
    findings.push({ code: 'NO_FILES_CHECKED', message: `${name} gate checked 0 files. src/ must contain JavaScript files.` });
  }
  return {
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    command: display,
    findings,
    stdout: clip(result.stdout, 2000),
    stderr: clip(result.stderr),
    details: { filesChecked: report.length },
  };
}

module.exports = {
  name: 'lint',
  run(ctx) {
    return runEslint({ ...ctx, name: 'lint', configFile: 'eslint.config.js', targets: ['src', 'tests'] });
  },
  runEslint,
};
