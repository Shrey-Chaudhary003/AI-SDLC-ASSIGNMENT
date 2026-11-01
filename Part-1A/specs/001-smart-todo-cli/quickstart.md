# Quickstart: Smart Todo CLI Validation

## Prerequisites

- Node.js 20 or newer.
- The human-authored `tests/*.test.js` suite, written from `spec.md` and
  [the CLI contract](./contracts/cli-contract.md) before implementation.
- Existing project harness for ESLint, eslint-plugin-security, c8, and
  acceptance validation. Do not install or add tooling.

## Deterministic API validation

The human-authored tests import only `main` from `src/cli.js` and call it with:

- `argv`: the array after the Node executable and script name.
- `deps.storagePath`: a unique temporary JSON path for each test.
- `deps.clock`: a function returning a fixed `Date`.
- `deps.idFactory`: a deterministic sequence of unique IDs.
- `deps.stdout` and `deps.stderr`: sinks that capture exact text.

Run the unit tests with:

```text
node --test
```

For each command, assert the exact integer return, full captured output
including the trailing newline, and expected persisted JSON. Tests must cover
the scenarios listed in `spec.md`, including every disallowed status
transition and storage failures.

## End-to-end scenarios

After implementation and human-authored tests exist:

1. Set `TODO_FILE` to a temporary path and invoke
   `node src/cli.js add --title "Buy milk" --priority high --tag home`.
   Expect exit `0`, one compact task JSON document on stdout, and a one-task
   JSON array in the file.
2. Invoke `node src/cli.js list --tag HOME --sort priority`.
   Expect the matching task in a JSON array; tag normalization is
   case-insensitive and exact.
3. Invoke `node src/cli.js get <id>`, then `status <id> in_progress`,
   `status <id> done`, and `reopen <id>`.
   Expect a single task JSON document from each successful operation.
4. Invoke `node src/cli.js status <id> todo` while the task is `done`.
   Expect exit `1`, no stdout, and the exact error line from the contract.
5. Replace the storage contents with invalid JSON and invoke `list`.
   Expect exit `2`, no stdout, `error: storage error` on stderr, and unchanged
   file contents.

## Quality validation

Run the repository's existing harness as the human operator. Confirm exactly
zero ESLint errors and warnings, zero eslint-plugin-security findings, at least
90% line coverage of `src/`, and all acceptance tests passing. Preserve the
first generated implementation before any repair; permit at most two repairs,
each driven only by harness findings. After a harness PASS, record the human
ACCEPT or REJECT and known limitations.

No tests or harness commands were run while producing this plan.
