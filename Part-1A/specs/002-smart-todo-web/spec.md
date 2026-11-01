# Feature Specification: Smart Todo Web

**Feature Branch**: `002-smart-todo-web`  
**Created**: 2026-11-01  
**Status**: Draft  
**Input**: Add a polished browser interface to Smart Todo, backed by an
Express REST API and the existing local JSON file; keep the CLI working.

## User Stories

### Story 1 - Manage tasks in the browser (P1)
As a person managing daily work, I can add, view, edit, complete, reopen, and
delete tasks in a responsive interface so that I can manage my task list
without using terminal commands.

### Story 2 - Find and organize work (P2)
As a person with many tasks, I can filter by tags and sort by priority so that
I can find and prioritize relevant work.

### Story 3 - Share one local task collection (P1)
As a person who uses both the UI and CLI, I want both interfaces to operate on
the same JSON file so changes remain visible across commands and browser
requests.

## Functional Requirements

- **FR-025**: The product MUST provide a React browser client built with Vite
  and a Node.js CommonJS Express 5 REST API. The existing CLI MUST remain
  supported.
- **FR-026**: The API MUST use the existing task service, validation, and JSON
  storage behavior and share the CLI's configured task file.
- **FR-027**: `GET /api/health` MUST return HTTP 200 and
  `{"status":"ok"}` without reading task storage.
- **FR-028**: `GET /api/tasks` MUST return the task array in creation order by
  default; repeated `tag` query parameters use normalized exact-tag AND
  matching, and `sort=priority` applies the existing deterministic priority
  order after filtering.
- **FR-029**: `POST /api/tasks` MUST accept title, optional description,
  priority, and tags, then return the created task with HTTP 201.
- **FR-030**: `GET /api/tasks/:id` MUST return the matching task or a JSON
  task-not-found error with HTTP 404.
- **FR-031**: `PATCH /api/tasks/:id` MUST update only supplied title,
  description, priority, and tags fields and return the updated task.
  `description: ""` removes the optional property; `tags: []` clears tags.
- **FR-032**: `PATCH /api/tasks/:id/status` MUST apply only the status-command
  transitions specified by the CLI feature.
- **FR-033**: `POST /api/tasks/:id/reopen` MUST allow only `done -> todo`.
- **FR-034**: `DELETE /api/tasks/:id` MUST remove the task and return
  `{"deleted":true,"id":"<id>"}`.
- **FR-035**: Every API response MUST be JSON. Invalid request data MUST
  return HTTP 400, an absent task HTTP 404, storage failures HTTP 500, and an
  unknown API route HTTP 404, each with a JSON `error` field. Error responses
  MUST NOT contain stack traces or machine paths.
- **FR-036**: The browser MUST provide task list, create, edit, status,
  reopen, delete, tag-filter, and priority-sort interactions using the REST
  API. It MUST show loading, empty, and request-error states.
- **FR-037**: The browser MUST use accessible labels and semantic buttons,
  render user content as text, and remain usable at desktop and mobile
  viewport widths.
- **FR-038**: The server MUST accept a configurable `TODO_FILE` path and port,
  defaulting to `./todo.json` and `3001`, and serve the Vite production build
  when present.

## Acceptance Criteria

- **AC-053**: **Given** a running API, **When** a client requests
  `GET /api/health`, **Then** the response status is exactly `200`, the content
  type is JSON, and the body is exactly `{"status":"ok"}`.
- **AC-054**: **Given** tasks T1 through T5 from the CLI spec in the shared
  file, **When** a client requests
  `GET /api/tasks?tag=work&tag=home&sort=priority`, **Then** the response
  status is `200` and the JSON body is exactly `[T5,T3]` in that order.
- **AC-055**: **Given** a missing task file and deterministic ID/clock
  dependencies, **When** a client posts
  `{"title":"  Read book  ","tags":["Work","work"]}` to `/api/tasks`,
  **Then** the response is `201` with a task whose title is `Read book`,
  tags are `["work"]`, priority is `medium`, status is `todo`, and timestamp
  is exactly the injected clock's ISO string.
- **AC-056**: **Given** a running API, **When** a client posts
  `{"title":" ","priority":"urgent"}` to `/api/tasks`, **Then** the response
  status is exactly `400`, the body is exactly
  `{"error":"title must be between 1 and 100 characters"}`, and storage is
  unchanged.
- **AC-057**: **Given** no task with ID `missing`, **When** a client requests
  `GET /api/tasks/missing`, **Then** the status is exactly `404` and the body
  is exactly `{"error":"task not found: missing"}`.
- **AC-058**: **Given** T1 exists, **When** a client patches
  `/api/tasks/task-001` with
  `{"title":"New","description":"note","priority":"high","tags":["Work","home"]}`,
  **Then** the status is `200` and the response task's JSON field order and
  values exactly match the CLI feature contract for that updated task.
- **AC-059**: **Given** T1 has status `todo`, **When** a client patches
  `/api/tasks/task-001/status` with `{"status":"done"}`, **Then** the status is
  exactly `400`, the body is exactly
  `{"error":"invalid status transition: todo -> done"}`, and T1 is unchanged.
- **AC-060**: **Given** T1 has status `done`, **When** a client posts to
  `/api/tasks/task-001/reopen`, **Then** the status is exactly `200` and the
  returned task status is `todo`.
- **AC-061**: **Given** T1 exists, **When** a client deletes
  `/api/tasks/task-001`, **Then** the status is `200`, the response is exactly
  `{"deleted":true,"id":"task-001"}`, and the stored array is empty.
- **AC-062**: **Given** a running API, **When** a client requests an unknown
  API path, **Then** the status is exactly `404` and the JSON body is exactly
  `{"error":"not found"}`.
