'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { walk, hashFile, sha256, readJson } = require('./util');

const MANIFEST_REL = '.harness/manifest.json';

function loadConfig(root) {
  return readJson(path.join(root, '.harness', 'harness-config.json'), {
    protectedPaths: ['tests', 'specs', '.harness'],
    protectedFiles: [],
  });
}

// Files the coding agent is NOT allowed to change after the baseline is locked.
function protectedFiles(root) {
  const config = loadConfig(root);
  const files = [];
  for (const dir of config.protectedPaths) {
    files.push(...walk(root, dir));
  }
  for (const file of config.protectedFiles) {
    if (fs.existsSync(path.join(root, file))) {
      files.push(file);
    }
  }
  return [...new Set(files)].filter((f) => f !== MANIFEST_REL).sort();
}


// /speckit.implement legitimately ticks "- [ ]" to "- [X]" in specs/*/tasks.md. The checkbox state is
// ignored when hashing that one file, so any other edit to the task list is still detected.
function hashProtected(root, rel) {
  if (/(^|\/)specs\/.*tasks\.md$/.test(rel)) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n').replace(/\[[xX]\]/g, '[ ]');
    return sha256(text);
  }
  return hashFile(path.join(root, rel));
}

function buildManifest(root) {
  const files = {};
  for (const rel of protectedFiles(root)) {
    files[rel] = hashProtected(root, rel);
  }
  return files;
}

function loadManifest(root) {
  return readJson(path.join(root, MANIFEST_REL), null);
}

function diffManifest(previousFiles, currentFiles) {
  const added = Object.keys(currentFiles).filter((f) => !(f in previousFiles));
  const removed = Object.keys(previousFiles).filter((f) => !(f in currentFiles));
  const changed = Object.keys(currentFiles).filter(
    (f) => f in previousFiles && previousFiles[f] !== currentFiles[f],
  );
  return { added, removed, changed };
}

module.exports = {
  MANIFEST_REL,
  protectedFiles,
  buildManifest,
  loadManifest,
  diffManifest,
};
