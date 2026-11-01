'use strict';

const { CliError, storageError } = require('./errors');

const PRIORITIES = new Set(['low', 'medium', 'high']);
const STATUSES = new Set(['todo', 'in_progress', 'done']);
const TASK_FIELDS = new Set([
  'id',
  'title',
  'description',
  'priority',
  'tags',
  'status',
  'createdAt',
]);

function fail(message) {
  throw new CliError(message);
}

function validateTitle(value) {
  if (typeof value !== 'string') {
    fail('title must be between 1 and 100 characters');
  }
  const title = value.trim();
  const length = [...title].length;
  if (length < 1 || length > 100) {
    fail('title must be between 1 and 100 characters');
  }
  return title;
}

function validatePriority(value) {
  if (!PRIORITIES.has(value)) {
    fail(`invalid priority: ${value}`);
  }
  return value;
}

function validateStatus(value) {
  if (!STATUSES.has(value)) {
    fail(`invalid status: ${value}`);
  }
  return value;
}

function validateTaskId(value) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('invalid task id');
  }
  return value;
}

function normalizeTags(values) {
  const tags = [];
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== 'string') {
      fail('tag must not be empty');
    }
    const tag = value.trim().toLowerCase();
    if (tag.length === 0) {
      fail('tag must not be empty');
    }
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

function isCanonicalTimestamp(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateStoredTask(value) {
  if (!isPlainRecord(value)) {
    throw storageError();
  }
  const keys = Object.keys(value);
  if (keys.some((key) => !TASK_FIELDS.has(key))) {
    throw storageError();
  }
  const required = ['id', 'title', 'priority', 'tags', 'status', 'createdAt'];
  if (required.some((key) => !Object.hasOwn(value, key))) {
    throw storageError();
  }
  if (Object.hasOwn(value, 'description') && typeof value.description !== 'string') {
    throw storageError();
  }
  const title = storedTitle(value.title);
  const priority = storedPriority(value.priority);
  const tags = storedTags(value.tags);
  const status = storedStatus(value.status);
  if (!isCanonicalTimestamp(value.createdAt)) {
    throw storageError();
  }
  return buildStoredTask(value, title, priority, tags, status);
}

function storedTitle(value) {
  if (typeof value !== 'string' || value !== value.trim() || [...value].length < 1 || [...value].length > 100) {
    throw storageError();
  }
  return value;
}

function storedPriority(value) {
  if (!PRIORITIES.has(value)) {
    throw storageError();
  }
  return value;
}

function storedTags(value) {
  if (!Array.isArray(value)) {
    throw storageError();
  }
  const seen = new Set();
  for (const tag of value) {
    if (typeof tag !== 'string' || tag.length === 0 || tag !== tag.trim() || tag !== tag.toLowerCase() || seen.has(tag)) {
      throw storageError();
    }
    seen.add(tag);
  }
  return value.slice();
}

function storedStatus(value) {
  if (!STATUSES.has(value)) {
    throw storageError();
  }
  return value;
}

function buildStoredTask(value, title, priority, tags, status) {
  const task = { id: validateStoredId(value.id), title };
  if (Object.hasOwn(value, 'description')) {
    task.description = value.description;
  }
  task.priority = priority;
  task.tags = tags;
  task.status = status;
  task.createdAt = value.createdAt;
  return task;
}

function validateStoredId(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw storageError();
  }
  return value;
}

function validateStoredCollection(value) {
  if (!Array.isArray(value)) {
    throw storageError();
  }
  const ids = new Set();
  const tasks = [];
  for (const entry of value) {
    const task = validateStoredTask(entry);
    if (ids.has(task.id)) {
      throw storageError();
    }
    ids.add(task.id);
    tasks.push(task);
  }
  return tasks;
}

module.exports = {
  isCanonicalTimestamp,
  normalizeTags,
  validatePriority,
  validateStatus,
  validateStoredCollection,
  validateTaskId,
  validateTitle,
};
