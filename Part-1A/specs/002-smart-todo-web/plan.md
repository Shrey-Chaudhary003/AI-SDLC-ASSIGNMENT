# Implementation Plan: Smart Todo Web

**Feature**: `002-smart-todo-web` | **Spec**: [spec.md](./spec.md)

## Summary

Add a responsive React/Vite client and Express 5 API while retaining the
existing Smart Todo CLI. The API calls shared task service and storage
modules, so both interfaces operate on the same JSON file and preserve all
existing CLI semantics.

## Architecture

- `src/api.js`: Express app factory, JSON parsing, API routes, and error mapping.
- `src/server.js`: single server composition root for config, clock, UUID
  factory, and production static serving.
- `src/config.js` and `src/clock.js`: environment configuration and the sole
  production clock constructor.
- `src/service.js`, `src/storage.js`, and `src/validation.js`: shared CLI/API
  task behavior and persistence.
- `web/main.jsx`, `web/App.jsx`, `web/styles.css`: Vite React entry, task
  dashboard/interactions, and responsive styling.
- `index.html`, `vite.config.js`: Vite entry and local API proxy.
- `tests/api.test.js`: node:test black-box REST and shared-storage tests.
- `tests/web.test.jsx`: Vitest and React Testing Library UI tests.

## Data Model

The canonical storage is the CLI's UTF-8 JSON array, not a second database.
Each task has `id`, trimmed `title` (1-100 Unicode code points), `priority`
(`low`, `medium`, `high`), normalized unique `tags`, `status` (`todo`,
`in_progress`, `done`), and canonical ISO `createdAt`; `description` is
optional and is omitted when cleared. IDs are unique within the collection.
All create-time IDs and timestamps come from injected `idFactory` and clock
dependencies.

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check independent of task storage |
| GET / POST | `/api/tasks` | List/filter/sort and create tasks |
| GET / PATCH / DELETE | `/api/tasks/:id` | Read, partially update, and remove one task |
| PATCH | `/api/tasks/:id/status` | Apply an allowed status transition |
| POST | `/api/tasks/:id/reopen` | Reopen a completed task |

Request/response shapes and exact status/error mapping are normative in
[`contracts/api-contract.md`](./contracts/api-contract.md).

## Browser Components

`App` and its `useBoard` state hook coordinate API loading and mutations.
`Header` and `Welcome` provide product context; `Workspace` composes
`SectionHeading`, `TaskFilters`, `TaskList`, and `TaskForm`. Each `TaskCard`
contains status, priority, tags, and task actions. React text interpolation
keeps task content escaped. The layout uses responsive CSS grid breakpoints
for tablet and mobile viewports.

## Key Decisions

1. Keep the synchronous task service/storage and CLI contract unchanged.
2. Inject storage path, clock, and ID factory into the Express app factory;
   only `server.js` constructs real dependencies.
3. Map CLI validation/transition, not-found, and storage error codes to HTTP
   400, 404, and 500 respectively. Every route responds with JSON.
4. Use Vite proxying in development and serve `dist/` from Express in
   production. The browser uses fetch and React's escaped text rendering.
5. Use node:test for API tests and Vitest/RTL for browser components.

## Error Handling

The API maps shared validation/transition errors to 400, missing tasks to
404, storage failures to a sanitized 500, malformed JSON to 400, oversized
bodies to 413, and unknown API routes to JSON 404. Unexpected server errors
are logged without exposing stack traces or storage paths. The UI displays
separate load, mutation, and empty states and never treats failed requests as
successful data.

## Dependencies

Runtime: Express 5, React, React DOM. Development: Vite, Vitest, React Testing
Library, jsdom, eslint-plugin-react, existing ESLint/security/c8 tooling, and
required Vite React plugin/coverage adapter. No additional persistence service
is introduced.

## Validation

Run the locked CLI and API node:test suites, Vitest/RTL UI tests, source and
test ESLint, source security ESLint, Vite production build, and the approved
harness. Preserve the existing CLI test contract and all 52 CLI acceptance
criteria.

## Local Development

Run `npm start` for the API on port 3001 and `npm run dev` for Vite in separate
terminals. Set `TODO_FILE` before starting the API to use a task file other
than `./todo.json`; set `PORT` to change the API port. Run `npm run build` and
then `npm start` to serve the production browser build. Use `npm run test:all`
to run both backend and browser suites.
