'use strict';

/*
 * Harness self-test: proves the sensors really detect problems on THIS computer, using
 * tiny throw-away fixtures. Run it once after `npm install`, before relying on the harness.
 *   npm run harness:selftest
 * It never touches src/ or tests/ of your project; it works in .harness/.selftest-tmp/.
 */
const fs = require('node:fs');
const path = require('node:path');
const { readJson } = require('./lib/util');

const ROOT = path.resolve(__dirname, '..');
const TMP = path.join(__dirname, '.selftest-tmp');
const config = readJson(path.join(__dirname, 'harness-config.json'), {});
const gates = Object.fromEntries(['static', 'secrets', 'lint', 'security', 'tests'].map((n) => [n, require(`./gates/${n}`)]));

function put(rel, content) {
  const file = path.join(TMP, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function freshProject() {
  fs.rmSync(TMP, { recursive: true, force: true });
  for (const cfg of ['eslint.config.js', 'eslint.security.config.js']) {
    put(cfg, fs.readFileSync(path.join(ROOT, cfg), 'utf8'));
  }
  put('package.json', '{ "name": "selftest", "private": true }\n');
  put('specs/001-demo/spec.md', '# Demo\n- AC-001: add(1, 2) returns 3\n');
  put('src/math.js', "'use strict';\nfunction add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };\n");
  put(
    'tests/math.test.js',
    "'use strict';\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { add } = require('../src/math');\n\ntest('AC-001: adds two numbers', () => {\n  assert.strictEqual(add(1, 2), 3);\n});\n",
  );
}

function runAll() {
  const ctx = { root: TMP, config, label: 'selftest' };
  return Object.fromEntries(Object.entries(gates).map(([name, gate]) => [name, gate.run(ctx)]));
}

const codes = (result) => result.findings.map((f) => f.code);
const checks = [];
function expect(description, condition) {
  checks.push({ description, ok: Boolean(condition) });
}

// ---- Scenario 1: a clean project must PASS every gate ----
freshProject();
let result = runAll();
for (const [name, r] of Object.entries(result)) {
  expect(`clean project: ${name} gate PASSES (${r.status}${r.findings.length ? ` - ${codes(r).join(',')}` : ''})`, r.status === 'PASS');
}

// ---- Scenario 2: deliberately bad project must be CAUGHT by each gate ----
freshProject();
put('src/bad.js', "var danger = eval(process.argv[2]);\nconst key = '" + 'AIza' + "SyA1234567890abcdefghijklmnopqrstuv';\nmodule.exports = { danger, key };\n");
put('tests/weak.test.js', "'use strict';\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\n\ntest('AC-001: weak exit code check', () => {\n  const exitCode = 1;\n  assert.ok(exitCode >= 1);\n});\n");
result = runAll();
expect('bad project: lint reports no-var and no-eval', ['no-var', 'no-eval'].every((c) => codes(result.lint).includes(c)));
expect('bad project: security reports detect-eval-with-expression', codes(result.security).includes('security/detect-eval-with-expression'));
expect('bad project: secrets reports GOOGLE_API_KEY', codes(result.secrets).includes('GOOGLE_API_KEY'));
expect('bad project: static reports WEAK_EXIT_CODE_ASSERTION', codes(result.static).includes('WEAK_EXIT_CODE_ASSERTION'));
expect('bad project: tests gate enforces coverage threshold', codes(result.tests).includes('COVERAGE_BELOW_THRESHOLD'));

fs.rmSync(TMP, { recursive: true, force: true });

console.log('\nHARNESS SELF-TEST');
for (const c of checks) {
  console.log(`  ${c.ok ? 'OK     ' : 'NOT OK '} ${c.description}`);
}
const failed = checks.filter((c) => !c.ok).length;
console.log(failed === 0 ? '\nSELF-TEST PASSED: the sensors work on this machine.' : `\nSELF-TEST FAILED (${failed}). Fix tool installation (npm install) before trusting harness results.`);
process.exit(failed === 0 ? 0 : 1);
