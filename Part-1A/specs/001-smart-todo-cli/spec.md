# Feature Specification: Smart Todo CLI

**Feature Branch**: `001-smart-todo-cli`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Build Smart Todo CLI, a Node.js command-line task manager with JSON-file persistence and deterministic dependencies."

## Clarifications

### Session 2026-11-01

- Q: Should tag storage and list filters trim tags, match case-insensitively after lowercasing, and require every repeated `--tag` to match? → A: Trim and lowercase tags and filters; exact whole-tag matching; repeated filters use AND.
- Q: What format and uniqueness rule should apply to IDs returned by the injected ID generator? → A: Any nonempty string; unique among stored tasks; reject collisions with exit code 1 and leave storage unchanged.
- Q: What should `update` do when no update fields are supplied? → A: Reject it with exit code 1, no stdout, and `error: no update fields provided\n`; do not change storage.
- Q: After trimming a title, should internal whitespace be preserved exactly or collapsed? → A: Trim leading and trailing whitespace only; preserve internal whitespace exactly.
- Q: What read-command contract should apply when a list request combines tag filters and priority sorting? → A: `list` returns a compact JSON array, `get` returns one compact task object, and the CLI applies all tag filters first, then sorts the matching tasks.
- Plan decision (from the requested public contract): Direct execution uses
  `node src/cli.js`; command syntax is normative in
  `contracts/cli-contract.md`; success output is one compact JSON document and
  newline, while errors use `error: <message>\n`.
- Plan decision (from the requested dependency shape): `clock: () => Date`;
  `createdAt` is the returned Date's `toISOString()` value, and only the
  real-dependency composition root constructs `new Date()`.
- Plan decision (explicit update syntax): `--description ""` removes
  description; `--clear-tags` replaces tags with an empty array and cannot be
  combined with `--tag`.

## User Scenarios & Testing

### User Story 1 - Create and manage tasks (Priority: P1)

As a person organizing work, I want to add, retrieve, update, complete, reopen,
and delete tasks so that I can keep a durable task list.

**Why this priority**: Task lifecycle operations are the primary value of the
CLI.

**Independent Test**: Exercise add, get, update, status, reopen, and delete
against a temporary JSON file with injected ID and clock dependencies.

**Acceptance Scenarios**:

- Add a task with its required title and defaults: AC-001.
- Reject invalid titles and priorities: AC-002 through AC-005.
- Retrieve, update, and delete a task; report missing IDs exactly: AC-006
  through AC-008.
- Apply permitted status changes and reopen a completed task: AC-009 and
  AC-010.

### User Story 2 - Find and order tasks (Priority: P2)

As a person with multiple tasks, I want to list tasks in creation order or
filter and sort them so that I can find the tasks relevant to me.

**Why this priority**: Listing and predictable ordering make the task collection
usable as it grows.

**Independent Test**: Seed a task file with known tasks and compare list output
exactly for empty, filtered, and sorted results.

**Acceptance Scenarios**:

- Return an empty array for an empty task file: AC-011.
- Apply repeated tag filters using AND semantics and return no matches as an
  empty array: AC-012 and AC-013.
- Preserve creation order by default and apply priority ordering with exact tie
  breakers: AC-014 and AC-015.

### User Story 3 - Preserve task data safely (Priority: P3)

As a person relying on saved tasks, I want missing storage to behave as empty
and damaged or unreadable storage to fail without data loss.

**Why this priority**: Predictable persistence prevents silent loss or
overwriting of task data.

**Independent Test**: Use temporary storage paths for absent, valid, malformed,
and unreadable storage states, then inspect exact exit codes and file contents.

**Acceptance Scenarios**:

- Treat a missing file as an empty list and create valid storage on first
  successful write: AC-016.
- Return a storage error and preserve malformed or unreadable storage: AC-017
  and AC-018.

## Edge Cases

- Empty and whitespace-only titles are invalid; titles of 100 characters after
  trimming are valid and titles of 101 characters are invalid.
- Invalid priority values are rejected.
- Duplicate tags are deduplicated after normalization; uppercase tags are
  lowercased.
- Unknown IDs return exit code 3 for single-task operations.
- An empty task collection and a filter with no matches both produce an empty
  JSON array.
- Repeated `--tag` filters are combined with AND.
- Priority sort ties use creation time ascending, then ID ascending.
- A missing storage file means no tasks; malformed or unreadable storage must
  never be overwritten.
