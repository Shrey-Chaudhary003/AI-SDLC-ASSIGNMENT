'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', '.selftest-tmp']);

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Hash text files with normalised line endings so Windows (CRLF) and Linux (LF) agree.
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

// Locate an installed package's CLI script without relying on `exports` or shell shims.
function packageBin(root, name, binName = name) {
  let dir = root;
  for (let depth = 0; depth < 4; depth += 1) {
    const pkgJson = path.join(dir, 'node_modules', name, 'package.json');
    if (fs.existsSync(pkgJson)) {
      const meta = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
      const bin = typeof meta.bin === 'string' ? meta.bin : meta.bin && meta.bin[binName];
      return bin ? path.join(path.dirname(pkgJson), bin) : null;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function run(command, args, { cwd, timeoutMs = 180000 } = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : null,
    durationMs: Date.now() - started,
  };
}

// Keep the end of long output (that is where failures are printed).
function clip(text, max = 8000) {
  return text.length <= max ? text : `...[clipped]...\n${text.slice(-max)}`;
}

function gitCommit(root) {
  const r = run('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, timeoutMs: 5000 });
  return r.status === 0 ? r.stdout.trim() : null;
}

module.exports = {
  sha256,
  hashFile,
  walk,
  readJson,
  writeJson,
  packageBin,
  run,
  clip,
  gitCommit,
};
