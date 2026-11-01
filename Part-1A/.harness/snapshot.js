'use strict';

/*
 * Preserve a generation of the application as evidence.
 *   npm run harness:snapshot -- initial-generation
 *   npm run harness:snapshot -- final-generation
 * Copies src/ into evidence/<name>/src and writes SNAPSHOT.json with a hash of every file.
 * Refuses to overwrite an existing snapshot.
 */
const fs = require('node:fs');
const path = require('node:path');
const { walk, hashFile, writeJson, gitCommit } = require('./lib/util');

const ROOT = path.resolve(__dirname, '..');
const name = process.argv[2];

if (!name || !/^[A-Za-z0-9._-]+$/.test(name)) {
  console.error('Usage: npm run harness:snapshot -- <initial-generation|final-generation>');
  process.exit(2);
}
const dest = path.join(ROOT, 'evidence', name);
if (fs.existsSync(dest)) {
  console.error(`evidence/${name} already exists. Evidence is never overwritten.`);
  process.exit(2);
}
const files = walk(ROOT, 'src');
if (files.length === 0) {
  console.error('src/ is empty - nothing to snapshot.');
  process.exit(2);
}
const manifest = {};
for (const rel of files) {
  const target = path.join(dest, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), target);
  manifest[rel] = hashFile(path.join(ROOT, rel));
}
writeJson(path.join(dest, 'SNAPSHOT.json'), { name, createdAt: new Date().toISOString(), gitCommit: gitCommit(ROOT), files: manifest });
console.log(`Saved ${files.length} file(s) to evidence/${name}/`);
