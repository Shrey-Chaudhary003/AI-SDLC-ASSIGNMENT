'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { main } = require('../src/cli');

const FIXED_DATE = '2026-11-01T10:00:00.000Z';

const T1 = {
  id: 'task-001',
  title: 'Read book',
  priority: 'medium',
  tags: ['work'],
  status: 'todo',
  createdAt: FIXED_DATE,
};

const T2 = {
  id: 'task-002',
  title: 'Buy milk',
  priority: 'low',
  tags: ['home'],
  status: 'todo',
  createdAt: '2026-11-01T10:01:00.000Z',
};

const T3 = {
  id: 'task-both',
  title: 'Plan',
  priority: 'medium',
  tags: ['work', 'home'],
  status: 'todo',
  createdAt: '2026-11-01T10:02:00.000Z',
};

const T4 = {
  id: 'task-workshop',
  title: 'Workshop',
  priority: 'medium',
  tags: ['workshop'],
  status: 'todo',
  createdAt: '2026-11-01T10:03:00.000Z',
};

const T5 = {
  id: 'task-high-both',
  title: 'Urgent plan',
  priority: 'high',
  tags: ['work', 'home'],
  status: 'todo',
  createdAt: '2026-11-01T10:04:00.000Z',
};

function createHarness(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-todo-'));
  const storagePath = path.join(directory, 'tasks.json');
  let idCounter = options.initialId === undefined ? 0 : options.initialId;
  let stdout = '';
  let stderr = '';
  const idPrefix = options.idPrefix === undefined ? 't' : options.idPrefix;

  const deps = {
    storagePath,
    clock: () => new Date(options.date || FIXED_DATE),
    idFactory:
      options.idFactory || (() => `${idPrefix}${++idCounter}`),
    stdout: {
      write(text) {
        stdout += text;
      },
    },
    stderr: {
      write(text) {
        stderr += text;
      },
    },
  };

  t.after(() => {
    if (fs.existsSync(storagePath) && fs.statSync(storagePath).isFile()) {
      fs.chmodSync(storagePath, 0o600);
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });

  return {
    deps,
    storagePath,
    run(argv, dependencies = deps) {
      stdout = '';
      stderr = '';
      const code = main(argv, dependencies);
      return { code, stdout, stderr };
    },
    seed(tasks) {
      fs.writeFileSync(storagePath, `${JSON.stringify(tasks)}\n`, 'utf8');
    },
    readTasks() {
      return JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    },
    readStorage() {
      return fs.readFileSync(storagePath, 'utf8');
    },
    get directory() {
      return directory;
    },
  };
}

function assertSuccess(result, expected, code = 0) {
  assert.strictEqual(result.code, code);
  assert.deepStrictEqual(JSON.parse(result.stdout), expected);
  assert.strictEqual(result.stdout, `${JSON.stringify(expected)}\n`);
  assert.strictEqual(result.stderr, '');
}

function assertFailure(result, code, message) {
  assert.strictEqual(result.code, code);
  assert.strictEqual(result.stdout, '');
  assert.strictEqual(result.stderr, `error: ${message}\n`);
}

function taskWithStatus(status) {
  return { ...T1, status };
}

test('AC-001: add trims the title and applies task defaults', (t) => {
  const harness = createHarness(t, { idPrefix: 'task-00' });
  const expected = {
    id: 'task-001',
    title: 'Read book',
    priority: 'medium',
    tags: [],
    status: 'todo',
    createdAt: FIXED_DATE,
  };

  const result = harness.run(['add', '--title', '  Read book  ']);

  assertSuccess(result, expected);
  assert.deepStrictEqual(harness.readTasks(), [expected]);
});

test('AC-002: an empty title is rejected without changing storage', (t) => {
  const harness = createHarness(t);
  harness.seed([]);
  const before = harness.readStorage();

  const result = harness.run(['add', '--title', '']);

  assertFailure(result, 1, 'title must be between 1 and 100 characters');
  assert.strictEqual(harness.readStorage(), before);
});

test('AC-003: a whitespace-only title is rejected', (t) => {
  const harness = createHarness(t);
  harness.seed([]);

  const result = harness.run(['add', '--title', '   ']);

  assertFailure(result, 1, 'title must be between 1 and 100 characters');
});

test('AC-004: a title of exactly 100 characters is accepted', (t) => {
  const harness = createHarness(t);
  const title = 'A'.repeat(100);
  const expected = {
    id: 't1',
    title,
    priority: 'medium',
    tags: [],
    status: 'todo',
    createdAt: FIXED_DATE,
  };

  const result = harness.run(['add', '--title', title]);

  assertSuccess(result, expected);
});

test('AC-005: a title of 101 characters is rejected', (t) => {
  const harness = createHarness(t);

  const result = harness.run(['add', '--title', 'A'.repeat(101)]);

  assertFailure(result, 1, 'title must be between 1 and 100 characters');
});

test('AC-006: an unsupported priority is rejected', (t) => {
  const harness = createHarness(t);

  const result = harness.run([
    'add',
    '--title',
    'Urgent',
    '--priority',
    'urgent',
  ]);

  assertFailure(result, 1, 'invalid priority: urgent');
});

test('AC-007: get returns the exact stored task object', (t) => {
  const harness = createHarness(t);
  harness.seed([T1]);

  const result = harness.run(['get', 'task-001']);

  assertSuccess(result, T1);
});

test('AC-008: every task command reports an unknown ID with exit code 3', (t) => {
  const harness = createHarness(t);
  const commands = [
    ['get', 'missing'],
    ['update', 'missing', '--title', 'New'],
    ['status', 'missing', 'in_progress'],
    ['reopen', 'missing'],
    ['delete', 'missing'],
  ];

  for (const argv of commands) {
    harness.seed([]);
    assertFailure(harness.run(argv), 3, 'task not found: missing');
  }
});

test('AC-009: update changes supplied fields and normalizes tags', (t) => {
  const harness = createHarness(t);
  harness.seed([T1]);
  const expected = {
    id: T1.id,
    title: 'New',
    description: 'note',
    priority: 'high',
    tags: ['work', 'home'],
    status: T1.status,
    createdAt: T1.createdAt,
  };

  const result = harness.run([
    'update',
    'task-001',
    '--title',
    'New',
    '--description',
    'note',
    '--priority',
    'high',
    '--tag',
    'Work',
    '--tag',
    'work',
    '--tag',
    'Home',
  ]);

  assertSuccess(result, expected);
});


test('AC-010: todo can transition to in_progress', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('todo')]);

  const result = harness.run(['status', 'task-001', 'in_progress']);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(JSON.parse(result.stdout).status, 'in_progress');
  assert.strictEqual(result.stderr, '');
});