- Every invalid status transition, including attempting to set the current
  status, fails with the specified transition message.

## Requirements

### Functional Requirements

- **FR-001**: The CLI MUST support add, list, get, update, status change,
  reopen, and delete operations on tasks.
- **FR-002**: Each task MUST contain a string `id` produced by an injected ID
  generator, a `title`, a `priority`, a `tags` array, a `status`, and a
  `createdAt` ISO-8601 string produced by calling `toISOString()` on the Date
  returned by the injected clock. `description` MUST be an optional string.
- **FR-003**: The CLI MUST trim titles supplied to add or update and accept
  only titles whose trimmed length is between 1 and 100 Unicode code points
  inclusive. It MUST preserve internal whitespace exactly.
- **FR-004**: A newly added task MUST default to priority `medium`, tags `[]`,
  and status `todo`; omitted description MUST be absent from the returned and
  persisted task object. An explicitly supplied empty description on add MUST
  be stored as an empty string.
- **FR-005**: Priority supplied to add or update MUST be one of `low`,
  `medium`, or `high`; every other value MUST fail validation with exit code 1
  and message `invalid priority: <value>`.
- **FR-006**: Tags supplied to add or update MUST be nonempty after trimming,
  normalized to lowercase, and unique while preserving first occurrence
  order. Empty tags MUST fail validation with exit code 1 and message
  `tag must not be empty`. List tag filters MUST be trimmed and lowercased
  before exact whole-tag matching.
- **FR-007**: Updating a task MUST support title, description, priority, and
  tags. Omitted update fields MUST remain unchanged; supplied tags replace the
  prior tag array. `--description ""` MUST remove the optional description;
  `--clear-tags` MUST replace tags with `[]` and MUST NOT be combined with
  `--tag`.
- **FR-008**: The status operation MUST allow only `todo -> in_progress`,
  `in_progress -> done`, and `in_progress -> todo`. Every other attempted
  transition, including setting the current status, MUST fail with exit code 1
  and message `invalid status transition: <from> -> <to>`.
- **FR-009**: The reopen operation MUST allow only `done -> todo`. Reopen
  attempts from `todo` or `in_progress` MUST fail with exit code 1 and message
  `invalid status transition: <from> -> todo`.
- **FR-010**: List without sort MUST return tasks in creation order. Repeated
  normalized tag filters MUST combine with AND; a tag filter with no matches
  MUST return an empty array.
- **FR-011**: `list --sort priority` MUST order tasks by priority `high`,
  `medium`, `low`, then `createdAt` ascending, then `id` ascending by Unicode
  code-point lexicographic order.
- **FR-012**: The CLI MUST persist tasks in one JSON file. A missing file MUST
  be treated as an empty task collection.
- **FR-013**: An unreadable file, invalid JSON, or invalid stored task shape
  MUST produce exit code 2 and a storage error. The CLI MUST NOT overwrite the
  source file after a read or parse failure.
- **FR-014**: Exit codes MUST be exactly 0 for success, 1 for validation or
  transition errors, 2 for storage errors, and 3 when a requested task ID is
  not found.
- **FR-015**: Successful command results MUST be printed as one compact JSON
  document followed by one newline on stdout. Errors MUST be printed to stderr
  as `error: <message>\n`. Failed commands MUST emit no success result on
  stdout.
- **FR-016**: Task persistence, clock, and ID generation MUST be deterministic
  under injected dependencies; repeated identical inputs and dependency state
  MUST produce identical outputs and storage contents.
- **FR-017**: Authentication, synchronization, recurring tasks, and all user
  interfaces other than the command line are out of scope.
- **FR-018**: A status value outside `todo`, `in_progress`, and `done` MUST
  fail validation with exit code 1 and message `invalid status: <value>`.
- **FR-019**: IDs returned by the injected generator MUST be nonempty strings
  unique among stored tasks. An empty or non-string generated ID, or an empty
  supplied ID, MUST fail with exit code 1 and message `invalid task id`; a
  duplicate generated ID MUST fail with exit code 1 and message
  `duplicate task id: <id>`. Neither failure may change storage.
- **FR-020**: An update with no supplied fields MUST fail with exit code 1,
  message `no update fields provided`, emit no stdout, and leave storage
  unchanged.
- **FR-021**: `get` MUST print one compact task object and `list` MUST print a
  compact JSON array, each followed by exactly one newline. When tag filters
  and priority sorting are combined, the CLI MUST first select tasks matching
  every normalized tag, then sort only those matches.
