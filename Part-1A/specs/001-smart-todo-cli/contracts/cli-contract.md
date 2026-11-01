# Smart Todo CLI Contract

This file is normative for the public command interface and
`src/cli.js`'s exported API. When an implementation detail is not stated here,
it MUST NOT change the specified argument grammar, JSON output, error text, or
exit code.

## Exported API

`src/cli.js` MUST export:

```js
module.exports = { main };
```

`main(argv, deps)` MUST:

- Accept `argv` as the arguments after the Node executable and script name.
  Example: `['add', '--title', 'Buy milk', '--priority', 'high', '--tag', 'home']`.
- Accept exactly this dependency shape:
  `{ storagePath: string, clock: () => Date, idFactory: () => string, stdout: { write(text) }, stderr: { write(text) } }`.
- The deps object MUST contain exactly the five listed own properties.
  `storagePath` MUST be a nonempty string. `clock`, `idFactory`, and both
  `write` members MUST be functions; `clock()` MUST return a valid Date and
  `idFactory()` MUST return a string.
- Perform command and file operations synchronously.
- Return an integer exit code synchronously; it MUST NOT return a Promise.
- Use only the supplied dependencies. Importing the module MUST NOT read files,
  environment variables, time, randomness, or process output.

## Direct Execution

Running `node src/cli.js ...` MUST call one composition-root function. That
function MUST build all real dependencies and call `main`:

- `storagePath`: `process.env.TODO_FILE || './todo.json'`. A relative path is
  relative to the process working directory.
- `clock`: `() => new Date()`.
- `idFactory`: `crypto.randomUUID` from Node's built-in `node:crypto`.
- `stdout`: `process.stdout`.
- `stderr`: `process.stderr`.

The direct-execution guard sets `process.exitCode` to the integer returned by
`main`. Only this composition-root function may construct real dependencies;
all command logic receives them through `deps`.

## Argument Grammar

Each argument value is one string token. Shell quoting is performed by the
caller. Options use separate flag and value tokens, not `--flag=value`.
Options may appear in any order after the command (and after the task ID for
`update`). `--tag` may repeat. Other value options and boolean flags may appear
at most once. A missing value is an error; an option token where a value is
expected is treated as a missing value. Unknown options and unexpected
positional arguments are errors.

| Command | Exact syntax | Allowed options |
|---------|--------------|-----------------|
| Add | `add --title <title> [--description <text>] [--priority <low\|medium\|high>] [--tag <tag> ...]` | `--title` required; `--description`, `--priority`, repeatable `--tag` |
| List | `list [--tag <tag> ...] [--sort priority]` | Repeatable `--tag`; `--sort` may occur once and accepts only `priority` |
| Get | `get <id>` | None |
| Update | `update <id> [--title <title>] [--description <text>] [--priority <low\|medium\|high>] [--tag <tag> ...] [--clear-tags]` | At least one update field; `--tag` repeatable; `--clear-tags` conflicts with `--tag` |
| Status | `status <id> <todo\|in_progress\|done>` | None |
| Reopen | `reopen <id>` | None |
| Delete | `delete <id>` | None |

Additional syntax rules:

- `update` with no fields fails. `--clear-tags` counts as a field.
- `--description ""` clears the optional description. A nonempty description is
  stored as supplied. On add, an explicitly empty description is stored as
  `""`; on update, it removes the optional property.
- Update tags replace the existing array. `--clear-tags` sets it to `[]`.
- Tags are trimmed, lowercased, and deduplicated preserving first occurrence.
  A tag empty after trimming is invalid.
- List filter tags are trimmed and lowercased, matched as exact whole-tag
  values, and combined with AND.
- Titles are trimmed at both ends; internal whitespace is preserved. Length is
  measured as Unicode code points after trimming and MUST be 1 through 100.
- IDs are arbitrary nonempty strings. A generated ID collision is rejected.
- An empty ID argument is invalid (exit code 1); a nonempty ID absent from the
  loaded collection is a task-not-found failure (exit code 3).
- `createdAt` is the ISO-8601 string from
  `deps.clock().toISOString()`.
- Repeated non-repeatable options fail rather than using first/last value.

## Success Output

Every successful command writes exactly one compact JSON document followed by
one `\n` to `deps.stdout`, writes nothing to `deps.stderr`, and returns `0`.
No extra status text is printed.

Task property order is `id`, `title`, optional `description`, `priority`,
`tags`, `status`, `createdAt`. If description is absent, its property is
omitted. JSON uses ordinary `JSON.stringify` escaping and compact formatting.