test('AC-011: in_progress can transition to done', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('in_progress')]);

  const result = harness.run(['status', 'task-001', 'done']);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(JSON.parse(result.stdout).status, 'done');
  assert.strictEqual(result.stderr, '');
});

test('AC-012: in_progress can transition to todo', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('in_progress')]);

  const result = harness.run(['status', 'task-001', 'todo']);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(JSON.parse(result.stdout).status, 'todo');
  assert.strictEqual(result.stderr, '');
});

test('AC-013: a done task can be reopened to todo', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('done')]);

  const result = harness.run(['reopen', 'task-001']);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(JSON.parse(result.stdout).status, 'todo');
  assert.strictEqual(result.stderr, '');
});

test('AC-014: todo cannot transition to todo', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('todo')]);

  assertFailure(
    harness.run(['status', 'task-001', 'todo']),
    1,
    'invalid status transition: todo -> todo',
  );
});

test('AC-015: todo cannot transition directly to done', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('todo')]);

  assertFailure(
    harness.run(['status', 'task-001', 'done']),
    1,
    'invalid status transition: todo -> done',
  );
});

test('AC-016: in_progress cannot transition to itself', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('in_progress')]);

  assertFailure(
    harness.run(['status', 'task-001', 'in_progress']),
    1,
    'invalid status transition: in_progress -> in_progress',
  );
});

test('AC-017: done cannot transition to todo through status', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('done')]);

  assertFailure(
    harness.run(['status', 'task-001', 'todo']),
    1,
    'invalid status transition: done -> todo',
  );
});