- **FR-022**: The CLI MUST accept only the command forms and flags defined in
  `contracts/cli-contract.md`. Missing commands, unknown commands or options,
  missing flag values, duplicate non-repeatable options, unexpected positional
  arguments, missing required arguments, and unsupported sort values MUST
  fail with exit code 1 and the exact message in that contract.
- **FR-023**: `src/cli.js` MUST export synchronous `main(argv, deps)` returning
  an integer exit code. Direct execution MUST build real dependencies in one
  composition-root function using `TODO_FILE` or `./todo.json`, `() => new
  Date()`, `crypto.randomUUID`, `process.stdout`, and `process.stderr`, then
  call `main`.
- **FR-024**: Invalid dependency objects MUST fail with exit code 1 and
  message `invalid dependencies`. All success and failure output, precedence,
  and exit-code behavior MUST match `contracts/cli-contract.md`.

### Key Entities

- **Task**: A persisted item with ID, trimmed title, optional description,
  priority, normalized tags, status, and creation timestamp.
- **Task collection**: The ordered set of tasks stored in the single JSON file.
- **Injected dependencies**: The ID generator, clock, storage path, stdout, and
  stderr provided to the CLI composition root.

## Acceptance Criteria

For all criteria, tests use a temporary JSON file, deterministic injected
dependencies, and exact exit-code/output assertions. The provisional command
syntax and JSON output shape are defined in
`contracts/cli-contract.md`.

The following exact task fixtures are used where referenced:

- **T1**: `{"id":"task-001","title":"Read book","priority":"medium","tags":["work"],"status":"todo","createdAt":"2026-11-01T10:00:00.000Z"}`
- **T2**: `{"id":"task-002","title":"Buy milk","priority":"low","tags":["home"],"status":"todo","createdAt":"2026-11-01T10:01:00.000Z"}`
- **T3**: `{"id":"task-both","title":"Plan","priority":"medium","tags":["work","home"],"status":"todo","createdAt":"2026-11-01T10:02:00.000Z"}`
- **T4**: `{"id":"task-workshop","title":"Workshop","priority":"medium","tags":["workshop"],"status":"todo","createdAt":"2026-11-01T10:03:00.000Z"}`
- **T5**: `{"id":"task-high-both","title":"Urgent plan","priority":"high","tags":["work","home"],"status":"todo","createdAt":"2026-11-01T10:04:00.000Z"}`

- **AC-001**: **Given** a missing storage file, an ID generator returning
  `task-001`, and a fake clock returning a Date whose ISO string is
  `2026-11-01T10:00:00.000Z`, **When** the user adds title `"  Read book  "`,
  **Then** the exit code is `0`, stdout is exactly
  `{"id":"task-001","title":"Read book","priority":"medium","tags":[],"status":"todo","createdAt":"2026-11-01T10:00:00.000Z"}\n`,
  stderr is empty, and the JSON file contains an array with exactly that task.
- **AC-002**: **Given** an empty task file, **When** the user adds an empty
  title, **Then** the exit code is `1`, stdout is empty, stderr is exactly
  `error: title must be between 1 and 100 characters\n`, and the file is
  unchanged.
- **AC-003**: **Given** an empty task file, **When** the user adds a title
  consisting of three spaces, **Then** the exit code is `1`, stdout is empty,
  and stderr is exactly
  `error: title must be between 1 and 100 characters\n`.
- **AC-004**: **Given** an empty task file, **When** the user adds a title
  containing exactly 100 `A` Unicode code points, **Then** the exit code is
  `0` and the returned task title is exactly those 100 `A` characters.
- **AC-005**: **Given** an empty task file, **When** the user adds a title
  containing exactly 101 `A` characters, **Then** the exit code is `1`, stdout
  is empty, and stderr is exactly
  `error: title must be between 1 and 100 characters\n`.
- **AC-006**: **Given** an empty task file, **When** the user adds a task with
  priority `urgent`, **Then** the exit code is `1`, stdout is empty, and stderr
  is exactly `error: invalid priority: urgent\n`.
- **AC-007**: **Given** a stored task exactly equal to T1, **When** the user
  gets `task-001`, **Then** the exit code is `0`, stderr is empty, and stdout
  is exactly
  `{"id":"task-001","title":"Read book","priority":"medium","tags":["work"],"status":"todo","createdAt":"2026-11-01T10:00:00.000Z"}\n`.
