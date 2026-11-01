'use strict';

const express = require('express');
const { CliError } = require('./errors');
const { execute } = require('./service');
const storage = require('./storage');

const CREATE_FIELDS = new Set(['title', 'description', 'priority', 'tags']);
const UPDATE_FIELDS = new Set(['title', 'description', 'priority', 'tags']);

function createApp(deps) {
  validateDependencies(deps);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/api/tasks', (req, res) => listRoute(req, res, deps));
  app.post('/api/tasks', (req, res) => createRoute(req, res, deps));
  app.get('/api/tasks/:id', (req, res) => runRoute(req, res, deps, getCommand(req)));
  app.patch('/api/tasks/:id/status', (req, res) => statusRoute(req, res, deps));
  app.post('/api/tasks/:id/reopen', (req, res) => reopenRoute(req, res, deps));
  app.patch('/api/tasks/:id', (req, res) => updateRoute(req, res, deps));
  app.delete('/api/tasks/:id', (req, res) => runRoute(req, res, deps, deleteCommand(req)));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));
  app.use((error, _req, res, _next) => parserError(error, res));
  return app;
}

function validateDependencies(deps) {
  if (
    !deps ||
    typeof deps.storagePath !== 'string' ||
    typeof deps.clock !== 'function' ||
    typeof deps.idFactory !== 'function'
  ) {
    throw new TypeError('invalid API dependencies');
  }
}

function listRoute(req, res, deps) {
  const options = new Map();
  const tags = queryTags(req.query.tag);
  if (tags.some((tag) => typeof tag !== 'string')) {
    return sendJsonError(res, 400, 'tag must not be empty');
  }
  if (req.query.sort !== undefined && req.query.sort !== 'priority') {
    return sendJsonError(res, 400, `invalid sort: ${req.query.sort}`);
  }
  if (tags.length > 0) {
    options.set('--tag', tags);
  }
  if (req.query.sort !== undefined) {
    options.set('--sort', req.query.sort);
  }
  runRoute(req, res, deps, { name: 'list', options });
}

function queryTags(value) {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function createRoute(req, res, deps) {
  if (!validRequestFields(req.body, CREATE_FIELDS) || !validFieldTypes(req.body)) {
    return sendJsonError(res, 400, 'invalid request body');
  }
  const command = { name: 'add', options: toOptions(req.body) };
  runRoute(req, res, deps, command, 201);
}

function updateRoute(req, res, deps) {
  if (!validRequestFields(req.body, UPDATE_FIELDS) || !validFieldTypes(req.body)) {
    return sendJsonError(res, 400, 'invalid request body');
  }
  if (Object.keys(req.body).length === 0) {
    return sendJsonError(res, 400, 'no update fields provided');
  }
  runRoute(req, res, deps, { name: 'update', id: req.params.id, options: toOptions(req.body) });
}

function validRequestFields(body, allowed) {
  return isRecord(body) && Object.keys(body).every((field) => allowed.has(field));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validFieldTypes(body) {
  return (
    optionalString(body.title, Object.hasOwn(body, 'title')) &&
    optionalString(body.description, Object.hasOwn(body, 'description')) &&
    optionalString(body.priority, Object.hasOwn(body, 'priority')) &&
    optionalTags(body)
  );
}

function optionalString(value, present) {
  return !present || typeof value === 'string';
}

function optionalTags(body) {
  return (
    !Object.hasOwn(body, 'tags') ||
    (Array.isArray(body.tags) && body.tags.every((tag) => typeof tag === 'string'))
  );
}

function toOptions(body) {
  const options = new Map();
  if (Object.hasOwn(body, 'title')) {
    options.set('--title', body.title);
  }
  if (Object.hasOwn(body, 'description')) {
    options.set('--description', body.description);
  }
  if (Object.hasOwn(body, 'priority')) {
    options.set('--priority', body.priority);
  }
  if (Object.hasOwn(body, 'tags')) {
    options.set('--tag', body.tags);
  }
  return options;
}

function statusRoute(req, res, deps) {
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1 || typeof req.body.status !== 'string') {
    return sendJsonError(res, 400, 'invalid request body');
  }
  const command = { name: 'status', id: req.params.id, status: req.body.status };
  runRoute(req, res, deps, command);
}

function reopenRoute(req, res, deps) {
  runRoute(req, res, deps, { name: 'reopen', id: req.params.id });
}

function getCommand(req) {
  return { name: 'get', id: req.params.id };
}

function deleteCommand(req) {
  return { name: 'delete', id: req.params.id };
}

function runRoute(_req, res, deps, command, successStatus = 200) {
  try {
    const tasks = storage.load(deps.storagePath);
    const result = execute(command, tasks, deps, deps.clock());
    if (result.changed) {
      storage.save(deps.storagePath, tasks);
    }
    return res.status(successStatus).json(result.result);
  } catch (error) {
    return handleOperationError(error, res);
  }
}

function handleOperationError(error, res) {
  if (!(error instanceof CliError)) {
    process.stderr.write('Unexpected API operation failure\n');
    return sendJsonError(res, 500, 'internal server error');
  }
  if (error.exitCode === 2) {
    return sendJsonError(res, 500, 'storage error');
  }
  const status = error.exitCode === 3 ? 404 : 400;
  return sendJsonError(res, status, error.message);
}

function parserError(error, res) {
  if (error && error.type === 'entity.parse.failed') {
    return sendJsonError(res, 400, 'invalid JSON body');
  }
  if (error && error.type === 'entity.too.large') {
    return sendJsonError(res, 413, 'request body too large');
  }
  return sendJsonError(res, 500, 'internal server error');
}

function sendJsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = { createApp };
