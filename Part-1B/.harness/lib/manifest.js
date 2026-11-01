'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { walk, hashFile, sha256, readJson } = require('./util');

const MANIFEST_REL = '.harness/manifest.json';
// Everything that defines "what correct means". The coding agent may change src/ and prompts/ only.
const PROTECTED_DIRS = ['evals', 'specs', '.harness'];
const PROTECTED_FILES = ['.specify/memory/constitution.md'];

function protectedFiles(root) {
  const files = [];
  for (const dir of PROTECTED_DIRS) {
    files.push(...walk(root, dir));
  }
  for (const file of PROTECTED_FILES) {
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
  return {
    added: Object.keys(currentFiles).filter((f) => !(f in previousFiles)),
    removed: Object.keys(previousFiles).filter((f) => !(f in currentFiles)),
    changed: Object.keys(currentFiles).filter((f) => f in previousFiles && previousFiles[f] !== currentFiles[f]),
  };
}

module.exports = { MANIFEST_REL, buildManifest, loadManifest, diffManifest };
