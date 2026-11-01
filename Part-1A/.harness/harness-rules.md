# Harness Rules (feedforward) - Part 1A

Attach this file to the coding agent together with the Spec Kit artifacts
(`.specify/memory/constitution.md`, `specs/<feature>/spec.md`, `plan.md`, `tasks.md`, `contracts/`).
It plays the same role as `harness-rules.md` in Lab Sheet 2.

1. The approved Spec Kit artifacts are the single source of truth. Do not change them.
2. Generate or change application files only under `src/` and `web/`, plus
   `index.html`, `vite.config.js` and explicitly authorized dependency manifests.
3. Never create, edit, rename or delete anything in `tests/`, `specs/`, `.harness/`,
   `.specify/memory/constitution.md`, `eslint.config.js` or `eslint.security.config.js`
   unless the user explicitly authorizes that planning or harness change.
4. Never add suppression comments: `eslint-disable`, `c8 ignore`, `istanbul ignore`, `nosec`, `NOSONAR`.
5. Use CommonJS for Node.js modules; browser modules may use Vite-supported ES modules.
   Runtime dependencies must match the approved constitution and feature plan.
6. Follow each contract in `specs/<feature>/contracts/`. The CLI `main(argv, deps)`
   returns its exit code. API service dependencies (clock, ID generator, storage path)
   are injected; only composition roots create real dependencies.
7. Use exactly the exit codes and error messages defined in the specification.
8. Do not hard-code secrets, API keys or machine-specific paths. Do not read or print `.env`.
9. Generated code is untrusted until all harness gates pass:
   integrity, static, secrets, lint, security, build and tests.
10. A repair must address only the reported findings and must not remove valid behaviour.
11. The automated loop allows at most TWO repair attempts after the initial generation.
12. If a test or spec looks wrong, STOP and report it. Do not change it. The human updates the
    upstream Spec Kit artifact, documents the change and re-locks the baseline.

## Gate reference

| Gate | What it checks | Typical finding codes |
|---|---|---|
| integrity | protected files equal the locked baseline | PROTECTED_FILE_CHANGED / ADDED / REMOVED |
| static | suppressions, weak tests, AC-ID traceability, approved runtime deps | SUPPRESSION_COMMENT, WEAK_*_ASSERTION, TEST_WITHOUT_AC_ID, AC_WITHOUT_TEST |
| secrets | keys/tokens in files, tracked `.env` | GOOGLE_API_KEY, HARDCODED_CREDENTIAL, ENV_FILE_TRACKED |
| lint | ESLint rules from `eslint.config.js` | rule id such as `no-var`, `eqeqeq` |
| security | eslint-plugin-security rules | `security/detect-...` |
| build | Vite production build | BUILD_FAILED |
| tests | `node --test` + Vitest/RTL + line coverage threshold | TEST_FAILED, COVERAGE_BELOW_THRESHOLD |
