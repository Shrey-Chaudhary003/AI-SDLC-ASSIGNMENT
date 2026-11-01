'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', '.selftest-tmp']);

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Hash text with normalised line endings so Windows (CRLF) and Linux (LF) agree.
function hashFile(absPath) {
  return sha256(fs.readFileSync(absPath, 'utf8').replace(/\r\n/g, '\n'));
}

function walk(root, relDir = '') {
  const abs = path.join(root, relDir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    return [];
  }
  const found = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...walk(root, rel));
    } else if (entry.isFile()) {
      found.push(rel);
    }
  }
  return found.sort();
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function gitCommit(root) {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 5000 });
  return result.status === 0 ? result.stdout.trim() : null;
}

module.exports = { sha256, hashFile, walk, readJson, writeJson, sleep, gitCommit };
