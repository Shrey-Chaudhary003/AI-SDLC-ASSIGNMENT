'use strict';

const path = require('node:path');

function loadConfig(env = process.env, workingDirectory = process.cwd()) {
  const port = parsePort(env.PORT);
  const storageFile = env.TODO_FILE || './todo.json';
  return {
    port,
    storagePath: path.resolve(workingDirectory, storageFile),
    staticPath: path.resolve(workingDirectory, 'dist'),
  };
}

function parsePort(value) {
  if (value === undefined || value === '') {
    return 3001;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

module.exports = { loadConfig };
