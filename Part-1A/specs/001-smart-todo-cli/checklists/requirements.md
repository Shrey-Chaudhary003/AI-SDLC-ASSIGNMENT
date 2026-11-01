# Specification Quality Checklist: Smart Todo CLI

Use this checklist to review the feature specification and its normative CLI
contract before implementation. Mark an item complete only after verifying it
against those artifacts. This checklist evaluates specification quality; it
does not authorize changes to requirements, acceptance criteria, tests, or
harness files.

## Requirement Completeness

- [ ] CHK001 Are all in-scope task operations represented by functional
  requirements, including add, list, get, update, status, reopen, and delete?
- [ ] CHK002 Does the task model specify every required field, optional field,
  default value, and source for generated IDs and timestamps?
- [ ] CHK003 Are title trimming, Unicode code-point length limits, and internal
  whitespace behavior defined?
- [ ] CHK004 Are tag normalization, deduplication order, exact matching, and
  repeated-filter AND semantics defined for both writes and reads?
- [ ] CHK005 Are update semantics specified for omitted fields, empty
  descriptions, tag replacement, tag clearing, and conflicting flags?
- [ ] CHK006 Are every allowed and disallowed status transition and the
  dedicated reopen behavior specified?
- [ ] CHK007 Are persistence format, missing-file behavior, invalid-storage
  behavior, write failures, and non-overwrite guarantees specified?
- [ ] CHK008 Are command exit codes, stdout/stderr formats, and error messages
  defined for success and every failure class?
- [ ] CHK009 Are all out-of-scope capabilities explicitly identified?

## Requirement Clarity

- [ ] CHK010 Does the CLI contract define unambiguous syntax, option
  repetition, positional arguments, missing values, and option ordering for
  every command?
- [ ] CHK011 Are task JSON property order, optional-property omission, compact
  serialization, and trailing newline behavior explicit?
- [ ] CHK012 Is priority sorting fully ordered, including priority rank,
  timestamp tie-breaker, and Unicode code-point ID tie-breaker?
- [ ] CHK013 Are dependency shape, synchronous behavior, module import
  side-effect rules, and composition-root responsibilities explicit?
- [ ] CHK014 Does error precedence unambiguously resolve syntax, storage,
  lookup, and operation-specific failures?
- [ ] CHK015 Are persisted task validation rules sufficiently precise to
  distinguish valid records from storage errors?

## Acceptance Criteria Quality

- [ ] CHK016 Are acceptance criterion IDs unique and sequential from AC-001
  through AC-052?
- [ ] CHK017 Does every acceptance criterion state Given/When/Then behavior
  with exact, binary expected results?
- [ ] CHK018 Do criteria assert exact exit codes and exact output, including
  empty streams and required newlines where applicable?
- [ ] CHK019 Can all criteria be exercised deterministically through
  `main(argv, deps)` using fixed clocks, IDs, storage, and output sinks?
- [ ] CHK020 Do fixtures provide exact persisted task data for ordering,
  filtering, updates, and status transitions?
- [ ] CHK021 Are title boundaries, invalid priorities/statuses, empty tags,
  duplicate IDs, empty updates, and update clearing covered?
- [ ] CHK022 Are all invalid status transitions, including same-state
  transitions and invalid reopen sources, covered with exact messages?
- [ ] CHK023 Are empty lists, unmatched filters, repeated filters, normalized
  filters, priority ties, and combined filtering/sorting covered?
- [ ] CHK024 Are missing, malformed, unreadable, structurally invalid, and
  unwritable storage cases covered, including preservation on failure?
- [ ] CHK025 Does the aggregate acceptance criterion require every individual
  AC to pass, rather than permitting a partial pass?

## Consistency and Scope

- [ ] CHK026 Do the specification, plan, data model, and CLI contract agree on
  commands, fields, persistence, dependency injection, outputs, and errors?
- [ ] CHK027 Do all plan and contract decisions that affect observable behavior
  appear in the specification's Clarifications and dated Change History?
- [ ] CHK028 Does the plan preserve the constitution's CommonJS, built-in-only
  runtime, deterministic dependency, exact-test, lint, security, and coverage
  constraints?
- [ ] CHK029 Are test-authoring and harness ownership kept with the human, with
  implementation tasks only referencing the tests that verify them?
- [ ] CHK030 Are known workspace blockers and prerequisites distinguished from
  approved feature requirements, without weakening any acceptance criterion?
