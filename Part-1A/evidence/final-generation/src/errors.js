'use strict';

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

function invalidDependencies() {
  return new CliError('invalid dependencies');
}

function storageError() {
  return new CliError('storage error', 2);
}

module.exports = { CliError, invalidDependencies, storageError };
