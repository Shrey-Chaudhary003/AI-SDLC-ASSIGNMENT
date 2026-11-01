# Feature Specification: Smart Todo CLI

**Feature Branch**: `001-smart-todo-cli`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Build Smart Todo CLI, a Node.js command-line task manager with JSON-file persistence and deterministic dependencies."

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
  `createdAt` ISO-8601 string produced from an injected clock. `description`
  MUST be an optional string.
- **FR-003**: The CLI MUST trim titles supplied to add or update and accept
  only titles whose trimmed length is between 1 and 100 characters inclusive.
- **FR-004**: A newly added task MUST default to priority `medium`, tags `[]`,
  and status `todo`; omitted description MUST be absent from the returned and
  persisted task object.
- **FR-005**: Priority supplied to add or update MUST be one of `low`,
  `medium`, or `high`; every other value MUST fail validation with exit code 1
  and message `invalid priority: <value>`.
- **FR-006**: Tags supplied to add or update MUST be nonempty after trimming,
  normalized to lowercase, and unique while preserving first occurrence
  order. Empty tags MUST fail validation with exit code 1 and message
  `tag must not be empty`. List tag filters MUST use the same normalization.
- **FR-007**: Updating a task MUST support title, description, priority, and
  tags. Omitted update fields MUST remain unchanged; supplied tags replace the
  prior tag array.
- **FR-008**: The status operation MUST allow only `todo -> in_progress`,
  `in_progress -> done`, and `in_progress -> todo`. Every other attempted
  transition, including setting the current status, MUST fail with exit code 1
  and message `invalid status transition: <from> -> <to>`.
- **FR-009**: The reopen operation MUST allow only `done -> todo`. Reopen
  attempts from `todo` or `in_progress` MUST fail with exit code 1 and message
  `invalid status transition: <from> -> todo`.
- **FR-010**: List without sort MUST return tasks in creation order. Repeated
  tag filters MUST combine with AND; a tag filter with no matches MUST return
  an empty array.
- **FR-011**: `list --sort priority` MUST order tasks by priority `high`,
  `medium`, `low`, then `createdAt` ascending, then `id` ascending.
- **FR-012**: The CLI MUST persist tasks in one JSON file. A missing file MUST
  be treated as an empty task collection.
- **FR-013**: An unreadable file or invalid JSON MUST produce exit code 2 and a
  storage error. The CLI MUST NOT overwrite the source file after either
  failure.
- **FR-014**: Exit codes MUST be exactly 0 for success, 1 for validation or
  transition errors, 2 for storage errors, and 3 when a requested task ID is
  not found.
- **FR-015**: Successful command results MUST be printed as JSON on stdout.
  Errors MUST be printed to stderr as `error: <message>`. Failed commands MUST
  emit no success result on stdout.
- **FR-016**: Task persistence, clock, and ID generation MUST be deterministic
  under injected dependencies; repeated identical inputs and dependency state
  MUST produce identical outputs and storage contents.
- **FR-017**: Authentication, synchronization, recurring tasks, and all user
  interfaces other than the command line are out of scope.
- **FR-018**: A status value outside `todo`, `in_progress`, and `done` MUST
  fail validation with exit code 1 and message `invalid status: <value>`.

### Key Entities

- **Task**: A persisted item with ID, trimmed title, optional description,
  priority, normalized tags, status, and creation timestamp.
- **Task collection**: The ordered set of tasks stored in the single JSON file.
- **Injected dependencies**: The ID generator, clock, storage path, stdout, and
  stderr provided to the CLI composition root.

## Acceptance Criteria

For all criteria, tests use a temporary JSON file, deterministic injected
dependencies, and exact exit-code/output assertions. The provisional command
syntax and JSON output shape are described under Assumptions and
[NEEDS CLARIFICATION] below.

The following exact task fixtures are used where referenced:

- **T1**: `{"id":"task-001","title":"Read book","priority":"medium","tags":["work"],"status":"todo","createdAt":"2026-11-01T10:00:00.000Z"}`
- **T2**: `{"id":"task-002","title":"Buy milk","priority":"low","tags":["home"],"status":"todo","createdAt":"2026-11-01T10:01:00.000Z"}`
- **T3**: `{"id":"task-both","title":"Plan","priority":"medium","tags":["work","home"],"status":"todo","createdAt":"2026-11-01T10:02:00.000Z"}`

- **AC-001**: **Given** a missing storage file, an ID generator returning
  `task-001`, and a fake clock returning
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
  containing exactly 100 `A` characters, **Then** the exit code is `0` and the
  returned task title is exactly those 100 characters.
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
- **AC-030**: **Given** a storage path whose read operation fails with
  `EACCES`, **When** the user lists tasks, **Then** the exit code is `2`,
  stdout is empty, stderr is exactly `error: storage error\n`, and no write
  operation changes the file.
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

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100 percent of the acceptance criteria AC-001 through AC-038
  pass with exact exit-code, stdout, stderr, and persisted-file assertions.
- **SC-002**: Repeating any acceptance test with the same initial JSON file and
  injected dependencies produces byte-for-byte identical stdout, stderr, and
  persisted JSON.
- **SC-003**: Invalid transitions cover all six disallowed status-command
  combinations and both disallowed reopen source statuses with exact messages.

## Assumptions

- The provisional executable is `smart-todo`; command names are `add`, `list`,
  `get`, `update`, `status`, `reopen`, and `delete`.
- Add and update accept repeated `--tag` options. Update replaces the tags only
  when at least one `--tag` option is supplied; omitted fields remain
  unchanged. `--description ""` clears a description.
- Successful output is compact JSON followed by exactly one newline. Add,
  get, update, status, and reopen print a task object; list prints an array;
  delete prints `{"deleted":true,"id":"<id>"}`.
- Tasks are stored as a JSON array in creation order. Updating a task does not
  change its creation position. JSON uses UTF-8.
- Titles are trimmed before storage and length validation. Tags are trimmed,
  lowercased, and deduplicated after case normalization, preserving the first
  normalized occurrence. Empty tags are invalid.
- A fake clock returns an ISO-8601 string directly.
- Known validation messages are `title must be between 1 and 100 characters`,
  `invalid priority: <value>`, and `task not found: <id>`. All storage read or
  parse errors use `storage error`.
- The JSON file is loaded at command start and written only after a successful
  mutation. If loading fails, no mutation or write occurs.
- Authentication, synchronization, recurring tasks, and graphical or web
  interfaces are out of scope.

## [NEEDS CLARIFICATION]

- **CLI syntax**: Confirm the provisional `smart-todo` executable name,
  positional argument order, and option spelling above.
- **Successful output contract**: Confirm whether the assumed JSON result
  shapes (task object, task array, and delete result object) and exact newline
  formatting are the required public contract.
- **Clock contract**: Confirm whether the injected clock supplies an ISO-8601
  string, or supplies a numeric time that the composition root converts to
  ISO-8601. The constitution forbids `Date` use in `src/`, so the production
  composition-root clock design needs an explicit decision.

## Change History

- **2026-11-01**: Initial specification created from the user-provided Smart
  Todo CLI requirements. Provisional CLI syntax, output shapes, and clock
  contract are marked for clarification.
