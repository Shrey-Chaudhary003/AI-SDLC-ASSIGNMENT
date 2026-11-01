'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { main } = require('../src/cli');
const { createApp } = require('../src/api');
const { loadConfig } = require('../src/config');
const { createClock } = require('../src/clock');
const { createProductionApp } = require('../src/server');

const FIXED_DATE = '2026-11-01T10:00:00.000Z';
const T1 = { id: 'task-001', title: 'Read book', priority: 'medium', tags: ['work'], status: 'todo', createdAt: FIXED_DATE };
const T2 = { id: 'task-002', title: 'Buy milk', priority: 'low', tags: ['home'], status: 'todo', createdAt: '2026-11-01T10:01:00.000Z' };
const T3 = { id: 'task-both', title: 'Plan', priority: 'medium', tags: ['work', 'home'], status: 'todo', createdAt: '2026-11-01T10:02:00.000Z' };
const T4 = { id: 'task-workshop', title: 'Workshop', priority: 'medium', tags: ['workshop'], status: 'todo', createdAt: '2026-11-01T10:03:00.000Z' };
const T5 = { id: 'task-high-both', title: 'Urgent plan', priority: 'high', tags: ['work', 'home'], status: 'todo', createdAt: '2026-11-01T10:04:00.000Z' };

async function createApi(t, initialTasks) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-todo-api-'));
  const storagePath = path.join(directory, 'tasks.json');
  if (initialTasks !== undefined) {
    fs.writeFileSync(storagePath, `${JSON.stringify(initialTasks)}\n`, 'utf8');
  }
  const app = createApp({ storagePath, clock: () => new Date(FIXED_DATE), idFactory: () => 'web-1' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { url: `http://127.0.0.1:${server.address().port}`, storagePath };
}

async function callApi(api, route, options) {
  const response = await fetch(`${api.url}${route}`, options);
  return {
    status: response.status,
    text: await response.text(),
    contentType: response.headers.get('content-type'),
  };
}

function jsonRequest(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function parsedResponse(response) {
  return JSON.parse(response.text);
}

test('AC-053: health returns exact JSON without task storage', async (t) => {
  const api = await createApi(t);
  const response = await callApi(api, '/api/health');
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.contentType, 'application/json; charset=utf-8');
  assert.strictEqual(response.text, '{"status":"ok"}');
  assert.strictEqual(fs.existsSync(api.storagePath), false);
});

test('AC-054: tag AND filter is applied before priority sorting', async (t) => {
  const api = await createApi(t, [T1, T2, T3, T4, T5]);
  const response = await callApi(api, '/api/tasks?tag=work&tag=home&sort=priority');
  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(parsedResponse(response), [T5, T3]);
});

test('AC-055: create normalizes fields and uses injected dependencies', async (t) => {
  const api = await createApi(t);
  const response = await callApi(api, '/api/tasks', jsonRequest('POST', { title: '  Read book  ', tags: ['Work', 'work'] }));
  const expected = { id: 'web-1', title: 'Read book', priority: 'medium', tags: ['work'], status: 'todo', createdAt: FIXED_DATE };
  assert.strictEqual(response.status, 201);
  assert.deepStrictEqual(parsedResponse(response), expected);
  assert.strictEqual(response.text, JSON.stringify(expected));
});

test('AC-056: invalid create data returns exact error without writing storage', async (t) => {
  const api = await createApi(t);
  const response = await callApi(api, '/api/tasks', jsonRequest('POST', { title: ' ', priority: 'urgent' }));
  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.text, '{"error":"title must be between 1 and 100 characters"}');
  assert.strictEqual(fs.existsSync(api.storagePath), false);
});

test('AC-057: missing task uses the exact not-found response', async (t) => {
  const api = await createApi(t, []);
  const response = await callApi(api, '/api/tasks/missing');
  assert.strictEqual(response.status, 404);
  assert.strictEqual(response.text, '{"error":"task not found: missing"}');
});

test('AC-058: patch updates supplied task fields and preserves contract field order', async (t) => {
  const api = await createApi(t, [T1]);
  const payload = { title: 'New', description: 'note', priority: 'high', tags: ['Work', 'home'] };
  const response = await callApi(api, '/api/tasks/task-001', jsonRequest('PATCH', payload));
  const expected = { id: T1.id, title: 'New', description: 'note', priority: 'high', tags: ['work', 'home'], status: 'todo', createdAt: FIXED_DATE };
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.text, JSON.stringify(expected));
  assert.deepStrictEqual(parsedResponse(response), expected);
});

test('AC-059: invalid status transitions are rejected without mutation', async (t) => {
  const api = await createApi(t, [T1]);
  const before = fs.readFileSync(api.storagePath, 'utf8');
  const response = await callApi(api, '/api/tasks/task-001/status', jsonRequest('PATCH', { status: 'done' }));
  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.text, '{"error":"invalid status transition: todo -> done"}');
  assert.strictEqual(fs.readFileSync(api.storagePath, 'utf8'), before);
});