test('AC-018: done cannot transition to in_progress', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('done')]);

  assertFailure(
    harness.run(['status', 'task-001', 'in_progress']),
    1,
    'invalid status transition: done -> in_progress',
  );
});

test('AC-019: done cannot transition to itself', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('done')]);

  assertFailure(
    harness.run(['status', 'task-001', 'done']),
    1,
    'invalid status transition: done -> done',
  );
});

test('AC-020: a todo task cannot be reopened', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('todo')]);

  assertFailure(
    harness.run(['reopen', 'task-001']),
    1,
    'invalid status transition: todo -> todo',
  );
});

test('AC-021: an in_progress task cannot be reopened', (t) => {
  const harness = createHarness(t);
  harness.seed([taskWithStatus('in_progress')]);

  assertFailure(
    harness.run(['reopen', 'task-001']),
    1,
    'invalid status transition: in_progress -> todo',
  );
});

test('AC-022: list preserves creation order by default', (t) => {
  const harness = createHarness(t);
  harness.seed([T1, T2]);

  const result = harness.run(['list']);

  assertSuccess(result, [T1, T2]);
});

test('AC-023: listing a missing storage file returns an empty array', (t) => {
  const harness = createHarness(t);

  const result = harness.run(['list']);

  assertSuccess(result, []);
});

test('AC-024: repeated tag filters use AND matching', (t) => {
  const harness = createHarness(t);
  harness.seed([T1, T2, T3]);

  const result = harness.run(['list', '--tag', 'work', '--tag', 'home']);

  assertSuccess(result, [T3]);
});

test('AC-025: an unmatched tag filter returns an empty array', (t) => {
  const harness = createHarness(t);
  harness.seed([T1, T2]);

  const result = harness.run(['list', '--tag', 'missing']);

  assertSuccess(result, []);
});

test('AC-026: added tags are lowercased and deduplicated', (t) => {
  const harness = createHarness(t);
  const expected = {
    id: 't1',
    title: 'Task',
    priority: 'medium',
    tags: ['work', 'home'],
    status: 'todo',
    createdAt: FIXED_DATE,
  };

  const result = harness.run([
    'add',
    '--title',
    'Task',
    '--tag',
    'Work',
    '--tag',
    'work',
    '--tag',
    'Home',
  ]);

  assertSuccess(result, expected);
  assert.deepStrictEqual(harness.readTasks(), [expected]);
});

test('AC-027: priority sorting orders priority and stable ties', (t) => {
  const harness = createHarness(t);
  const tasks = [
    { ...T1, id: 'task-a', priority: 'high' },
    { ...T1, id: 'task-b', priority: 'high' },
    { ...T1, id: 'task-c', priority: 'medium' },
    { ...T1, id: 'task-d', priority: 'low' },
  ];
  harness.seed(tasks);

  const result = harness.run(['list', '--sort', 'priority']);

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(
    JSON.parse(result.stdout).map((task) => task.id),
    ['task-a', 'task-b', 'task-c', 'task-d'],
  );
  assert.strictEqual(result.stderr, '');
});

test('AC-028: adding to missing storage creates a one-task JSON array', (t) => {
  const harness = createHarness(t);

  const result = harness.run(['add', '--title', 'Task']);

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(harness.readTasks(), [
    {
      id: 't1',
      title: 'Task',
      priority: 'medium',
      tags: [],
      status: 'todo',
      createdAt: FIXED_DATE,
    },
  ]);
});

test('AC-029: corrupt JSON is rejected and left unchanged', (t) => {
  const harness = createHarness(t);
  fs.writeFileSync(harness.storagePath, '{broken', 'utf8');

  const result = harness.run(['list']);

  assertFailure(result, 2, 'storage error');
  assert.strictEqual(harness.readStorage(), '{broken');
});

test('AC-030: a storage path that cannot be read returns a storage error', (t) => {
  const harness = createHarness(t);
  fs.mkdirSync(harness.storagePath);
  const before = fs.readdirSync(harness.storagePath);

  const result = harness.run(['list']);

  assertFailure(result, 2, 'storage error');
  assert.deepStrictEqual(fs.readdirSync(harness.storagePath), before);
});

