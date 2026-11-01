'use strict';

// GATE 1 - integrity: protected files (tests, specs, harness, lint configs, constitution)
// must be byte-identical to the baseline recorded by `npm run harness:lock`.
// This is the machine-checked version of "do not weaken tests / spec / checks to get PASS".
const { buildManifest, loadManifest, diffManifest } = require('../lib/manifest');

module.exports = {
  name: 'integrity',
  run({ root }) {
    const baseline = loadManifest(root);
    if (!baseline) {
      return {
        status: 'FAIL',
        command: 'compare protected files with .harness/manifest.json',
        findings: [
          {
            code: 'NO_BASELINE',
            message:
              'No .harness/manifest.json. Run `npm run harness:lock -- --reason "baseline before implement"` after tests and harness are committed.',
          },
        ],
      };
    }
    const { added, removed, changed } = diffManifest(baseline.files, buildManifest(root));
    const findings = [
      ...changed.map((file) => ({ code: 'PROTECTED_FILE_CHANGED', file, message: `${file} differs from the locked baseline.` })),
      ...added.map((file) => ({ code: 'PROTECTED_FILE_ADDED', file, message: `${file} was added after the baseline was locked.` })),
      ...removed.map((file) => ({ code: 'PROTECTED_FILE_REMOVED', file, message: `${file} was deleted after the baseline was locked.` })),
    ];
    return {
      status: findings.length === 0 ? 'PASS' : 'FAIL',
      command: 'compare protected files with .harness/manifest.json',
      findings,
      details: { lockedAt: baseline.lockedAt, protectedFileCount: Object.keys(baseline.files).length },
    };
  },
};
