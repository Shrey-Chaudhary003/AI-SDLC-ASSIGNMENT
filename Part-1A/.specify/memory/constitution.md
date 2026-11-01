<!--
Sync Impact Report
Version change: 1.0.0 -> 2.0.0
Modified principles: all five rate-limiter principles replaced with nine Smart Todo CLI principles
Added sections: none
Removed sections: rate-limiter-specific requirements
Follow-up TODOs: none
-->

# Smart Todo CLI Constitution

## Core Principles

### I. Specification Authority
For each feature, `specs/<feature>/spec.md`, `plan.md`, `tasks.md`, and
`contracts/` are the single source of truth. Every functional requirement MUST
have a unique `FR-001`, `FR-002`, ... ID. Every acceptance criterion MUST have a
unique `AC-001`, `AC-002`, ... ID, use Given/When/Then form, and define
decidable pass/fail behavior. If an ambiguity is found later, it MUST be
resolved in the upstream artifact and recorded with a date in its `Change
History` section; implementation MUST NOT silently resolve it.

### II. Lint Quality
ESLint MUST use `eslint.config.js` and report exactly zero errors and zero
warnings for `src/` and `tests/`. The cyclomatic complexity of every function
MUST be at most 12.

### III. Security
`eslint-plugin-security` MUST use `eslint.security.config.js` and report zero
findings on `src/`. Source code MUST NOT contain hard-coded secrets, keys, or
machine-specific paths.

### IV. Exact Tests and Coverage
Every test in `tests/` MUST pass using `node:test` and `node:assert/strict`.
Line coverage of `src/` measured by c8 MUST be at least 90 percent. Each test
title MUST start with the AC-ID it verifies, such as `AC-007: ...`. Exit-code
and output assertions MUST check exact values with assertions such as
`assert.strictEqual` and `assert.deepStrictEqual`; ranges are forbidden.

### V. Deterministic Dependencies
Modules under `src/` MUST NOT call `Date`, `Math.random`, or `crypto` directly.
The clock, ID generator, storage path, stdout, and stderr MUST be injected
through a `deps` object. Exactly one composition-root function MAY construct the
real dependencies. The same input and dependency state MUST produce the same
output.

### VI. Built-In Runtime Dependencies
The application MUST use Node.js CommonJS and JSON-file persistence. It MUST
have no runtime dependencies; all runtime capabilities MUST use Node.js
built-in modules.

### VII. Coding-Agent Boundaries
A coding agent MUST create or change files only under `src/`. It MUST NOT
create, edit, rename, or delete files in `tests/`, `specs/`, `.harness/`,
`.specify/memory/constitution.md`, `eslint.config.js`, or
`eslint.security.config.js`. It MUST NOT add suppression comments such as
`eslint-disable`, `c8 ignore`, or `nosec`, skip or weaken tests, or lower a
quality threshold.

### VIII. Implementation Evidence and Repairs
The first generated implementation MUST be preserved before any repair. No
more than two repair attempts MAY follow, and each repair MUST be driven only
by findings from the harness. Evidence from the initial implementation and
each repair MUST remain available for review.

### IX. Human Acceptance
A harness PASS MUST be followed by a human `ACCEPT` or `REJECT` decision.
Known limitations MUST be recorded with that decision; a harness PASS alone
does not constitute acceptance.

## Architecture and Persistence

The CLI MUST persist task data in a JSON file. Changes to the storage format,
command behavior, or externally observable output MUST be specified in the
authoritative feature artifacts and verified against their acceptance
criteria.

## Development and Quality Gates

Before delivery, the applicable ESLint and security checks MUST meet the exact
thresholds in this constitution, and all tests MUST pass with at least 90
percent line coverage of `src/`. Acceptance evidence MUST include exact
assertions for command exit codes and output. Any proposed exception requires
an approved constitution amendment; implementation MUST NOT bypass a gate.

## Governance

This constitution governs project specifications, plans, contracts,
implementation, validation, and review. Amendments MUST be made explicitly in
this file and update the version and amendment date. Use semantic versioning:
MAJOR for incompatible changes to principles, MINOR for new principles or
materially expanded requirements, and PATCH for clarifications and
non-semantic edits. Reviews MUST verify compliance with every applicable
principle. A human MUST record the final ACCEPT or REJECT decision and known
limitations after a harness PASS.

**Version**: 2.0.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-01