test('AC-031: priority sorting orders high before medium before low', (t) => {
  const harness = createHarness(t);
  harness.seed([
    { ...T1, priority: 'low' },
    { ...T2, priority: 'high' },
    { ...T3, priority: 'medium' },
  ]);

  const result = harness.run(['list', '--sort', 'priority']);

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(
    JSON.parse(result.stdout).map((task) => task.priority),
    ['high', 'medium', 'low'],
  );
  assert.strictEqual(result.stderr, '');
});

test('AC-032: equal-priority and equal-time tasks sort by ID', (t) => {
  const harness = createHarness(t);
  harness.seed([
    { ...T1, id: 'task-002' },
    { ...T1, id: 'task-001' },
  ]);

  const result = harness.run(['list', '--sort', 'priority']);

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(
    JSON.parse(result.stdout).map((task) => task.id),
    ['task-001', 'task-002'],
  );
  assert.strictEqual(result.stderr, '');
});

test('AC-033: delete removes a task and returns its ID', (t) => {
  const harness = createHarness(t);
  harness.seed([T1]);

  const result = harness.run(['delete', 'task-001']);

  assertSuccess(result, { deleted: true, id: 'task-001' });
  assert.deepStrictEqual(harness.readTasks(), []);
});

test('AC-034: tag filters require all requested tags', (t) => {
  const harness = createHarness(t);
  harness.seed([T3]);

  assertSuccess(
    harness.run(['list', '--tag', 'work', '--tag', 'home']),
    [T3],
  );
  assertSuccess(
    harness.run(['list', '--tag', 'work', '--tag', 'missing']),
    [],
  );
});

test('AC-035: update rejects a title longer than 100 characters', (t) => {
  const harness = createHarness(t);
  harness.seed([T1]);
  const before = harness.readStorage();

  const result = harness.run([
    'update',
    'task-001',
    '--title',
    'A'.repeat(101),
  ]);

  assertFailure(result, 1, 'title must be between 1 and 100 characters');
  assert.strictEqual(harness.readStorage(), before);
});

test('AC-036: update rejects an unsupported priority', (t) => {
  const harness = createHarness(t);
  harness.seed([T1]);
  const before = harness.readStorage();

  const result = harness.run([
    'update',
    'task-001',
    '--priority',
    'urgent',
  ]);

  assertFailure(result, 1, 'invalid priority: urgent');
  assert.strictEqual(harness.readStorage(), before);
});

test('AC-037: status rejects an unsupported target value', (t) => {
  const harness = createHarness(t);
  harness.seed([T1]);
  const before = harness.readStorage();

  const result = harness.run(['status', 'task-001', 'blocked']);

  assertFailure(result, 1, 'invalid status: blocked');
  assert.strictEqual(harness.readStorage(), before);
});

test('AC-038: an empty tag is rejected without changing storage', (t) => {
  const harness = createHarness(t);
  harness.seed([]);
  const before = harness.readStorage();

  const result = harness.run(['add', '--title', 'Task', '--tag', '']);

  assertFailure(result, 1, 'tag must not be empty');
  assert.strictEqual(harness.readStorage(), before);
});

test('AC-039: tag filters are trimmed and lowercased', (t) => {
  const harness = createHarness(t);
  harness.seed([T1, T4]);

  const result = harness.run(['list', '--tag', ' Work ']);

  assertSuccess(result, [T1]);
});

test('AC-040: a generated duplicate ID is rejected without a write', (t) => {
  const harness = createHarness(t, { idPrefix: 'task-00' });
  harness.seed([T1]);
  const before = harness.readStorage();

  const result = harness.run(['add', '--title', 'Another']);

  assertFailure(result, 1, 'duplicate task id: task-001');
  assert.strictEqual(harness.readStorage(), before);
});

test('AC-041: an empty generated ID is rejected without a write', (t) => {
  const harness = createHarness(t, { idFactory: () => '' });
  harness.seed([]);
  const before = harness.readStorage();

  const result = harness.run(['add', '--title', 'Another']);

  assertFailure(result, 1, 'invalid task id');
  assert.strictEqual(harness.readStorage(), before);
});

