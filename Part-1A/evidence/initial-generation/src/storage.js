'use strict';

const fs = require('node:fs');
const { storageError } = require('./errors');
const { validateStoredCollection } = require('./validation');

function load(storagePath) {
  let contents;
  try {
    contents = fs.readFileSync(storagePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw storageError();
  }
  return parseTasks(contents);
}

function parseTasks(contents) {
  let tasks;
  try {
    tasks = JSON.parse(contents);
  } catch (error) {
    throw storageError();
  }
  return validateStoredCollection(tasks);
}

function save(storagePath, tasks) {
  const contents = `${JSON.stringify(tasks)}\n`;
  try {
    fs.writeFileSync(storagePath, contents, 'utf8');
  } catch (error) {
    throw storageError();
  }
}

module.exports = { load, save };
