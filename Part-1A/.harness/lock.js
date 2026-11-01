'use strict';

/*
 * Lock the protected baseline (tests, specs, harness, lint configs, constitution).
 *   npm run harness:lock -- --reason "baseline before /speckit.implement"
 * Every lock is appended to evidence/lock-history.json, so a legitimate upstream change
 * (for example a spec clarification) is visible as a documented change, not a silent edit.
 */
const path = require('node:path');
const { readJson, writeJson, gitCommit } = require('./lib/util');
const { MANIFEST_REL, buildManifest, loadManifest, diffManifest } = require('./lib/manifest');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const at = args.indexOf('--reason');
const reason = at >= 0 ? args[at + 1] : '';

if (!reason || reason.trim().length < 10) {
  console.error('Usage: npm run harness:lock -- --reason "why the baseline is (re)locked (min 10 chars)"');
  process.exit(2);
}

const previous = loadManifest(ROOT);
const files = buildManifest(ROOT);
const diff = diffManifest(previous ? previous.files : {}, files);
const lockedAt = new Date().toISOString();

writeJson(path.join(ROOT, MANIFEST_REL), { lockedAt, reason: reason.trim(), files });

const historyFile = path.join(ROOT, 'evidence', 'lock-history.json');
const history = readJson(historyFile, []);
history.push({ lockedAt, reason: reason.trim(), gitCommit: gitCommit(ROOT), fileCount: Object.keys(files).length, ...diff });
writeJson(historyFile, history);

console.log(`Locked ${Object.keys(files).length} protected files.`);
console.log(`  added: ${diff.added.length}  changed: ${diff.changed.length}  removed: ${diff.removed.length}`);
console.log('Recorded in evidence/lock-history.json. Commit .harness/manifest.json and evidence/lock-history.json.');
