# Research: Smart Todo CLI

## Decision: Synchronous built-in file operations

**Decision**: Implement the CLI and storage adapter synchronously using Node.js
built-ins.

**Rationale**: `main(argv, deps)` must synchronously return its integer exit
code. There is one local JSON file and no external service or runtime package.

**Alternatives considered**: Promise-based filesystem operations would require
an asynchronous `main` contract and are therefore incompatible. A database or
third-party persistence library violates the no-runtime-dependencies
requirement.

## Decision: Injected Date, UUID factory, path, and output sinks

**Decision**: Programmatic callers supply all environmental effects via
`deps`. Direct execution creates them in one composition-root function:
`TODO_FILE || './todo.json'`, `() => new Date()`,
`crypto.randomUUID`, `process.stdout`, and `process.stderr`.

**Rationale**: Fixed dependencies make tests deterministic and keep imported
`main` calls independent of process state. The explicit composition-root
exception is recorded in the constitution.

**Alternatives considered**: Reading environment variables, generating IDs, or
reading time inside service modules would make tests depend on ambient state
and violate the constitution.

## Decision: Ordered JSON array with fail-closed reads

**Decision**: Store tasks as one ordered JSON array. Treat only `ENOENT` as an
empty collection. Treat unreadable files, invalid JSON, and invalid stored
shape as `storage error`; do not write after a failed read or parse.

**Rationale**: The array naturally preserves creation order and supports
deterministic filtering and sorting without additional dependencies.

**Alternatives considered**: Replacing malformed data with an empty array
would silently destroy user data. A keyed object would not encode creation
order as directly.

## Decision: Explicit CLI grammar and output

**Decision**: Fix positional arguments, long options, repetitions, result
shapes, error text, and exit codes in `contracts/cli-contract.md`.

**Rationale**: The acceptance suite calls `main` directly; a normative,
implementation-independent contract prevents parser details from being
silently inferred during coding.

**Alternatives considered**: Relying on help text or a parser package is
unnecessary and conflicts with the minimal-dependency requirement.

## Decision: Unicode code-point title length

**Decision**: Trim title ends, preserve internal whitespace, and count Unicode
code points after trimming.

**Rationale**: This defines the requested character bound deterministically
without counting UTF-16 surrogate halves separately.

**Alternatives considered**: UTF-16 code-unit count can reject a title with
fewer than 100 user-perceived characters. Grapheme-cluster counting would
require more complex Unicode segmentation and is not specified by the feature.

## Decision: Filter before deterministic sort

**Decision**: Normalize all tag filters, require exact whole-tag matches for
every filter, then sort the matching tasks by priority rank, `createdAt`, and
ID using deterministic string ordering.

**Rationale**: Applying selection before ordering has predictable composition
and matches the accepted clarification.

**Alternatives considered**: Substring matching can include unrelated tags;
locale-sensitive sorting can differ across environments.

## Decision: Human-owned tests and existing quality harness

**Decision**: The human writes tests first, using `node:test` and
`node:assert/strict`; the existing harness remains responsible for ESLint,
security findings, and c8 coverage.

**Rationale**: This follows the explicit file boundary and quality gates
without changing harness rules or adding tools.

**Alternatives considered**: Generating tests or adding tooling would violate
the user-defined ownership and no-new-tooling requirements.

## Implementation prerequisite

The current `package.json` still declares Express. It conflicts with the
no-runtime-dependencies requirement and must be removed through an authorized
manifest change before the finished application can satisfy its dependency
gate. No manifest was changed during planning.
