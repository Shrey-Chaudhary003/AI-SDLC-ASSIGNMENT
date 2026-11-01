<!--
Sync Impact Report
Version change: unratified scaffold -> 1.0.0
Modified principles: template placeholders -> Dependencies, Modular Architecture,
  Deterministic Time, Secure Configuration and State, HTTP and Test Contracts
Added sections: Architecture and Runtime Constraints; Development and Quality Gates
Removed sections: none
Follow-up TODOs: none
-->

# Tiered Rate Limiter Microservice Constitution

## Core Principles

### I. Runtime Dependencies
The only runtime dependency MUST be Express 5. Development dependencies MUST be
limited to ESLint and eslint-plugin-security. All other capabilities MUST use
Node.js built-ins. The application MUST use CommonJS modules.

### II. Modular Architecture
The token-bucket algorithm, in-memory storage adapter, configuration loader, and
HTTP middleware MUST be separate modules with clear responsibilities. This
separation keeps rate-limit behavior independently testable and replaceable.

### III. Deterministic Time
All time-dependent behavior MUST obtain time from an injectable clock object
with the interface `{ now(): number }`, returning milliseconds. Calls to
`Date.now()`, `new Date()`, and `performance.now()` MUST appear only in
`src/clock.js`; other modules MUST use the injected clock.

### IV. Secure Configuration and State
The service MUST NOT hard-code secrets or API keys. Tier and API-key
configuration MUST be loaded from a JSON configuration file. Per-key rate-limit
state MUST be stored in a `Map`; user-supplied keys MUST never be used to index
plain objects. Real secrets MUST NOT be committed.

### V. HTTP and Test Contracts
Every HTTP response MUST be JSON. Rate-limited responses MUST use status 429
and include a `Retry-After` header. Tests MUST use `node:test` and
`node:assert/strict`, live in `tests/`, and be named `*.test.js`. Assertions
MUST check exact expected outcomes; rate-limit tests MUST use exact status
assertions such as `assert.strictEqual(res.status, 429)`. Broad status checks
such as `status >= 400` are forbidden.

## Architecture and Runtime Constraints

Every function authored in application and test code MUST be at most 30 lines.
The coding agent MUST NOT weaken acceptance criteria; delete or modify files in
`tests/`, `.harness/`, or `specs/`; disable or edit lint/security rules; commit
secrets; or run the harness.

## Development and Quality Gates

ESLint MUST report zero errors and zero warnings. eslint-plugin-security MUST
report zero findings. All acceptance-criteria tests MUST pass (100%). Changes
MUST preserve these contracts and be validated with focused checks that do not
run the harness.

## Governance

This constitution governs implementation, tests, and review. Work MUST be
checked against every applicable principle and quality gate. Amendments MUST
update this document and its version/date metadata. Use semantic versioning:
MAJOR for incompatible governance changes, MINOR for new principles or
materially expanded requirements, and PATCH for clarifications and
non-semantic edits. Reviewers MUST reject changes that violate this
constitution. Ratification establishes the baseline; subsequent amendments
MUST record the actual amendment date.

**Version**: 1.0.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-01