test('AC-060: reopening a completed task changes its status to todo', async (t) => {
  const api = await createApi(t, [{ ...T1, status: 'done' }]);
  const response = await callApi(api, '/api/tasks/task-001/reopen', { method: 'POST' });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(parsedResponse(response).status, 'todo');
});

test('AC-061: delete returns the exact receipt and removes the task', async (t) => {
  const api = await createApi(t, [T1]);
  const response = await callApi(api, '/api/tasks/task-001', { method: 'DELETE' });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.text, '{"deleted":true,"id":"task-001"}');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(api.storagePath, 'utf8')), []);
});

test('AC-062: unknown API routes return a JSON 404', async (t) => {
  const api = await createApi(t);
  const response = await callApi(api, '/api/not-a-route');
  assert.strictEqual(response.status, 404);
  assert.strictEqual(response.text, '{"error":"not found"}');
});

test('AC-067: API-created tasks are visible to the CLI on shared storage', async (t) => {
  const api = await createApi(t);
  const created = await callApi(api, '/api/tasks', jsonRequest('POST', { title: 'Shared task' }));
  const output = { text: '', error: '' };
  const code = main(['list'], {
    storagePath: api.storagePath,
    clock: () => new Date(FIXED_DATE),
    idFactory: () => 'unused',
    stdout: { write(text) { output.text += text; } },
    stderr: { write(text) { output.error += text; } },
  });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(code, 0);
  assert.deepStrictEqual(JSON.parse(output.text), [parsedResponse(created)]);
  assert.strictEqual(output.error, '');
});

test('AC-068: malformed stored JSON is not exposed or overwritten by the API', async (t) => {
  const api = await createApi(t);
  fs.writeFileSync(api.storagePath, '{broken', 'utf8');
  const before = fs.readFileSync(api.storagePath, 'utf8');
  const response = await callApi(api, '/api/tasks');
  assert.strictEqual(response.status, 500);
  assert.strictEqual(response.text, '{"error":"storage error"}');
  assert.strictEqual(fs.readFileSync(api.storagePath, 'utf8'), before);
});

test('AC-070: empty description is omitted and an empty tag array is persisted', async (t) => {
  const api = await createApi(t, [{ ...T1, description: 'Note' }]);
  const response = await callApi(api, '/api/tasks/task-001', jsonRequest('PATCH', { description: '', tags: [] }));
  const expected = { id: T1.id, title: T1.title, priority: T1.priority, tags: [], status: T1.status, createdAt: FIXED_DATE };
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.text, JSON.stringify(expected));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(api.storagePath, 'utf8')), [expected]);
});

test('AC-081: production app serves the built browser entry point', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-todo-static-'));
  const staticPath = path.join(directory, 'dist');
  fs.mkdirSync(staticPath);
  fs.writeFileSync(path.join(staticPath, 'index.html'), '<main>Daymark</main>');
  const app = createProductionApp({ staticPath }, {
    storagePath: path.join(directory, 'tasks.json'),
    clock: () => new Date(FIXED_DATE),
    idFactory: () => 'web-1',
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.strictEqual(response.status, 200);
  assert.strictEqual(await response.text(), '<main>Daymark</main>');
});

test('AC-082: get task returns the exact task from storage', async (t) => {
  const api = await createApi(t, [T1]);
  const response = await callApi(api, '/api/tasks/task-001');
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.text, JSON.stringify(T1));
});

test('AC-083: malformed JSON requests return an exact JSON client error', async (t) => {
  const api = await createApi(t);
  const response = await callApi(api, '/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.text, '{"error":"invalid JSON body"}');
});

test('AC-084: an empty patch is rejected without changing storage', async (t) => {
  const api = await createApi(t, [T1]);
  const before = fs.readFileSync(api.storagePath, 'utf8');
  const response = await callApi(api, '/api/tasks/task-001', jsonRequest('PATCH', {}));
  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.text, '{"error":"no update fields provided"}');
  assert.strictEqual(fs.readFileSync(api.storagePath, 'utf8'), before);
});

test('AC-085: unsupported list sorting returns an exact JSON validation error', async (t) => {
  const api = await createApi(t, []);
  const response = await callApi(api, '/api/tasks?sort=date');
  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.text, '{"error":"invalid sort: date"}');
});

test('AC-071: server configuration uses documented defaults and injected environment values', () => {
  assert.deepStrictEqual(loadConfig({}, 'C:\\todo'), {
    port: 3001,
    storagePath: path.resolve('C:\\todo', './todo.json'),
    staticPath: path.resolve('C:\\todo', 'dist'),
  });
  assert.strictEqual(loadConfig({ PORT: '4010', TODO_FILE: 'data.json' }, 'C:\\todo').port, 4010);
  assert.throws(() => loadConfig({ PORT: '0' }, 'C:\\todo'), { message: 'PORT must be an integer between 1 and 65535' });
});

test('AC-072: the production clock factory supplies a Date value', () => {
  assert.strictEqual(createClock()() instanceof Date, true);
});
