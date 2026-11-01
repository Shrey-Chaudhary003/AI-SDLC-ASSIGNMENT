<!--
Sync Impact Report
Version change: 3.5.0 -> 4.0.0
Modified principles: architecture, dependency policy, deterministic dependency
  injection, test strategy, implementation boundaries
Added sections: React/Vite web client and Express REST API governance
Removed sections: CLI-only application scope
Follow-up TODOs: none
-->

# Smart Todo Constitution

## Core Principles

### I. Specification Authority
For each feature, `specs/<feature>/spec.md`, `plan.md`, `tasks.md`, and
`contracts/` are the source of truth. Every functional requirement MUST have a
unique `FR-001`, `FR-002`, ... ID and every acceptance criterion a unique
`AC-001`, `AC-002`, ... ID in Given/When/Then form with decidable pass/fail
behavior. Ambiguities MUST be resolved in the upstream artifact and recorded
with a date in its Change History; implementation MUST NOT silently resolve
them. The CLI feature remains independently supported as specified in
`specs/001-smart-todo-cli/`.

### II. Architecture and Dependencies
The product consists of a React/Vite browser client, a Node.js 20+ CommonJS
Express 5 REST API, and the existing CommonJS CLI. The API and CLI share task
validation, service logic, and one local JSON-file storage format. Runtime
dependencies are limited to Express, React, and React DOM. Development
dependencies may include ESLint, eslint-plugin-security, eslint-plugin-react,
Vite, Vitest, React Testing Library, jsdom, and coverage tools. Do not add dependencies without
updating the feature plan and manifest.

### III. Deterministic and Safe Boundaries
All task timestamps and IDs are injected into service/API operations. Only the
CLI and server composition roots may construct real clocks, ID factories, or
read process configuration. Storage uses Node.js built-ins and validates
records before mutation. User-controlled keys MUST NOT be used as keys on
ordinary objects; use `Map` or validated fixed field names. API responses MUST
be JSON, and API errors MUST NOT expose stack traces or filesystem details.
The browser MUST render task text as text, not executable markup.

### IV. Quality and Security
ESLint MUST report zero errors and warnings on application and test JavaScript,
with function complexity at most 12. eslint-plugin-security MUST report zero
findings on server/source JavaScript. No secrets, machine-specific paths,
suppression comments, disabled rules, or weakened acceptance tests are
permitted. Source functions MUST be at most 30 lines.

### V. Tests and Evidence
The CLI and backend API MUST be tested with `node:test` and
`node:assert/strict`. The React UI MUST be tested with Vitest and React Testing
Library. Test titles MUST begin with the AC-ID they verify. Assertions on
observable values MUST be exact. Line coverage of application source MUST be
at least 90 percent. Every acceptance criterion MUST have a deterministic test;
API and service tests inject fixed clocks, IDs, and temporary storage. A
human-readable harness PASS MUST be followed by human ACCEPT or REJECT and
known limitations.

### VI. Implementation Boundaries
After the user has approved the feature specification and tasks, a coding agent
MAY change `src/`, `web/`, `index.html`, `vite.config.js`, `package.json`,
`package-lock.json`, `tests/`, and approved ESLint configuration needed for
the React client. It MUST NOT change `.harness/` after a baseline is locked,
except when the user explicitly authorizes a harness update and the new
baseline is locked before implementation. Spec Kit artifacts may be edited
only in an explicitly requested planning/specification task. Never change
acceptance criteria to make implementation pass.

### VII. Repair Limits
Preserve the initial implementation before any repair. At most two repair
attempts may follow, each driven by recorded harness findings and limited to
those findings. Preserve evidence from each attempt.

## Data and Persistence

The canonical task collection is a UTF-8 JSON array in one local file. The
server and CLI MUST use the same path configuration and storage adapter. A
missing file means an empty collection; malformed or unreadable data MUST
produce an explicit error and MUST NOT be overwritten.

## Governance

This constitution governs feature specifications, plans, contracts,
implementation, validation, and review. Amendments MUST update the version and
amendment date. Use semantic versioning: MAJOR for incompatible principle
changes, MINOR for new principles or materially expanded requirements, PATCH
for clarifications and non-semantic edits.

**Version**: 4.0.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-01
