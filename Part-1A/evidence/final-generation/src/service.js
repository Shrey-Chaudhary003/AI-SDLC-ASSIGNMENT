'use strict';

const { CliError } = require('./errors');
const {
  normalizeTags,
  validatePriority,
  validateStatus,
  validateTaskId,
  validateTitle,
} = require('./validation');

function execute(command, tasks, deps, now) {
  switch (command.name) {
    case 'add':
      return addTask(command.options, tasks, deps, now);
    case 'list':
      return { result: listTasks(command.options, tasks), changed: false };
    case 'get':
      return { result: findTask(tasks, command.id), changed: false };
    case 'update':
      return updateTask(command, tasks);
    case 'status':
      return changeStatus(command, tasks);
    case 'reopen':
      return reopenTask(command, tasks);
    case 'delete':
      return deleteTask(command, tasks);
    default:
      throw new CliError(`unknown command: ${command.name}`);
  }
}

function addTask(options, tasks, deps, now) {
  const title = validateTitle(options.get('--title'));
  const priority = options.has('--priority')
    ? validatePriority(options.get('--priority'))
    : 'medium';
  const tags = normalizeTags(options.get('--tag') || []);
  const id = validateTaskId(deps.idFactory());
  if (tasks.some((task) => task.id === id)) {
    throw new CliError(`duplicate task id: ${id}`);
  }
  const task = buildNewTask(id, title, priority, tags, options, now);
  tasks.push(task);
  return { result: task, changed: true };
}

function buildNewTask(id, title, priority, tags, options, now) {
  const task = { id, title };
  if (options.has('--description')) {
    task.description = options.get('--description');
  }
  task.priority = priority;
  task.tags = tags;
  task.status = 'todo';
  task.createdAt = now.toISOString();
  return task;
}

function updateTask(command, tasks) {
  const current = findTask(tasks, command.id);
  const options = command.options;
  const title = options.has('--title')
    ? validateTitle(options.get('--title'))
    : current.title;
  const priority = options.has('--priority')
    ? validatePriority(options.get('--priority'))
    : current.priority;
  const tags = updatedTags(options, current.tags);
  const updated = buildUpdatedTask(current, title, priority, tags, options);
  replaceTask(tasks, current, updated);
  return { result: updated, changed: true };
}

function updatedTags(options, currentTags) {
  if (options.has('--clear-tags')) {
    return [];
  }
  return options.has('--tag')
    ? normalizeTags(options.get('--tag'))
    : currentTags.slice();
}

function buildUpdatedTask(current, title, priority, tags, options) {
  const task = { id: current.id, title };
  if (options.has('--description')) {
    const description = options.get('--description');
    if (description !== '') {
      task.description = description;
    }
  } else if (Object.hasOwn(current, 'description')) {
    task.description = current.description;
  }
  task.priority = priority;
  task.tags = tags;
  task.status = current.status;
  task.createdAt = current.createdAt;
  return task;
}

function changeStatus(command, tasks) {
  const task = findTask(tasks, command.id);
  const target = validateStatus(command.status);
  if (!isAllowedTransition(task.status, target)) {
    throw transitionError(task.status, target);
  }
  return replaceStatus(tasks, task, target);
}

function reopenTask(command, tasks) {
  const task = findTask(tasks, command.id);
  if (task.status !== 'done') {
    throw transitionError(task.status, 'todo');
  }
  return replaceStatus(tasks, task, 'todo');
}

function isAllowedTransition(from, to) {
  return (
    (from === 'todo' && to === 'in_progress') ||
    (from === 'in_progress' && (to === 'done' || to === 'todo'))
  );
}

function transitionError(from, to) {
  return new CliError(`invalid status transition: ${from} -> ${to}`);
}

function replaceTask(tasks, current, updated) {
  tasks.splice(tasks.indexOf(current), 1, updated);
}

function replaceStatus(tasks, task, status) {
  const updated = { ...task, status };
  replaceTask(tasks, task, updated);
  return { result: updated, changed: true };
}

function deleteTask(command, tasks) {
  const task = findTask(tasks, command.id);
  tasks.splice(tasks.indexOf(task), 1);
  return { result: { deleted: true, id: task.id }, changed: true };
}

function findTask(tasks, id) {
  validateTaskId(id);
  const task = tasks.find((entry) => entry.id === id);
  if (!task) {
    throw new CliError(`task not found: ${id}`, 3);
  }
  return task;
}

function listTasks(options, tasks) {
  const filters = normalizeTags(options.get('--tag') || []);
  const matches = tasks.filter((task) =>
    filters.every((tag) => task.tags.includes(tag)),
  );
  if (options.get('--sort') === 'priority') {
    return sortByPriority(matches);
  }
  return matches;
}

function sortByPriority(tasks) {
  const rank = new Map([
    ['high', 0],
    ['medium', 1],
    ['low', 2],
  ]);
  return tasks.slice().sort((left, right) => {
    const priority = rank.get(left.priority) - rank.get(right.priority);
    if (priority !== 0) {
      return priority;
    }
    if (left.createdAt !== right.createdAt) {
      return left.createdAt < right.createdAt ? -1 : 1;
    }
    return compareCodePoints(left.id, right.id);
  });
}

function compareCodePoints(left, right) {
  const leftPoints = left[Symbol.iterator]();
  const rightPoints = right[Symbol.iterator]();
  while (true) {
    const leftPoint = leftPoints.next();
    const rightPoint = rightPoints.next();
    if (leftPoint.done || rightPoint.done) {
      return compareLengths(leftPoint.done, rightPoint.done);
    }
    const difference =
      leftPoint.value.codePointAt(0) - rightPoint.value.codePointAt(0);
    if (difference !== 0) {
      return difference;
    }
  }
}

function compareLengths(leftDone, rightDone) {
  if (leftDone && rightDone) {
    return 0;
  }
  return leftDone ? -1 : 1;
}

module.exports = { execute };
