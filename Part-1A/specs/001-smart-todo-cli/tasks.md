# Implementation Tasks: Smart Todo CLI

**Feature**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)  
**Contract**: [contracts/cli-contract.md](./contracts/cli-contract.md)

These are implementation tasks only. Tests and `.harness/` are human-owned,
must be written and locked before implementation, and are not created or
modified by these tasks. The test paths below are intended for the
human-authored files that verify the implementation; all tests call only
`main(argv, deps)`.

## Implementation Tasks

- [ ] **T001 - Implement task and value validation**
  - Add focused validators in `src/validation.js` for normalized titles,
    priorities, statuses, IDs, tags, update-field constraints, and persisted
    task records. Preserve exact contract messages and avoid system time or
    randomness.
  - **Satisfies**: FR-002-FR-006, FR-018-FR-019.
  - **Verified by**: `tests/cli.test.js` - AC-002-AC-006, AC-026, AC-035-AC-038,
    AC-040-AC-041, AC-043.
  - **Depends on**: none.

- [ ] **T002 - Implement safe JSON-file storage**
  - Add synchronous load and save operations in `src/storage.js`. Treat only a
    missing file as an empty collection; reject unreadable, malformed, or
    structurally invalid data as `storage error`; ensure failed reads/parses do
    not overwrite the source file and failed writes emit no success result.
  - **Satisfies**: FR-012-FR-013, FR-016.
  - **Verified by**: `tests/storage.test.js` and `tests/cli.test.js` - AC-028-AC-030,
    AC-050-AC-051.
  - **Depends on**: T001.

- [ ] **T003 - Implement task creation and CRUD operations**
  - Implement add, get, update, and delete behavior in `src/service.js`, using
    the validators and storage interface. Preserve property ordering, optional
    description semantics, array creation order, update atomicity, ID
    uniqueness, and exact delete output data.
  - **Satisfies**: FR-001-FR-007, FR-019-FR-020.
  - **Verified by**: `tests/cli.test.js` - AC-001-AC-009, AC-033, AC-035-AC-036,
    AC-038, AC-040-AC-043, AC-045-AC-047, AC-052.
  - **Depends on**: T001, T002.

- [ ] **T004 - Implement status changes and reopening**
  - Implement the allowed `status` and `reopen` transitions in
    `src/service.js`. Reject every other transition, including same-status
    requests, with the exact `invalid status transition: <from> -> <to>`
    message.
  - **Satisfies**: FR-008-FR-009, FR-018.
  - **Verified by**: `tests/cli.test.js` - AC-010-AC-021, AC-037.
  - **Depends on**: T003.

- [ ] **T005 - Implement task listing and deterministic ordering**
  - Implement list filtering and sorting in `src/service.js`. Apply normalized
    exact-tag AND filters before sorting; preserve stored order by default;
    sort by priority, `createdAt`, and Unicode code-point ID as specified.
  - **Satisfies**: FR-010-FR-011, FR-021.
  - **Verified by**: `tests/cli.test.js` - AC-022-AC-027, AC-031-AC-032,
    AC-034, AC-039, AC-044.
  - **Depends on**: T003.

- [ ] **T006 - Implement the CLI contract and composition root**
  - Implement `main(argv, deps)` and direct execution in `src/cli.js`. Parse
    the exact command grammar and error precedence, validate dependency shape,
    dispatch every command, and emit only the contract's compact JSON or error
    line. Build real dependencies only in the single composition-root
    function. Keep every function within the constitution's complexity and
    linting limits.
  - **Satisfies**: FR-001, FR-014-FR-016, FR-022-FR-024.
  - **Verified by**: `tests/cli.test.js` and `tests/storage.test.js` - AC-048-AC-049
    plus the exact command/output/error assertions for AC-001-AC-047 and
    AC-050-AC-052.
  - **Depends on**: T002, T003, T004, T005.

## Implementation Prerequisite

The approved plan records that the existing `package.json` declares Express,
which conflicts with the constitution's no-runtime-dependencies requirement.
Resolve that manifest conflict through the required human authorization before
implementation begins; it is not an agent implementation task under the
current file-change boundary. No `tests/*.test.js` files were found in the
workspace during task generation, so the human-owned test files must also be
written and locked before implementation begins.