test('AC-042: an update without fields is rejected without a write', (t) => {
  const harness = createHarness(t);
  harness.seed([T1]);
  const before = harness.readStorage();

  const result = harness.run(['update', 'task-001']);

  assertFailure(result, 1, 'no update fields provided');
  assert.strictEqual(harness.readStorage(), before);
});

test('AC-043: title trimming preserves internal whitespace', (t) => {
  const harness = createHarness(t, {
    idPrefix: 'task-00',
    initialId: 1,
    date: '2026-11-01T10:01:00.000Z',
  });
  const expected = {
    id: 'task-002',
    title: 'Read   book',
    priority: 'medium',
    tags: [],
    status: 'todo',
    createdAt: '2026-11-01T10:01:00.000Z',
  };

  const result = harness.run(['add', '--title', '  Read   book  ']);

  assertSuccess(result, expected);
});

test('AC-044: list filters before priority sorting', (t) => {
  const harness = createHarness(t);
  harness.seed([T1, T2, T3, T5]);

  const result = harness.run([
    'list',
    '--tag',
    'work',
    '--tag',
    'home',
    '--sort',
    'priority',
  ]);

  assertSuccess(result, [T5, T3]);
});

test('AC-045: createdAt comes from the injected clock', (t) => {
  const harness = createHarness(t, {
    idPrefix: 'task-00',
    initialId: 1,
    date: '2026-11-01T10:01:00.000Z',
  });

  const result = harness.run(['add', '--title', 'A']);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(JSON.parse(result.stdout).createdAt, '2026-11-01T10:01:00.000Z');
  assert.strictEqual(result.stderr, '');
});

test('AC-046: update can clear description and tags', (t) => {
  const harness = createHarness(t);
  harness.seed([{ ...T1, description: 'note' }]);
  const expected = { ...T1, tags: [] };

  const result = harness.run([
    'update',
    'task-001',
    '--description',
    '',
    '--clear-tags',
  ]);

  assertSuccess(result, expected);
});

test('AC-047: clearing tags cannot be combined with tag updates', (t) => {
  const harness = createHarness(t);
  harness.seed([T1]);
  const before = harness.readStorage();

  const result = harness.run([
    'update',
    'task-001',
    '--tag',
    'work',
    '--clear-tags',
  ]);

  assertFailure(result, 1, '--clear-tags cannot be combined with --tag');
  assert.strictEqual(harness.readStorage(), before);
});

