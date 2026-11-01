# Harness Rules (feedforward) - Part 1A

Attach this file to the coding agent together with the Spec Kit artifacts
(`.specify/memory/constitution.md`, `specs/<feature>/spec.md`, `plan.md`, `tasks.md`, `contracts/`).
It plays the same role as `harness-rules.md` in Lab Sheet 2.

1. The approved Spec Kit artifacts are the single source of truth. Do not change them.
2. Generate or change files only under `src/`.
3. Never create, edit, rename or delete anything in `tests/`, `specs/`, `.harness/`,
   `.specify/memory/constitution.md`, `eslint.config.js` or `eslint.security.config.js`.
4. Never add suppression comments: `eslint-disable`, `c8 ignore`, `istanbul ignore`, `nosec`, `NOSONAR`.
5. Use CommonJS and Node.js built-in modules only. No runtime dependencies in `package.json`.
6. Follow the contract in `specs/<feature>/contracts/`: `main(argv, deps)` returns the exit code,
   and the clock, id generator and storage path are injected through `deps`.
7. Use exactly the exit codes and error messages defined in the specification.
8. Do not hard-code secrets, API keys or machine-specific paths. Do not read or print `.env`.
9. Generated code is untrusted until all six harness gates pass:
   integrity, static, secrets, lint, security, tests.
10. A repair must address only the reported findings and must not remove valid behaviour.
11. The automated loop allows at most TWO repair attempts after the initial generation.
12. If a test or spec looks wrong, STOP and report it. Do not change it. The human updates the
    upstream Spec Kit artifact, documents the change and re-locks the baseline.

## Gate reference

| Gate | What it checks | Typical finding codes |
|---|---|---|
| integrity | protected files equal the locked baseline | PROTECTED_FILE_CHANGED / ADDED / REMOVED |
| static | suppressions, weak tests, AC-ID in every test title, every spec AC has a test, no runtime deps | SUPPRESSION_COMMENT, WEAK_*_ASSERTION, TEST_WITHOUT_AC_ID, AC_WITHOUT_TEST |
| secrets | keys/tokens in files, tracked `.env` | GOOGLE_API_KEY, HARDCODED_CREDENTIAL, ENV_FILE_TRACKED |
| lint | ESLint rules from `eslint.config.js` | rule id such as `no-var`, `eqeqeq` |
| security | eslint-plugin-security rules | `security/detect-...` |
| tests | `node --test` + line coverage threshold (c8) | TEST_FAILED, COVERAGE_BELOW_THRESHOLD |
