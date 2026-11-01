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
  return (
    isDependencyRecord(deps) &&
    hasExactDependencyKeys(deps) &&
    hasValidDependencyMembers(deps)
  );
}

function isDependencyRecord(deps) {
  return deps !== null && typeof deps === 'object' && !Array.isArray(deps);
}

function hasExactDependencyKeys(deps) {
  const keys = Reflect.ownKeys(deps);
  if (keys.length !== DEPENDENCY_KEYS.size) {
    return false;
  }
  for (const key of keys) {
    if (typeof key !== 'string' || !DEPENDENCY_KEYS.has(key)) {
      return false;
    }
  }
  return true;
}

function hasValidDependencyMembers(deps) {
  return (
    typeof deps.storagePath === 'string' &&
    deps.storagePath.length > 0 &&
    typeof deps.clock === 'function' &&
    typeof deps.idFactory === 'function' &&
    hasValidSink(deps.stdout) &&
    hasValidSink(deps.stderr)
  );
}

function hasValidSink(sink) {
  return sink !== null && typeof sink === 'object' && typeof sink.write === 'function';
}

function readValidClock(clock) {
  let now;
  try {
    now = clock();
  } catch {
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
