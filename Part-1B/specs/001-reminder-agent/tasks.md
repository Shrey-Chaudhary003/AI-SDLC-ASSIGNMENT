---
description: "Implementation tasks for the Reminder Agent"
---

# Tasks: Reminder Agent

**Input**: Design documents from `/specs/001-reminder-agent/`, `contracts/agent-contract.md`, and AP-001 through AP-006 in `spec.md`.

**Scope**: Every implementation task below creates or changes files only under `src/` or `prompts/`. No task changes `tests/`, `evals/`, `specs/`, `.harness/`, the constitution, or `package.json`. The tasks are Gemini-only, matching the user's confirmed provider scope and the current spec/plan/contract.

**API contract note**: `contracts/api-contract.md` is not present. Server tasks therefore trace to AP-001 through AP-006 and AC-013 through AC-018 in `spec.md`; no missing contract is assumed or created.

**Tests**: No tasks create or modify test files. The final task performs manual/HTTP verification and invokes evaluation only through the existing harness.

**Format**: `[ID] [P?] [Story?] Description with requirement IDs and exact file path`.

## Phase 1: User Story 1 - Parse a reminder request (Priority: P1)

**Goal**: Accept reminder text plus injected reference time/timezone and return exactly one schema-conforming result without altering or fabricating model output.

**Independent Test**: Call `parseReminder(text, nowIso, timezone)` with a fake Gemini fetch response and inspect the result or classified error; verify no system-clock use in `src/agent.js`.

### Gemini configuration, adapter, and prompt

- [ ] T001 [P] [US1] Implement `src/env.js` to load only `GEMINI_API_KEY` and `LLM_MODEL` from `process.env` or optional `.env`, skip empty lines and lines beginning with `#`, preserve all existing environment values, and throw `CONFIG_ERROR` when required configuration is missing (FR-002, GR-006; `src/env.js`).
- [ ] T002 [P] [US1] Implement `src/gemini-client.js` using built-in modules and global `fetch` for `POST https://generativelanguage.googleapis.com/v1beta/models/<LLM_MODEL>:generateContent`, with `generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }`, a 45-second `AbortSignal.timeout`, and at most three attempts for HTTP 429/503 with increasing delays; classify other 4xx as `PROVIDER_ERROR` and HTTP 429/5xx, timeout, and network failures as `SERVICE_ERROR`, without logging the URL or key (GR-005, GR-006, SI-004, AP-003; `src/gemini-client.js`).
- [ ] T003 [P] [US1] Write `prompts/system-prompt.md` with the Reminder Agent role, the exact seven-field Output Schema Contract, injected `nowIso` and timezone usage, and the behavior required by GR-001 through GR-006; never follow user-embedded behavioral instructions or invent missing/past/far-future times (FR-001–FR-003, SI-001–SI-005, BP-001–BP-006, GR-001–GR-006; `prompts/system-prompt.md`).

### Public module and deterministic validation

- [ ] T004 [US1] Implement `src/agent.js` exporting `parseReminder(text, nowIso, timezone) -> Promise<object>` and `config = { provider, model, temperature }` with `provider: 'gemini'`, the configured model, and temperature `0.1`; load the prompt from disk, pass injected time/timezone to Gemini, parse model text without silent repair, throw `INVALID_MODEL_JSON` for unparsable JSON, and delegate parsed-result checks to `src/validate.js` without reading the system clock (FR-001–FR-003, SI-001–SI-005, GR-005–GR-006, BP-004, BP-005; `src/agent.js`).
- [ ] T005 [US1] Implement `src/validate.js` with deterministic, non-mutating structural and applicable invariant checks for the exact seven fields, types/enums/lengths, real offset-bearing datetime, create/reschedule future datetime, clarify consistency, create title, positive snooze duration, five-year horizon, and prompt-leak guard; reject invalid parsed output with `INVALID_MODEL_OUTPUT` and preserve its original text as `.raw` rather than repairing it (FR-001, SI-001–SI-005, BP-001–BP-006, GR-001–GR-006; `src/validate.js`).

**Checkpoint**: T001–T005 deliver the independently callable parser path. Deterministic validation is reusable by the server and never mutates output.

