# Implementation Plan: Smart Todo CLI

**Branch**: `001-smart-todo-cli` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-smart-todo-cli/spec.md`

## Summary

Build a synchronous Node.js 20+ CommonJS command-line task manager whose only
persistent state is one JSON file. `src/cli.js` exports `main(argv, deps)`;
small service, storage, and validation modules implement the task lifecycle,
normalization, deterministic listing, and persistence. The exact CLI boundary,
error messages, and output JSON are fixed in
[contracts/cli-contract.md](./contracts/cli-contract.md). Human-authored tests
must be written from the spec and contract before implementation.

## Technical Context

**Language/Version**: Node.js 20 or newer, CommonJS

**Primary Dependencies**: Node.js built-in modules only; no runtime
dependencies

**Storage**: One UTF-8 JSON file containing an ordered task array

**Testing**: `node:test` and `node:assert/strict`; tests live under `tests/`
and are authored by the human before implementation

**Target Platform**: Node.js 20+ on supported desktop operating systems

**Project Type**: Synchronous command-line application

**Performance Goals**: No numeric latency or scale target is specified; local
JSON-file task management is the only supported scope

**Constraints**: Dependency injection for clock, IDs, path, stdout, and stderr;
one real-dependency composition root; no direct system time or randomness
outside that root; zero ESLint errors/warnings, zero security findings, and at
least 90% source line coverage under the existing harness

**Scale/Scope**: One local task file and one process at a time; no sync,
authentication, recurrence, or UI

## Constitution Check

- **Specification authority**: PASS. The plan follows the FR/AC contract and
  records choices in the feature spec's Clarifications and Change History.
- **Built-in runtime dependencies**: BLOCKED in the current workspace.
  The proposed design uses only Node.js built-ins, but the current
  `package.json` still declares Express. An authorized manifest change must
  remove that dependency before implementation can meet this gate. This
  planning request does not change manifests.
- **Determinism**: PASS. Tests call `main(argv, deps)` using fixed `Date`
  instances, IDs, storage paths, and output sinks. Only the single direct-run
  composition-root function creates real dependencies.
- **Architecture and persistence**: PASS. The design isolates argument
  parsing/entry point, task operations, JSON-file access, and validation.
- **Agent boundaries**: PASS. This plan writes no application source or tests.
  Tests remain human-authored; plan artifacts are within the approved
  `/speckit-plan` exception.
- **Testing and quality**: PASS as design targets. Acceptance testing uses
  exact assertions; existing lint, security, and c8 harness thresholds are not
  changed or supplemented with new tooling.
- **Implementation evidence and human acceptance**: PASS as a required
  workflow. Preserve the first generated implementation before any repair;
  limit repairs to two and base them only on harness findings; after harness
  PASS, record a human ACCEPT or REJECT and known limitations.

## Design Decisions

1. Keep `main` synchronous. All file operations use synchronous Node built-ins,
   which matches the required integer return and one-command-at-a-time CLI.
2. Keep `src/cli.js` as the sole composition root. Its direct-execution path
   creates the clock, UUID factory, storage path, and process output sinks;
   imported callers receive no real dependencies or process side effects.
3. Use a JSON array as the persisted representation. Array position is
   creation order; updates replace an item at the same position, and deletes
   remove it.
4. Validate and normalize before committing a mutation. Read and parse storage
   before operating; missing storage is an empty array, but unreadable,
   malformed, or structurally invalid storage is an error and is never
   overwritten.
5. Normalize tag values and filters by trimming and lowercasing; match complete
   tags with AND semantics. For priority sorting, use rank, ISO timestamp, and
   deterministic code-point ID comparison.
6. Count title length using Unicode code points after trimming, and preserve
   internal whitespace. Convert the injected Date to `createdAt` with
   `toISOString()`.
7. Map command usage, validation, and transition failures to exit code 1;
   storage failures to 2; missing tasks to 3. Emit exactly one JSON document
   plus newline on success and only the specified error line on failure.

## Architecture

- `src/cli.js`: Export `main(argv, deps)`, parse only the contract grammar,
  dispatch operations, format output/errors, and contain the sole
  composition-root function for direct execution.
- `src/service.js`: Implement add/list/get/update/status/reopen/delete and
  enforce lifecycle transitions, filtering, sorting, and task-level behavior.
- `src/storage.js`: Synchronously read, validate, and write the JSON task
  array. Treat only a missing file as an empty collection; normalize I/O and
  JSON/shape failures to the contract storage error.
- `src/validation.js`: Validate titles, priorities, statuses, IDs, tags, and
  command/update constraints. Split into additional focused modules only if
  needed to keep every function within the lint complexity ceiling.
- `tests/`: Human-authored `*.test.js` files only; this plan does not create or
  edit tests.
- `contracts/cli-contract.md`: Normative command/API/error/output contract.

## Project Structure

### Documentation (this feature)

```text
specs/001-smart-todo-cli/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── spec.md
└── contracts/
    └── cli-contract.md
```

### Source Code (repository root)

```text
src/
├── cli.js
├── service.js
├── storage.js
└── validation.js

tests/
└── *.test.js                 # authored by the human, not this plan
```

**Structure Decision**: Use the user-requested single Node.js CLI layout.
Split `validation.js` further only when necessary to maintain readable,
complexity-bounded functions; do not create framework layers or add runtime
packages.

## Test Strategy

Tests import only `main(argv, deps)`. Each test supplies an isolated temporary
storage path, a clock returning a fixed `Date`, a deterministic `idFactory`,
and capture sinks for stdout/stderr. Test titles start with their AC-ID and
assert exact exit codes, exact output bytes (including newlines), and exact
file contents.

Cover success and failure for all seven commands; defaults and optional fields;
title boundaries, trimming, and internal whitespace; tag normalization,
deduplication, AND filters, empty matches, and clearing; priority validation
and tie ordering; every allowed and rejected status transition; empty updates;
ID validation and collisions; unknown IDs; malformed CLI syntax; missing,
corrupt, unreadable, invalid-shape, and unwritable storage; and non-overwrite
behavior after read/parse failures. The human runs the existing harness for
ESLint, eslint-plugin-security, c8, and acceptance tests. No tooling or tests
are added by this plan.

## Complexity Tracking

No design violation is proposed. The existing Express dependency in
`package.json` is a current gate failure and must be removed through an
explicitly authorized manifest change before implementation; it is outside
this planning scope.
