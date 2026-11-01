'use strict';

// GATE 2 - static sensor (same idea as Lab Sheet 2 sensor.js "static checks"):
//   * no suppression comments (eslint-disable, c8 ignore, nosec ...)
//   * no weak / skipped / trivial tests
//   * every test title carries an AC-ID and every AC-ID in the spec has at least one test
//   * no runtime dependencies (Node built-ins only)
const fs = require('node:fs');
const path = require('node:path');
const { walk } = require('../lib/util');

const SUPPRESSIONS = [
  /eslint-disable/,
  /c8\s+ignore/,
  /istanbul\s+ignore/,
  /nosec/i,
  /nosemgrep/,
  /@ts-nocheck/,
  /NOSONAR/i,
];

const WEAK_TEST_PATTERNS = [
  {
    code: 'WEAK_EXIT_CODE_ASSERTION',
    re: /assert\.ok\(.*\b(?:exitCode|exit_code|status|code)\b.*(?:>=|<=|>|<|!==|!=)/,
    message: 'Broad exit-code assertion. Use assert.strictEqual(exitCode, <exact code from spec>).',
  },
  {
    code: 'WEAK_RANGE_ASSERTION',
    re: /assert\.ok\(.*(?:>=|<=)/,
    message: 'Range assertion (>= / <=) accepts many wrong answers. Assert the exact value from the acceptance criterion.',
  },
  { code: 'TRIVIAL_ASSERTION', re: /assert(?:\.ok)?\(\s*true\s*\)/, message: 'Trivial assertion that can never fail.' },
  {
    code: 'SKIPPED_TEST',
    re: /\b(?:test|it|describe)\.(?:skip|todo|only)\b|\{\s*(?:skip|todo|only)\s*:/,
    message: 'Skipped, todo or .only test.',
  },
];

const AC_IN_SPEC = /\bAC-(\d{2,4})\b/g;
const AC_IN_TEXT = /\bAC[-_ ]?(\d{2,4})\b/gi;
const TEST_TITLE = /\b(?:test|it)\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function readSpecAcs(root) {
  const specFiles = walk(root, 'specs').filter((f) => /(^|\/)spec\.md$/.test(f));
  const acs = new Set();
  for (const rel of specFiles) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const match of text.matchAll(AC_IN_SPEC)) {
      acs.add(`AC-${match[1]}`);
    }
  }
  return { specFiles, acs: [...acs].sort() };
}

function scanSuppressions(root, files, findings) {
  for (const rel of files) {
    const lines = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const re of SUPPRESSIONS) {
        if (re.test(line)) {
          findings.push({
            code: 'SUPPRESSION_COMMENT',
            file: rel,
            line: i + 1,
            message: `Forbidden check suppression (${re.source}): ${line.trim().slice(0, 100)}`,
          });
        }
      }
    });
  }
}

function scanTests(root, testFiles, findings) {
  const testedAcs = {};
  for (const rel of testFiles) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    if (!/node:test/.test(text) || !/node:assert\/strict/.test(text)) {
      findings.push({
        code: 'TEST_STYLE',
        file: rel,
        message: "Tests must use require('node:test') and require('node:assert/strict').",
      });
    }
    text.split('\n').forEach((line, i) => {
      for (const rule of WEAK_TEST_PATTERNS) {
        if (rule.re.test(line)) {
          findings.push({ code: rule.code, file: rel, line: i + 1, message: rule.message });
        }
      }
    });
    for (const match of text.matchAll(TEST_TITLE)) {
      const title = match[2];
      const ids = [...title.matchAll(AC_IN_TEXT)].map((m) => `AC-${m[1]}`);
      if (ids.length === 0) {
        findings.push({
          code: 'TEST_WITHOUT_AC_ID',
          file: rel,
          line: lineOf(text, match.index),
          message: `Test title has no AC-ID: "${title}". Name tests like 'AC-007: invalid transition is rejected'.`,
        });
      }
      for (const id of ids) {
        (testedAcs[id] = testedAcs[id] || []).push(`${rel}: ${title}`);
      }
    }
  }
  return testedAcs;
}

module.exports = {
  name: 'static',
  run({ root }) {
    const findings = [];
    const srcFiles = walk(root, 'src').filter((f) => f.endsWith('.js'));
    const testFiles = walk(root, 'tests').filter((f) => /\.test\.(?:c|m)?js$/.test(f));

    scanSuppressions(root, [...srcFiles, ...testFiles], findings);
    const testedAcs = scanTests(root, testFiles, findings);

    const { specFiles, acs } = readSpecAcs(root);
    if (specFiles.length === 0) {
      findings.push({ code: 'NO_SPEC', message: 'No specs/*/spec.md found. Run /speckit.specify first.' });
    } else if (acs.length === 0) {
      findings.push({ code: 'NO_AC_IN_SPEC', message: 'spec.md contains no acceptance criteria written as AC-001, AC-002, ...' });
    }
    const untested = acs.filter((id) => !testedAcs[id]);
    const unknown = Object.keys(testedAcs).filter((id) => !acs.includes(id));
    for (const id of untested) {
      findings.push({ code: 'AC_WITHOUT_TEST', message: `${id} is in the spec but no test title mentions it.` });
    }
    for (const id of unknown) {
      findings.push({ code: 'TEST_FOR_UNKNOWN_AC', message: `${id} is used in tests but not defined in the spec.` });
    }

    const pkg = path.join(root, 'package.json');
    if (fs.existsSync(pkg)) {
      const deps = JSON.parse(fs.readFileSync(pkg, 'utf8')).dependencies || {};
      if (Object.keys(deps).length > 0) {
        findings.push({
          code: 'RUNTIME_DEPENDENCY',
          message: `Runtime dependencies are not allowed (Node built-ins only): ${Object.keys(deps).join(', ')}`,
        });
      }
    }

    return {
      status: findings.length === 0 ? 'PASS' : 'FAIL',
      command: 'static sensor (suppressions, weak tests, AC traceability, dependencies)',
      findings,
      artifact: {
        name: 'traceability',
        data: { specAcs: acs, testsPerAc: testedAcs, acWithoutTest: untested, testsForUnknownAc: unknown },
      },
    };
  },
};