- **AC-008**: **Given** no task with ID `missing`, **When** the user requests
  get, update, status, reopen, or delete for `missing`, **Then** each command
  exits `3`, emits no stdout, and writes exactly
  `error: task not found: missing\n` to stderr.
- **AC-009**: **Given** a stored task exactly equal to T1, **When** the user
  updates its title to `New`, description to `note`, priority to `high`, and
  tags to `Work`, `work`, and `Home`, **Then** the exit code is `0`, stderr is
  empty, and stdout is exactly
  `{"id":"task-001","title":"New","description":"note","priority":"high","tags":["work","home"],"status":"todo","createdAt":"2026-11-01T10:00:00.000Z"}\n`.
- **AC-010**: **Given** a task in status `todo`, **When** the user changes it
  to `in_progress`, **Then** the exit code is `0` and the returned task status
  is exactly `in_progress`.
- **AC-011**: **Given** a task in status `in_progress`, **When** the user
  changes it to `done`, **Then** the exit code is `0` and the returned task
  status is exactly `done`.
- **AC-012**: **Given** a task in status `in_progress`, **When** the user
  changes it to `todo`, **Then** the exit code is `0` and the returned task
  status is exactly `todo`.
- **AC-013**: **Given** a task in status `done`, **When** the user reopens it,
  **Then** the exit code is `0` and the returned task status is exactly `todo`.
- **AC-014**: **Given** a task in status `todo`, **When** the user requests
  status `todo`, **Then** the exit code is `1`, stdout is empty, and stderr is
  exactly `error: invalid status transition: todo -> todo\n`.
- **AC-015**: **Given** a task in status `todo`, **When** the user requests
  status `done`, **Then** the exit code is `1`, stdout is empty, and stderr is
  exactly `error: invalid status transition: todo -> done\n`.
- **AC-016**: **Given** a task in status `in_progress`, **When** the user
  requests status `in_progress`, **Then** the exit code is `1`, stdout is
  empty, and stderr is exactly
  `error: invalid status transition: in_progress -> in_progress\n`.
- **AC-017**: **Given** a task in status `done`, **When** the user requests
  status `todo`, **Then** the exit code is `1`, stdout is empty, and stderr is
  exactly `error: invalid status transition: done -> todo\n`.
- **AC-018**: **Given** a task in status `done`, **When** the user requests
  status `in_progress`, **Then** the exit code is `1`, stdout is empty, and
  stderr is exactly
  `error: invalid status transition: done -> in_progress\n`.
- **AC-019**: **Given** a task in status `done`, **When** the user requests
  status `done`, **Then** the exit code is `1`, stdout is empty, and stderr is
  exactly `error: invalid status transition: done -> done\n`.
- **AC-020**: **Given** a task in status `todo`, **When** the user invokes
  reopen, **Then** the exit code is `1`, stdout is empty, and stderr is exactly
  `error: invalid status transition: todo -> todo\n`.
- **AC-021**: **Given** a task in status `in_progress`, **When** the user
  invokes reopen, **Then** the exit code is `1`, stdout is empty, and stderr is
  exactly
  `error: invalid status transition: in_progress -> todo\n`.
- **AC-022**: **Given** a task file containing T1 followed by T2, **When** the
  user lists tasks without filters or sorting, **Then** the exit code is `0`,
  stderr is empty, and stdout is exactly
  `[{"id":"task-001","title":"Read book","priority":"medium","tags":["work"],"status":"todo","createdAt":"2026-11-01T10:00:00.000Z"},{"id":"task-002","title":"Buy milk","priority":"low","tags":["home"],"status":"todo","createdAt":"2026-11-01T10:01:00.000Z"}]\n`.
- **AC-023**: **Given** a missing storage file, **When** the user lists tasks,
  **Then** the exit code is `0`, stdout is exactly `[]\n`, and stderr is empty.
- **AC-024**: **Given** T1, T2, and T3 in that creation order, **When** the
  user lists with repeated tags `work` and `home`, **Then** the exit code is
  `0`, stderr is empty, and stdout is exactly
  `[{"id":"task-both","title":"Plan","priority":"medium","tags":["work","home"],"status":"todo","createdAt":"2026-11-01T10:02:00.000Z"}]\n`.
- **AC-025**: **Given** a task file with no task tagged `missing`, **When** the
  user lists with tag `missing`, **Then** the exit code is `0`, stdout is
  exactly `[]\n`, and stderr is empty.
