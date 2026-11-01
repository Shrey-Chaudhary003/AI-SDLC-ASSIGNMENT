'use strict';

const { CliError } = require('./errors');
const { validateTaskId } = require('./validation');

const COMMANDS = new Set([
  'add',
  'list',
  'get',
  'update',
  'status',
  'reopen',
  'delete',
]);

const OPTION_TYPES = new Map([
  ['--title', 'value'],
  ['--description', 'value'],
  ['--priority', 'value'],
  ['--tag', 'repeat'],
  ['--sort', 'value'],
  ['--clear-tags', 'boolean'],
]);

const ALLOWED_OPTIONS = new Map([
  ['add', new Set(['--title', '--description', '--priority', '--tag'])],
  ['list', new Set(['--tag', '--sort'])],
  ['update', new Set([
    '--title',
    '--description',
    '--priority',
    '--tag',
    '--clear-tags',
  ])],
  ['get', new Set()],
  ['status', new Set()],
  ['reopen', new Set()],
  ['delete', new Set()],
]);

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new CliError('missing command');
  }
  const name = argv[0];
  if (typeof name !== 'string' || !COMMANDS.has(name)) {
    throw new CliError(`unknown command: ${name}`);
  }
  const args = argv.slice(1);
  const id = name === 'update' ? extractUpdateId(args) : undefined;
  const tokens = name === 'update' ? args.slice(1) : args;
  const parsed = parseOptions(tokens, name);
  return validateArguments(name, id, parsed.options, parsed.positionals);
}

function extractUpdateId(args) {
  const id = args[0];
  if (id === undefined || id.startsWith('--')) {
    throw new CliError('missing task id');
  }
  return validateTaskId(id);
}

function parseOptions(tokens, command) {
  const options = new Map();
  const positionals = [];
  const iterator = tokens[Symbol.iterator]();
  let entry = iterator.next();
  while (!entry.done) {
    const token = entry.value;
    if (!token.startsWith('--')) {
      positionals.push(token);
      entry = iterator.next();
      continue;
    }
    readOption(iterator, command, options, token);
    entry = iterator.next();
  }
  return { options, positionals };
}

function readOption(iterator, command, options, token) {
  const type = OPTION_TYPES.get(token);
  if (!type) {
    throw new CliError(`unknown option: ${token}`);
  }
  if (!ALLOWED_OPTIONS.get(command).has(token)) {
    throw new CliError(`option not supported for command: ${token}`);
  }
  if (type !== 'repeat' && options.has(token)) {
    throw new CliError(`duplicate option: ${token}`);
  }
  if (type === 'boolean') {
    options.set(token, true);
    return;
  }
  const entry = iterator.next();
  if (entry.done || entry.value.startsWith('--')) {
    throw new CliError(`missing value for option: ${token}`);
  }
  storeOption(options, token, entry.value, type);
}

function storeOption(options, token, value, type) {
  if (type === 'repeat') {
    const values = options.get(token) || [];
    values.push(value);
    options.set(token, values);
    return;
  }
  options.set(token, value);
}

function validateArguments(name, id, options, positionals) {
  if (name === 'add' && !options.has('--title')) {
    throw new CliError('missing required option: --title');
  }
  if (name === 'list') {
    validateListOptions(options);
  }
  if (name === 'update') {
    validateUpdateOptions(options);
    return { name, id, options };
  }
  return validatePositionals(name, options, positionals);
}

function validateListOptions(options) {
  if (options.has('--sort') && options.get('--sort') !== 'priority') {
    throw new CliError(`invalid sort: ${options.get('--sort')}`);
  }
}

function validateUpdateOptions(options) {
  if (options.has('--clear-tags') && options.has('--tag')) {
    throw new CliError('--clear-tags cannot be combined with --tag');
  }
  if (options.size === 0) {
    throw new CliError('no update fields provided');
  }
}

function validatePositionals(name, options, positionals) {
  const expected = name === 'status' ? 2 : name === 'add' || name === 'list' ? 0 : 1;
  if (positionals.length < expected) {
    return missingArgument(name, positionals.length, options);
  }
  if (positionals.length > expected) {
    throw new CliError(`unexpected argument: ${positionals.at(expected)}`);
  }
  if (name === 'add' || name === 'list') {
    return { name, options };
  }
  const id = validateTaskId(positionals.at(0));
  return name === 'status'
    ? { name, id, status: positionals.at(1), options }
    : { name, id, options };
}

function missingArgument(name, count, options) {
  if (name === 'status' && count === 1) {
    throw new CliError('missing status');
  }
  if (name === 'add' && !options.has('--title')) {
    throw new CliError('missing required option: --title');
  }
  throw new CliError('missing task id');
}

module.exports = { parseArguments };
