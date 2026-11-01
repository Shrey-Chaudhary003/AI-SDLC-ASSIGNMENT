# Implementation Tasks: Smart Todo Web

- [X] **T001 - Build the Express JSON REST API**
  - Implement the injected app factory and API endpoints according to
    [api-contract.md](./contracts/api-contract.md); reuse existing service and
    storage logic.
  - **Satisfies**: FR-026-FR-035, FR-038.
  - **Verified by**: `tests/api.test.js` - AC-053-AC-062, AC-067-AC-068,
    AC-070-AC-072, AC-081-AC-085.
  - **Depends on**: existing CLI service/storage implementation.

- [X] **T002 - Build the responsive React task interface**
  - Implement task dashboard, create/edit/delete, status/reopen, tag filters,
    priority sort, and loading/empty/error states with accessible controls.
  - **Satisfies**: FR-025, FR-036-FR-037.
  - **Verified by**: `tests/web.test.jsx` - AC-063-AC-066, AC-069-AC-080,
    AC-086.
  - **Depends on**: T001.

- [X] **T003 - Wire Vite and production server**
  - Configure development API proxy, production build, environment-driven
    storage/port, and static build serving without changing CLI direct-run
    behavior.
  - **Satisfies**: FR-025-FR-026, FR-038.
  - **Verified by**: `tests/api.test.js` AC-071-AC-072, AC-081; Vite
    production build.
  - **Depends on**: T001, T002.

- [X] **T004 - Verify the integrated application**
  - Run existing CLI acceptance tests, API tests, UI tests, ESLint, security
    lint, coverage, and production build; preserve recorded harness evidence.
  - **Satisfies**: FR-025-FR-038.
  - **Verified by**: all acceptance tests AC-001-AC-086 and validation gates.
  - **Depends on**: T001-T003.