| Command | JSON document |
|---------|---------------|
| Add | Created task object |
| List | Array of matching task objects; `[]` for no matches |
| Get | Requested task object |
| Update | Updated task object |
| Status | Updated task object |
| Reopen | Updated task object |
| Delete | `{"deleted":true,"id":"<id>"}` using the deleted task's ID |

List order is persisted creation order unless `--sort priority` is supplied.
Priority sort orders `high`, `medium`, `low`; ties compare `createdAt`
ascending, then `id` ascending by Unicode code-point lexicographic order. If
tags and sort are both supplied, filter first, then sort.

## Errors and Exit Codes

For every command failure, `main` writes no stdout, writes exactly
`error: <message>\n` to `deps.stderr`, and returns the listed integer.

### Exit code 1: usage, validation, and transition errors

| Condition | Exact `<message>` |
|-----------|-------------------|
| Dependency object/member has the wrong shape, or `clock()` does not return a valid Date | `invalid dependencies` |
| No command token | `missing command` |
| Unknown command `<command>` | `unknown command: <command>` |
| Unknown option `<option>` | `unknown option: <option>` |
| Option not allowed on the selected command `<option>` | `option not supported for command: <option>` |
| Missing option value `<option>` | `missing value for option: <option>` |
| Repeated non-repeatable option `<option>` | `duplicate option: <option>` |
| Unexpected positional token `<value>` | `unexpected argument: <value>` |
| Add without `--title` | `missing required option: --title` |
| Get, update, status, reopen, or delete without ID | `missing task id` |
| An explicitly supplied empty ID, or empty/non-string ID from `idFactory` | `invalid task id` |
| Status without target status | `missing status` |
| List `--sort` value other than `priority` | `invalid sort: <value>` |
| Empty/whitespace/overlong title | `title must be between 1 and 100 characters` |
| Invalid priority `<value>` | `invalid priority: <value>` |
| Empty normalized tag | `tag must not be empty` |
| Generated ID already exists `<id>` | `duplicate task id: <id>` |
| Status value outside `todo`, `in_progress`, `done` | `invalid status: <value>` |
| Status transition from `<from>` to `<to>` is disallowed | `invalid status transition: <from> -> <to>` |
| Reopen from `todo` or `in_progress` | `invalid status transition: <from> -> todo` |
| Update has no fields | `no update fields provided` |
| `--clear-tags` used with `--tag` | `--clear-tags cannot be combined with --tag` |

Status transitions accepted by `status` are exactly `todo -> in_progress`,
`in_progress -> done`, and `in_progress -> todo`. `reopen` accepts exactly
`done -> todo`. The same-state transition is invalid.

### Exit code 2: storage errors

| Condition | Exact `<message>` |
|-----------|-------------------|
| Storage file cannot be read, except it is missing | `storage error` |
| Storage is invalid JSON | `storage error` |
| Root JSON value is not a task array or a task record is invalid | `storage error` |
| Storage cannot be written | `storage error` |

A missing file is an empty collection, not an error. When read or parse fails,
the source file MUST NOT be overwritten. No success output is emitted unless
the whole operation succeeds.

### Exit code 3: task not found

For `get`, `update`, `status`, `reopen`, or `delete` when the ID is absent, the
exact message is `task not found: <id>`.

### Error precedence

1. Validate dependency shape and parse the full command syntax.
2. Read and parse storage.
3. For an operation with a task ID, look up the ID.
4. Validate task fields/transitions, perform the operation, then persist if it
   mutates state.

Accordingly, invalid dependency objects and syntax errors are reported before
storage errors; storage errors are reported before task lookup; and a missing
task is reported before task-specific update or transition validation.

## Storage Contract

The file is a UTF-8 JSON array of task objects in creation order. A successful
mutation serializes the whole array as compact JSON followed by one newline.
Updates preserve array position; deletes remove the task. Existing entries
must have valid field types and values per the task model in
[`../data-model.md`](../data-model.md). A missing file reads as `[]`.

## Test Contract

Tests MUST import and call only `main(argv, deps)`, use temporary JSON files,
fixed Date-returning clocks, deterministic ID factories, and capture sinks.
Tests MUST be written by the human from `spec.md` and this contract before
implementation. They MUST assert exact integer results, exact stdout/stderr
including line endings, and exact persisted JSON. Tests use `node:test` and
`node:assert/strict`; each title begins with its AC-ID. Required failures
include every error-table condition, all invalid status transitions, ID
collisions, absent tasks, invalid JSON/shape, unreadable storage, and write
failure.