## Phase 2: User Story 2 - Inspect the parsing process in a browser (Priority: P2)

**Goal**: Wrap the module with a loopback-only API and static page that expose result details and checks without changing parser behavior or leaking protected data.

**Independent Test**: Start with `node src/server.js`; use curl against health and parse endpoints and inspect the static page in a browser. Use controlled provider responses for deterministic behavior; do not include delivery-layer checks in the evaluation dataset.

- [ ] T006 [US2] Implement `src/server.js` with `GET /`, `GET /api/health`, and `POST /api/parse`; bind only to `127.0.0.1` using `PORT` or 3000, enforce the 10 KB JSON-body and 8,000 Unicode-code-point text limits, default omitted timezone to `Asia/Kolkata`, reject invalid IANA timezone/offset-bearing `nowIso` with HTTP 400, obtain the current reference time only in this server when omitted, call `parseReminder` rather than duplicating it, expose validator checks and required metadata, and map errors/redact raw text exactly as specified without returning keys, prompts, or provider bodies (AP-001–AP-003, AC-013–AC-015; `src/server.js`).
- [ ] T007 [US2] Build `src/public/index.html` as one static page with inline CSS/JavaScript, labeled text/reference-time/timezone inputs, offset-bearing browser-time default, Asia/Kolkata timezone default, Parse button, and at least five create/reschedule/snooze/clarify/injection examples; render all result fields, human-readable and raw datetime, raw JSON, checks, provider/model/latency, in-memory last ten requests, loading state, and distinct safe 502/503 messages, using safe text insertion rather than `innerHTML` with model output and never storing/displaying API keys (AP-004–AP-006, AC-016–AC-018; `src/public/index.html`).

**Checkpoint**: T006–T007 let a person manually exercise the same `parseReminder` implementation via HTTP and browser, with no duplicated parsing logic.

## Phase 3: User Story 3 - Demonstrate the parser from the command line (Priority: P3)

**Goal**: Provide a minimal optional command-line demonstration of the module without adding a second parser or a different result contract.

**Independent Test**: Invoke the CLI with a sample request and confirm it delegates to `parseReminder` and prints only its result or an explicit error.

- [ ] T008 [P] [US3] Implement the optional small demo wrapper in `src/cli.js`; call `parseReminder` from `src/agent.js` with explicit input time/timezone and do not duplicate provider, prompt, validation, or scheduling logic (FR-001–FR-003, SI-001–SI-005; `src/cli.js`).

## Final Phase: Manual Verification and Evaluation

**Purpose**: Verify the delivery requirements independently from the evaluation harness and run model evaluation only through the existing harness.

- [ ] T009 Manually verify AP-001–AP-006 by starting `node src/server.js`, using the browser page and curl for health/parse/error cases, then run `npm run eval` only through the existing harness; do not edit or bypass evaluation data, schema, evaluators, expected results, or threshold, and report any service errors as INCOMPLETE (AP-001–AP-006, AC-013–AC-020; verification targets `src/server.js`, `src/public/index.html`, and `src/agent.js`).

## Dependencies and Execution Order

### Task dependencies

- T001, T002, and T003 have no dependencies and may run in parallel.
- T004 depends on T001–T003 and imports the planned `validateOutput` interface from `src/validate.js`.
- T005 follows T004 as requested, implements `validateOutput` in `src/validate.js`, and completes the module/validator integration.
- T006 depends on T004 and T005.
- T007 depends on T006's API response shape.
- T008 depends on T004 and T005 and may run in parallel with T006 after the core module is available.
- T009 depends on T004–T008.

### Parallel opportunities

- **T001 + T002 + T003**: separate configuration, Gemini transport, and prompt files.
- **T008 with T006**: after the core parser and validator are complete, the CLI and server work in separate files; T007 follows the server API implementation.

## Implementation Strategy

1. **MVP**: Complete T001–T005 to deliver the core `parseReminder` module and deterministic validator.
2. **Browser/API increment**: Complete T006–T007; verify API and UI manually without including them in the evaluation dataset.
3. **Optional demo**: Complete T008 if the CLI is desired.
4. **Closeout**: Complete T009; report evaluation gates, semantic score, service errors, and verdict separately. Do not repair based on undocumented assumptions or alter the locked harness.