- **AC-026**: **Given** tags `Work`, `work`, and `Home` on a new task, **When**
  the task is added, **Then** the exit code is `0` and its stored and returned
  tags are exactly `["work","home"]`.
- **AC-027**: **Given** four tasks where `task-a` and `task-b` have priority
  `high` and identical `createdAt`, `task-c` has priority `medium`, and
  `task-d` has priority `low`, **When** the user lists with priority sorting,
  **Then** the exit code is `0` and task IDs are exactly
  `["task-a","task-b","task-c","task-d"]`.
- **AC-028**: **Given** a missing storage file, **When** the user successfully
  adds one task, **Then** the exit code is `0` and the file is valid JSON
  containing exactly a one-element task array.
- **AC-029**: **Given** a storage file containing exactly `{broken`, **When**
  the user lists tasks, **Then** the exit code is `2`, stdout is empty, stderr
  is exactly `error: storage error\n`, and the file still contains exactly
  `{broken`.
- **AC-030**: **Given** the storage path exists but cannot be read (any read
  error other than the file not existing, for example the path is a
  directory), **When** the user lists tasks, **Then** the exit code is `2`,
  stdout is empty, stderr is exactly `error: storage error\n`, and the storage
  path remains untouched.
- **AC-031**: **Given** a task file with tasks of priorities `high`, `medium`,
  and `low`, **When** the user lists with priority sorting, **Then** the
  returned priority sequence is exactly `["high","medium","low"]`.
- **AC-032**: **Given** tasks created in order `task-002`, then `task-001`,
  with equal priority and equal `createdAt`, **When** the user lists with
  priority sorting, **Then** the returned IDs are exactly
  `["task-001","task-002"]`.
- **AC-033**: **Given** a valid task with ID `task-001`, **When** the user
  deletes it, **Then** the exit code is `0`, stdout is exactly
  `{"deleted":true,"id":"task-001"}\n`, and the task is absent from storage.
- **AC-034**: **Given** T3 in storage, **When** the user filters by tags
  `work` and `home`, **Then** the exit code is `0`, stderr is empty, and stdout is exactly
  `[{"id":"task-both","title":"Plan","priority":"medium","tags":["work","home"],"status":"todo","createdAt":"2026-11-01T10:02:00.000Z"}]\n`;
  **When** the user filters by `work` and `missing`, **Then** the exit code is
  `0`, stderr is empty, and stdout is exactly `[]\n`.
- **AC-035**: **Given** a stored task exactly equal to T1, **When** the user
  updates its title to exactly 101 `A` characters, **Then** the exit code is
  `1`, stdout is empty, stderr is exactly
  `error: title must be between 1 and 100 characters\n`, and the stored task
  remains exactly T1.
- **AC-036**: **Given** a stored task exactly equal to T1, **When** the user
  updates its priority to `urgent`, **Then** the exit code is `1`, stdout is
  empty, stderr is exactly `error: invalid priority: urgent\n`, and the stored
  task remains exactly T1.
- **AC-037**: **Given** a stored task exactly equal to T1, **When** the user
  requests status `blocked`, **Then** the exit code is `1`, stdout is empty,
  stderr is exactly `error: invalid status: blocked\n`, and the stored task
  remains exactly T1.
- **AC-038**: **Given** an empty task file, **When** the user adds a task with
  an empty tag, **Then** the exit code is `1`, stdout is empty, stderr is
  exactly `error: tag must not be empty\n`, and the file remains unchanged.
- **AC-039**: **Given** T1 and T4, **When** the user lists with tag value
  `" Work "`, **Then** the exit code is `0`, stderr is empty, and stdout is
  exactly
  `[{"id":"task-001","title":"Read book","priority":"medium","tags":["work"],"status":"todo","createdAt":"2026-11-01T10:00:00.000Z"}]\n`.
- **AC-040**: **Given** T1 is stored and the injected ID generator returns
  `task-001` for a new task, **When** the user adds title `Another`, **Then**
  the exit code is `1`, stdout is empty, stderr is exactly
  `error: duplicate task id: task-001\n`, and the stored file remains exactly
  T1.
- **AC-041**: **Given** an empty task file and an injected ID generator
  returning an empty string, **When** the user adds title `Another`, **Then**
  the exit code is `1`, stdout is empty, stderr is exactly
  `error: invalid task id\n`, and the file remains unchanged.