test('AC-048: every contract usage and validation error has its exact response', (t) => {
  const cases = [
    { argv: [], message: 'missing command' },
    { argv: ['unknown'], message: 'unknown command: unknown' },
    { argv: ['add', '--unknown'], message: 'unknown option: --unknown' },
    {
      argv: ['get', 'task-001', '--title', 'Other'],
      message: 'option not supported for command: --title',
    },
    {
      argv: ['add', '--title'],
      message: 'missing value for option: --title',
    },
    {
      argv: ['add', '--title', 'A', '--title', 'B'],
      message: 'duplicate option: --title',
    },
    {
      argv: ['list', 'extra'],
      message: 'unexpected argument: extra',
    },
    {
      argv: ['add'],
      message: 'missing required option: --title',
    },
    { argv: ['get'], message: 'missing task id' },
    { argv: ['update'], message: 'missing task id' },
    { argv: ['status'], message: 'missing task id' },
    { argv: ['reopen'], message: 'missing task id' },
    { argv: ['delete'], message: 'missing task id' },
    {
      argv: ['get', ''],
      message: 'invalid task id',
    },
    {
      argv: ['status', 'task-001'],
      message: 'missing status',
    },
    {
      argv: ['list', '--sort', 'date'],
      message: 'invalid sort: date',
    },
    {
      argv: ['add', '--title', 'A', '--priority', 'urgent'],
      message: 'invalid priority: urgent',
    },
    {
      argv: ['add', '--title', 'A', '--tag', ' '],
      message: 'tag must not be empty',
    },
    {
      argv: ['status', 'task-001', 'blocked'],
      message: 'invalid status: blocked',
      tasks: [T1],
    },
    {
      argv: ['status', 'task-001', 'todo'],
      message: 'invalid status transition: todo -> todo',
      tasks: [T1],
    },
    {
      argv: ['reopen', 'task-001'],
      message: 'invalid status transition: todo -> todo',
      tasks: [T1],
    },
    {
      argv: ['update', 'task-001'],
      message: 'no update fields provided',
      tasks: [T1],
    },
    {
      argv: [
        'update',
        'task-001',
        '--tag',
        'work',
        '--clear-tags',
      ],
      message: '--clear-tags cannot be combined with --tag',
      tasks: [T1],
    },
    {
      argv: ['add', '--title', 'A', '--priority'],
      message: 'missing value for option: --priority',
    },
    {
      argv: ['add', '--title', 'A', '--title', 'B'],
      message: 'duplicate option: --title',
    },
    {
      argv: ['status', 'task-001', 'todo', 'extra'],
      message: 'unexpected argument: extra',
      tasks: [T1],
    },
    {
      argv: ['update', 'task-001', '--title', ''],
      message: 'title must be between 1 and 100 characters',
      tasks: [T1],
    },
    {
      argv: ['add', '--title', 'A'],
      message: 'invalid task id',
      idFactory: () => '',
    },
    {
      argv: ['add', '--title', 'A'],
      message: 'invalid task id',
      idFactory: () => 1,
    },
    {
      argv: ['add', '--title', 'A'],
      message: 'duplicate task id: task-001',
      idPrefix: 'task-00',
      tasks: [T1],
    },
  ];

  for (const errorCase of cases) {
    const harness = createHarness(t, {
      idPrefix: errorCase.idPrefix,
      idFactory: errorCase.idFactory,
    });
    if (errorCase.tasks) {
      harness.seed(errorCase.tasks);
    }
    const before = fs.existsSync(harness.storagePath)
      ? harness.readStorage()
      : undefined;

    assertFailure(harness.run(errorCase.argv), 1, errorCase.message);
    if (before !== undefined) {
      assert.strictEqual(harness.readStorage(), before);
    }
  }
});


test('AC-049: invalid dependency objects return the exact dependency error', (t) => {
  const harness = createHarness(t);
  const missingPath = { ...harness.deps };
  delete missingPath.storagePath;
  const missingMember = { ...harness.deps };
  delete missingMember.idFactory;
  const nonFunction = {
    ...harness.deps,
    clock: 'not a function',
  };
  const invalidDate = {
    ...harness.deps,
    clock: () => new Date('invalid'),
  };

  for (const deps of [missingPath, missingMember, nonFunction, invalidDate]) {
    assertFailure(harness.run(['list'], deps), 1, 'invalid dependencies');
  }
});

test('AC-050: a non-array JSON root is rejected without modification', (t) => {
  const harness = createHarness(t);
  fs.writeFileSync(harness.storagePath, '{"tasks":[]}', 'utf8');
  const before = harness.readStorage();

  const result = harness.run(['list']);

  assertFailure(result, 2, 'storage error');
  assert.strictEqual(harness.readStorage(), before);
});

test('AC-051: a mutation against read-only storage reports a write error', (t) => {
  const harness = createHarness(t);
  harness.seed([T1]);
  fs.chmodSync(harness.storagePath, 0o444);

  const result = harness.run(['delete', 'task-001']);

  assertFailure(result, 2, 'storage error');
});

test('AC-052: add preserves an explicitly empty description', (t) => {
  const harness = createHarness(t, {
    idPrefix: 'task-00',
    initialId: 2,
    date: '2026-11-01T10:02:00.000Z',
  });
  const expected = {
    id: 'task-003',
    title: 'Buy',
    description: '',
    priority: 'medium',
    tags: [],
    status: 'todo',
    createdAt: '2026-11-01T10:02:00.000Z',
  };

  const result = harness.run([
    'add',
    '--title',
    'Buy',
    '--description',
    '',
  ]);

  assertSuccess(result, expected);
});
