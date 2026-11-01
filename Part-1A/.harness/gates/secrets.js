'use strict';

// GATE 3 - secrets: no keys/tokens in files, and no .env tracked by git.
const fs = require('node:fs');
const path = require('node:path');
const { walk, run } = require('../lib/util');

const PATTERNS = [
  { code: 'GOOGLE_API_KEY', re: /AIza[0-9A-Za-z_-]{35}/ },
  { code: 'OPENAI_STYLE_KEY', re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { code: 'GITHUB_TOKEN', re: /\bgh[pousr]_[A-Za-z0-9]{36,}/ },
  { code: 'AWS_ACCESS_KEY', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { code: 'PRIVATE_KEY', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  {
    code: 'HARDCODED_CREDENTIAL',
    re: /(?:api[_-]?key|secret|token|passw(?:or)?d)\s*[:=]\s*['"][A-Za-z0-9_\-/+=]{12,}['"]/i,
  },
];

const TEXT_EXT = /\.(?:js|cjs|mjs|json|md|ya?ml|txt|toml|ps1|sh)$/i;
const SELF = '.harness/gates/secrets.js';

function mask(value) {
  return `${value.slice(0, 4)}***(${value.length} chars)`;
}

module.exports = {
  name: 'secrets',
  run({ root }) {
    const findings = [];
    for (const rel of walk(root)) {
      if (rel === SELF || rel === 'package-lock.json' || !TEXT_EXT.test(rel)) {
        continue;
      }
      const lines = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const { code, re } of PATTERNS) {
          const match = line.match(re);
          if (match) {
            findings.push({ code, file: rel, line: i + 1, message: `Possible secret ${mask(match[0])}` });
          }
        }
      });
    }
    const tracked = run('git', ['ls-files'], { cwd: root, timeoutMs: 10000 });
    if (tracked.status === 0) {
      for (const file of tracked.stdout.split('\n')) {
        if (/(^|\/)\.env(\.|$)/.test(file) && !file.endsWith('.env.example')) {
          findings.push({ code: 'ENV_FILE_TRACKED', file, message: `${file} is tracked by git. Remove it from git and rotate the key.` });
        }
      }
    }
    return {
      status: findings.length === 0 ? 'PASS' : 'FAIL',
      command: 'regex secret scan + git ls-files .env check',
      findings,
    };
  },
};