- **AC-042**: **Given** T1 is stored, **When** the user updates `task-001`
  without supplying any fields, **Then** the exit code is `1`, stdout is empty,
  stderr is exactly `error: no update fields provided\n`, and the stored file
  remains exactly T1.
- **AC-043**: **Given** an empty task file, an ID generator returning
  `task-002`, and a fake clock returning
  `2026-11-01T10:01:00.000Z`, **When** the user adds title
  `"  Read   book  "`, **Then** the exit code is `0`, stderr is empty, and
  stdout is exactly
  `{"id":"task-002","title":"Read   book","priority":"medium","tags":[],"status":"todo","createdAt":"2026-11-01T10:01:00.000Z"}\n`.
- **AC-044**: **Given** T1, T2, T3, and T5 in that creation order, **When**
  the user lists with repeated tags `work` and `home` and priority sorting,
  **Then** the exit code is `0`, stderr is empty, and stdout is exactly
  `[{"id":"task-high-both","title":"Urgent plan","priority":"high","tags":["work","home"],"status":"todo","createdAt":"2026-11-01T10:04:00.000Z"},{"id":"task-both","title":"Plan","priority":"medium","tags":["work","home"],"status":"todo","createdAt":"2026-11-01T10:02:00.000Z"}]\n`.
- **AC-045**: **Given** an empty task file, ID generator returning `task-002`,
  and clock returning a Date for `2026-11-01T10:01:00.000Z`, **When** the user
  adds title `A`, **Then** the exit code is `0` and the task's `createdAt` is
  exactly `2026-11-01T10:01:00.000Z`.
- **AC-046**: **Given** T1, **When** the user updates `task-001` with
  `--description ""` and `--clear-tags`, **Then** the exit code is `0`,
  stderr is empty, and stdout is exactly
  `{"id":"task-001","title":"Read book","priority":"medium","tags":[],"status":"todo","createdAt":"2026-11-01T10:00:00.000Z"}\n`.
- **AC-047**: **Given** T1, **When** the user updates with both `--tag work`
  and `--clear-tags`, **Then** the exit code is `1`, stdout is empty, stderr
  is exactly `error: --clear-tags cannot be combined with --tag\n`, and the
  stored task remains exactly T1.
- **AC-048**: **Given** each usage or validation error case in the CLI
  contract's exit-code-1 table with its required valid task fixture, **When**
  `main` receives that case's argv and valid deps, **Then** it returns exactly
  `1`, writes no stdout, and writes exactly `error: ` followed by the matching
  table message and one newline to stderr; storage remains unchanged.
- **AC-049**: **Given** a dependency fixture with a missing `storagePath`, a
  missing/non-function dependency member, or a clock returning an invalid
  Date, **When** `main` is invoked, **Then** it returns exactly `1`, writes no
  stdout, and writes exactly `error: invalid dependencies\n` to stderr.
- **AC-050**: **Given** a storage file containing valid JSON whose root is an
  object instead of a task array, **When** the user lists tasks, **Then** the
  exit code is `2`, stdout is empty, stderr is exactly
  `error: storage error\n`, and the file remains byte-for-byte unchanged.
- **AC-051**: **Given** a valid task file and a storage write that fails,
  **When** the user performs a mutation, **Then** the exit code is `2`, stdout
  is empty, and stderr is exactly `error: storage error\n`.
- **AC-052**: **Given** a missing storage file, an ID factory returning
  `task-003`, and a clock returning a Date whose ISO string is
  `2026-11-01T10:02:00.000Z`, **When** the user adds title `Buy` with
  `--description ""`, **Then** the exit code is `0`, stderr is empty, and
  stdout is exactly
  `{"id":"task-003","title":"Buy","description":"","priority":"medium","tags":[],"status":"todo","createdAt":"2026-11-01T10:02:00.000Z"}\n`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100 percent of the acceptance criteria AC-001 through AC-052
  pass with exact exit-code, stdout, stderr, and persisted-file assertions.
- **SC-002**: Repeating any acceptance test with the same initial JSON file and
  injected dependencies produces byte-for-byte identical stdout, stderr, and
  persisted JSON.
- **SC-003**: Invalid transitions cover all six disallowed status-command
  combinations and both disallowed reopen source statuses with exact messages.

## Assumptions