- **AC-063**: **Given** the UI receives a task list containing T1, **When**
  the task page renders, **Then** the visible document contains `Read book`,
  the tag `work`, and accessible controls named `Add task` and `Filter by tag`.
- **AC-064**: **Given** the UI is loaded and the API accepts a create request,
  **When** a user submits a task titled `Buy milk`, **Then** the UI sends one
  POST to `/api/tasks` with the title and renders the returned task.
- **AC-065**: **Given** the UI displays a task in status `todo`, **When** the
  user activates its `Start task` control, **Then** the UI sends
  `PATCH /api/tasks/:id/status` with `{"status":"in_progress"}` and renders the
  returned status.
- **AC-066**: **Given** the API request fails with HTTP 500, **When** the UI
  loads its task list, **Then** it displays the exact accessible message
  `Could not load tasks. Please try again.` and does not display a success
  state.
- **AC-067**: **Given** the API creates a task, **When** the CLI lists tasks
  using the same `TODO_FILE`, **Then** its JSON array includes that exact task.
- **AC-068**: **Given** the shared task file contains malformed JSON, **When**
  a client requests `GET /api/tasks`, **Then** the status is `500`, the body is
  exactly `{"error":"storage error"}`, and the file remains byte-for-byte
  unchanged.
- **AC-069**: **Given** the UI renders task data containing
  `<img src=x onerror=alert(1)>`, **When** the task appears, **Then** the text
  is displayed literally and no image element is created from that value.
- **AC-070**: **Given** an existing task with description and tags, **When**
  the UI updates its description to empty and tags to `[]`, **Then** the API
  request omits the description property from the returned task and returns
  an empty tags array.
- **AC-071**: **Given** a working directory `C:\todo`, **When** server
  configuration loads with no environment overrides, **Then** it returns port
  `3001`, storage path `C:\todo\todo.json`, and static path `C:\todo\dist`; an
  injected port of `4010` is honored and port `0` is rejected with
  `PORT must be an integer between 1 and 65535`.
- **AC-072**: **Given** the production clock factory, **When** its clock
  function is invoked, **Then** it returns a `Date` instance for injection by
  the server composition root.
- **AC-073**: **Given** a task displayed in the UI, **When** the user edits its
  title, priority, and tags and saves, **Then** the UI sends those exact fields
  in a `PATCH /api/tasks/:id` request and renders the returned task.
- **AC-074**: **Given** a task in `in_progress`, **When** the user selects
  `Mark done`, **Then** the UI sends
  `PATCH /api/tasks/:id/status` with `{"status":"done"}` and renders the
  returned status.
- **AC-075**: **Given** a task in `done`, **When** the user selects
  `Reopen task`, **Then** the UI sends `POST /api/tasks/:id/reopen` and renders
  the returned `todo` status.
- **AC-076**: **Given** a task displayed in the UI, **When** the user selects
  its delete control, **Then** the UI sends `DELETE /api/tasks/:id` and
  removes the task from the visible list after success.
- **AC-077**: **Given** a task list view, **When** the user enters
  `work, home` in `Filter by tag`, **Then** the UI requests
  `/api/tasks?tag=work&tag=home`.
- **AC-078**: **Given** a task list view, **When** the user selects `Priority`
  sorting, **Then** the UI requests `/api/tasks?sort=priority`.
- **AC-079**: **Given** the API returns an empty task array, **When** the UI
  finishes loading, **Then** it displays the exact empty-state heading
  `A clear page is a good place to start.`.
- **AC-080**: **Given** a status update request fails with HTTP 500, **When**
  the user selects `Start task`, **Then** the UI displays the exact accessible
  message `Could not update task.` and keeps the original task visible.
- **AC-081**: **Given** a production build contains `dist/index.html`,
  **When** a browser requests `/` from the production server, **Then** the
  server returns HTTP `200` and the exact built HTML content.
- **AC-082**: **Given** task T1 exists, **When** a client requests
  `GET /api/tasks/task-001`, **Then** the status is exactly `200` and the
  response body is exactly T1 with the CLI contract's field order.
- **AC-083**: **Given** a running API, **When** a client sends `{` as the
  JSON body of `POST /api/tasks`, **Then** the status is exactly `400` and the
  response is exactly `{"error":"invalid JSON body"}`.
- **AC-084**: **Given** task T1 exists, **When** a client sends an empty
  object to `PATCH /api/tasks/task-001`, **Then** the status is exactly `400`,
  the body is exactly `{"error":"no update fields provided"}`, and storage is
  byte-for-byte unchanged.
- **AC-085**: **Given** a running API, **When** a client requests
  `GET /api/tasks?sort=date`, **Then** the status is exactly `400` and the
  response is exactly `{"error":"invalid sort: date"}`.
- **AC-086**: **Given** a task in `in_progress`, **When** the user selects
  `Move to to-do`, **Then** the UI sends
  `PATCH /api/tasks/:id/status` with `{"status":"todo"}` and renders the
  returned status.

## Assumptions

- The web feature is additive: the Smart Todo CLI remains supported.
- The REST API listens on port 3001 by default and uses `TODO_FILE` for the
  exact same JSON file the CLI uses.
- Browser development uses Vite with `/api` proxied to the local Express
  server; production serves built static assets from the Node server.
- API status codes map CLI validation/transition failures to 400, missing
  tasks to 404, and storage failures to 500.
- The web client is a local single-user application; authentication and
  network deployment are out of scope.

## Change History

- **2026-11-01**: Created additive web feature after the user selected
  React/Vite, an Express REST API, shared local JSON-file persistence, and
  continued CLI support.
- **2026-11-01**: Added explicit acceptance checks for UI operations,
  configuration, production static serving, malformed JSON, empty updates,
  invalid list sorting, and all allowed status transitions to make the API
  and frontend contracts testable.
