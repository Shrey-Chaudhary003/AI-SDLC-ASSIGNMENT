<!--
Sync Impact Report
Version change: 3.2.0 -> 3.3.0
Modified principles: Principle V, allowing the real clock only in the
  composition root; Principle VII, allowing explicitly requested plan artifacts
  and specification alignment
Added sections: clarified composition-root exception and /speckit-plan artifact
  scope
Removed sections: none
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
Modules under `src/` MUST NOT call `Date`, `Math.random`, or `crypto` directly,
except that the single composition-root function MAY call `new Date()` to
construct the injected real clock. The clock, ID generator, storage path,
stdout, and stderr MUST be injected through a `deps` object. Exactly one
composition-root function MAY construct the real dependencies. All other
source modules MUST use only the injected clock and ID generator. The same
input and dependency state MUST produce the same output.

### VI. Built-In Runtime Dependencies
The application MUST use Node.js CommonJS and JSON-file persistence. It MUST
have no runtime dependencies; all runtime capabilities MUST use Node.js
built-in modules.

### VII. Coding-Agent Boundaries
A coding agent MUST make application implementation changes only under
`src/`. When explicitly invoked by the user, `/speckit-specify` MAY create or
update the single requested feature's `spec.md` under `specs/<feature>/` and
the required `.specify/feature.json` path metadata. When explicitly invoked by
the user, `/speckit-clarify` MAY update the active feature's `spec.md` by
recording answers in its `Clarifications` section and dated `Change History`.
When explicitly invoked by the user, `/speckit-plan` MAY create or update only
the active feature's `plan.md`, `research.md`, `data-model.md`, `quickstart.md`,
`contracts/cli-contract.md`, and `spec.md` entries in `Clarifications` and
`Change History` needed to align that specification with the approved plan and
contract. The `/speckit-plan` exception MAY also update the active feature's
`Functional Requirements`, `Acceptance Criteria`, `Assumptions`,
`Success Criteria`, `Clarifications`, and `Change History` sections as needed
to align the specification with the approved plan and contract. These
exceptions MUST NOT authorize changes to any other files under `specs/`. A
coding agent MUST NOT create, edit, rename, or delete files in `tests/`,
`.harness/`, `.specify/memory/constitution.md`, `eslint.config.js`, or
`eslint.security.config.js`, except an explicit user-requested constitution
amendment. It MUST NOT add suppression comments such as `eslint-disable`,
`c8 ignore`, or `nosec`, skip or weaken a test, or lower a quality threshold.

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

**Version**: 3.3.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-01