- Direct execution uses `node src/cli.js`; command names are `add`, `list`,
  `get`, `update`, `status`, `reopen`, and `delete`. A separate executable
  alias is not required.
- Add and update accept repeated `--tag` options. Update replaces the tags only
  when at least one `--tag` option is supplied; omitted fields remain
  unchanged. On add, `--description ""` stores an empty string; on update, it
  removes the optional description. `--clear-tags` clears all tags.
- Stored tags and filters are trimmed and lowercased; matching is exact per
  whole tag, and repeated filters use AND semantics.
- List filtering is applied before sorting; `list` emits an array and `get`
  emits one task object, each as compact JSON followed by one newline.
- Successful output is compact JSON followed by exactly one newline. Add,
  get, update, status, and reopen print a task object; list prints an array;
  delete prints `{"deleted":true,"id":"<id>"}`.
- Tasks are stored as a JSON array in creation order. Updating a task does not
  change its creation position. JSON uses UTF-8.
- Titles are trimmed at both ends before storage and length validation;
  internal whitespace is preserved exactly. Tags are trimmed,
  lowercased, and deduplicated after case normalization, preserving the first
  normalized occurrence. Empty tags are invalid.
- The injected clock returns a `Date`; task creation calls its
  `toISOString()` method. Only the single direct-execution composition root
  constructs a real Date using `new Date()`.
- The CLI argument grammar, JSON output shapes, and complete error messages are
  fixed in `contracts/cli-contract.md`.
- Titles are measured in Unicode code points after trimming; whitespace inside
  the title is preserved.
- An update can clear the description with an empty string and clear all tags
  with `--clear-tags`; it cannot combine `--clear-tags` with `--tag`.
- IDs may be any nonempty string generated by the injected ID generator and
  must be unique among stored tasks; empty IDs fail with `invalid task id`,
  while duplicate IDs fail with `duplicate task id: <id>`.
- Known validation messages are `title must be between 1 and 100 characters`,
  `invalid priority: <value>`, and `task not found: <id>`. All storage read or
  parse errors use `storage error`.
- The JSON file is loaded at command start and written only after a successful
  mutation. If loading fails, no mutation or write occurs.
- Existing storage must be a JSON array of valid task records with unique IDs,
  normalized unique tags, canonical ISO timestamps, and no unknown fields;
  otherwise it is a storage error.
- Update commands MUST include at least one field to change; empty updates are
  rejected with `no update fields provided`.
- Authentication, synchronization, recurring tasks, and graphical or web
  interfaces are out of scope.

## Change History

- **2026-11-01**: AC-030 precondition generalised: permission-based setup is
  not portable to Windows. Accepting any read error other than a missing file
  lets deterministic tests cover unreadable storage across platforms while
  preserving the exact storage-error response and no-write guarantee.
- **2026-11-01**: Clarified ID generation: any nonempty generated string is
  accepted if unique among stored tasks; collisions fail with exit code 1 and
  leave storage unchanged.
- **2026-11-01**: Clarified empty updates: they fail with exit code 1 and
  `no update fields provided`, with no stdout or storage change.
- **2026-11-01**: Clarified title whitespace: trim leading and trailing
  whitespace, preserve internal whitespace exactly.
- **2026-11-01**: Clarified list/get output and combined list options: list
  returns an array, get returns a task object, and all tag filters apply before
  priority sorting.
- **2026-11-01**: Fixed the command grammar and output contract in
  `contracts/cli-contract.md`; direct execution supplies the specified real
  dependencies and `main(argv, deps)` remains synchronous.
- **2026-11-01**: Clarified that the injected clock returns a Date and
  `createdAt` is its ISO-8601 representation; the real Date is created only in
  the composition root.
- **2026-11-01**: Clarified empty description and tag updates: empty
  description removes the optional field; `--clear-tags` empties tags and is
  incompatible with `--tag`.
- **2026-11-01**: Clarified add/update description handling: add preserves an
  explicitly supplied empty string; update with an empty description removes
  the optional field.
- **2026-11-01**: Clarified title length as Unicode code points and aligned
  persisted task-shape validation, ID ordering, and command errors with the
  normative contract.
- **2026-11-01**: Clarified tag normalization and matching: tags and filters
  are trimmed and lowercased, matches are exact whole-tag matches, and
  repeated filters use AND semantics.
- **2026-11-01**: Initial specification created from the user-provided Smart
  Todo CLI requirements; subsequent dated entries resolve its implementation
  contract and edge-case decisions.
