'use strict';

const crypto = require('node:crypto');
const { parseArguments } = require('./arguments');
const { CliError, invalidDependencies } = require('./errors');
const { execute } = require('./service');
const storage = require('./storage');

const DEPENDENCY_KEYS = new Set([
  'storagePath',
  'clock',
  'idFactory',
  'stdout',
  'stderr',
]);

function validateDependencies(deps) {
  if (!hasValidDependencyShape(deps)) {
    throw invalidDependencies();
  }
  return readValidClock(deps.clock);
}

function hasValidDependencyShape(deps) {
  if (deps === null || typeof deps !== 'object' || Array.isArray(deps)) {
    return false;
  }
  const keys = Reflect.ownKeys(deps);
  if (keys.length !== DEPENDENCY_KEYS.size) {
    return false;
  }
  if (keys.some((key) => typeof key !== 'string' || !DEPENDENCY_KEYS.has(key))) {
    return false;
  }
  return (
    typeof deps.storagePath === 'string' &&
    deps.storagePath.length > 0 &&
    typeof deps.clock === 'function' &&
    typeof deps.idFactory === 'function' &&
    deps.stdout !== null &&
    typeof deps.stdout === 'object' &&
    typeof deps.stdout.write === 'function' &&
    deps.stderr !== null &&
    typeof deps.stderr === 'object' &&
    typeof deps.stderr.write === 'function'
  );
}

function readValidClock(clock) {
  let now;
  try {
    now = clock();
  } catch (error) {
    throw invalidDependencies();
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw invalidDependencies();
  }
  return now;
}

function main(argv, deps) {
  try {
    const now = validateDependencies(deps);
    const command = parseArguments(argv);
    const tasks = storage.load(deps.storagePath);
    const outcome = execute(command, tasks, deps, now);
    if (outcome.changed) {
      storage.save(deps.storagePath, tasks);
    }
    deps.stdout.write(`${JSON.stringify(outcome.result)}\n`);
    return 0;
  } catch (error) {
    return reportError(error, deps);
  }
}

function reportError(error, deps) {
  if (!(error instanceof CliError)) {
    throw error;
  }
  if (deps && deps.stderr && typeof deps.stderr.write === 'function') {
    deps.stderr.write(`error: ${error.message}\n`);
  }
  return error.exitCode;
}

function runCli() {
  const deps = {
    storagePath: process.env.TODO_FILE || './todo.json',
    clock: () => new Date(),
    idFactory: crypto.randomUUID,
    stdout: process.stdout,
    stderr: process.stderr,
  };
  process.exitCode = main(process.argv.slice(2), deps);
}

module.exports = { main };

if (require.main === module) {
  runCli();
}
