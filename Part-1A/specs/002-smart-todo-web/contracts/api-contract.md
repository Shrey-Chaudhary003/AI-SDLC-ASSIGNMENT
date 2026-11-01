# Smart Todo Web API Contract

All endpoints are rooted at `/api`. Request and response bodies use JSON.
Unknown API paths return `404 {"error":"not found"}`. Malformed JSON returns
`400 {"error":"invalid JSON body"}`. Error objects contain only the `error`
string and never expose stack traces or machine-specific details.

| Method and path | Request | Success |
|---|---|---|
| `GET /api/health` | None | `200 {"status":"ok"}` |
| `GET /api/tasks` | Repeatable `tag`; optional `sort=priority` | `200` task array |
| `POST /api/tasks` | `{title, description?, priority?, tags?}` | `201` created task |
| `GET /api/tasks/:id` | None | `200` task |
| `PATCH /api/tasks/:id` | Any nonempty subset of `{title, description, priority, tags}` | `200` updated task |
| `PATCH /api/tasks/:id/status` | `{"status":"todo|in_progress|done"}` | `200` updated task |
| `POST /api/tasks/:id/reopen` | None | `200` reopened task |
| `DELETE /api/tasks/:id` | None | `200 {"deleted":true,"id":"..."}` |

Validation and status-transition errors return `400 {"error":"<exact CLI
message>"}`. Missing tasks return `404 {"error":"task not found: <id>"}`.
Storage errors return `500 {"error":"storage error"}`. An empty PATCH body
returns `400 {"error":"no update fields provided"}`. A non-object body,
unsupported property, or property with the wrong JSON type returns
`400 {"error":"invalid request body"}`. Bodies larger than 32 KiB return
`413 {"error":"request body too large"}`.
`GET /api/tasks?sort=<value>` accepts only `sort=priority`; any other value
returns `400 {"error":"invalid sort: <value>"}`. A PATCH with no fields
returns `400 {"error":"no update fields provided"}` without writing storage.

Task field normalization, defaults, valid persisted shape, tag matching,
status transitions, and priority ordering are exactly those in
[`../../001-smart-todo-cli/contracts/cli-contract.md`](../../001-smart-todo-cli/contracts/cli-contract.md).
Task response property order is `id`, `title`, optional `description`,
`priority`, `tags`, `status`, `createdAt`.

The API app factory accepts injected `{storagePath, clock, idFactory}`. The
server composition root reads `TODO_FILE` (default `./todo.json`), `PORT`
(default `3001`), constructs the real clock and ID factory, and serves the
Vite `dist/` output when it exists.
