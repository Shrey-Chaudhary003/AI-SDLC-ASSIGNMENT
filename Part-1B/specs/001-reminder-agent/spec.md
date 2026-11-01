# Feature Specification: Reminder Agent

**Feature Branch**: `001-reminder-agent`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: Build a Node.js module that turns a free-text reminder request into one structured JSON object using the Gemini API, with a small backend API and browser frontend for trying the agent and seeing each step.

## User Scenarios & Testing

### User Story 1 - Parse a reminder request (Priority: P1)

A person provides a natural-language request and a reference time and timezone. The Reminder Agent returns one schema-conforming JSON object that represents the requested reminder or asks for clarification when required information is absent or ambiguous.

**Why this priority**: Correct interpretation and a predictable output contract are the core product value.

**Independent Test**: Call `parseReminder(text, nowIso, timezone)` directly and verify the returned object against the Output Schema Contract and deterministic invariants.

**Acceptance Scenarios**:

1. **Given** a request with a task and an unambiguous future date/time, **When** it is parsed against the supplied reference time and timezone, **Then** the result describes the requested reminder with the correct intent, title, and datetime.
2. **Given** a request missing required information or containing an ambiguous time, **When** it is parsed, **Then** the result asks one clarification question and does not invent a datetime.
3. **Given** an unsafe, injected, or non-reminder request, **When** it is parsed, **Then** the result is rejected or clarified without exposing internal instructions or scheduling a reminder.

### User Story 2 - Inspect the parsing process in a browser (Priority: P2)

A person opens the local browser frontend, edits the request and reference-time inputs, submits the request, and inspects the result, validation checks, provider metadata, and recent requests.

**Why this priority**: A visible interface makes the agent usable and allows a person to understand its output and validation.

**Independent Test**: Start the backend with `node src/server.js`, exercise the frontend and HTTP endpoints manually, and verify the rendered result and error states. Delivery-layer checks are not part of the evaluation dataset.

**Acceptance Scenarios**:

1. **Given** the backend is running, **When** a person opens `/`, **Then** the page provides request, reference-time, and timezone inputs, example requests, and a Parse action.
2. **Given** a parse request succeeds, **When** its result is displayed, **Then** the person can inspect the intent, all output fields, raw JSON, checks, provider, model, latency, and recent requests.
3. **Given** the backend returns a service or invalid-model-JSON error, **When** the response is displayed, **Then** the page shows a clear error message rather than a blank result.

### User Story 3 - Use Gemini without changing the contract (Priority: P3)

The application uses Gemini while the caller receives the same seven-field output contract.

**Why this priority**: A stable Gemini integration preserves predictable behavior for the module, API, and evaluation harness.

**Independent Test**: Configure Gemini with a model and API key, call the module directly using a fake fetch in tests, and verify output shape and classified service errors without exposing credentials or making real API calls.

**Acceptance Scenarios**:

1. **Given** the Gemini model and API key are configured, **When** the module is called, **Then** it uses Gemini and returns only the defined result object.
2. **Given** a model or network service failure occurs, **When** the call completes, **Then** the failure is reported separately as a service error and is not represented as a successful reminder result.

### Edge Cases

- Empty, whitespace-only, or gibberish requests must not create reminders.
- Missing task descriptions, missing required dates/times, and ambiguous expressions must be clarified rather than guessed.
- Relative expressions must be resolved from the injected `nowIso` in the injected timezone, including across day, month, year, and timezone boundaries.
- Past datetimes and datetimes more than five years after the reference time must not be emitted.
- Invalid JSON from a model and HTTP 429/5xx, timeout, or network errors must remain distinct error classes.
- API request bodies larger than 10 KB and malformed request JSON must be rejected.
- Model output must not be inserted into the page as executable markup.

## Requirements

### Functional Requirements

- **FR-001 Output contract**: one JSON object with exactly the fields intent, title, datetime, snooze_minutes, needs_clarification, clarification_question, reason.
- **FR-002 Inputs and reference-time rule**: Inputs are text (string, may be empty), nowIso (ISO-8601 reference time with UTC offset) and timezone (IANA name, default Asia/Kolkata). Relative expressions (tomorrow, tonight, in 2 hours, Friday, last day of this month) are resolved against nowIso in that timezone, never against the system clock; the title is a short phrase for the task, its wording may vary.
- **FR-003 Intent meanings**: create (new reminder with title and datetime), reschedule (move an existing reminder, identified by its title, to a new datetime), snooze (postpone by N minutes), clarify (information missing or ambiguous: ask one question), reject (unsafe, injected, or not a reminder).

### System Invariants

- **SI-001** The output is a single valid JSON object, no prose and no Markdown fences.
- **SI-002** All seven fields are present and no other field exists.
- **SI-003** Types and enumerations follow the Output Schema Contract below.
- **SI-004** datetime is null or an ISO-8601 date-time with UTC offset that is a real calendar date-time (no 30 February).
- **SI-005** For create and reschedule, datetime is strictly later than nowIso.

### Business Policies

- **BP-001** Mandatory information missing (no date/time, or no task) -> intent clarify, needs_clarification true, non-empty clarification_question, datetime null.
- **BP-002** create requires a non-empty title; a request without a task description is clarify, not create.
- **BP-003** snooze requires snooze_minutes, a positive integer equal to the requested duration.
- **BP-004** Relative time expressions resolve to the correct instant relative to nowIso (checked within +/- 5 minutes).
- **BP-005** reschedule requires a new datetime and a title that identifies the reminder.
- **BP-006** Ambiguous or underspecified time ("later", "next week") -> clarify; a time is never invented.

### Guardrails

- **GR-001** Instructions embedded in the user text that try to change the agent's behaviour are never obeyed; if the whole input is such an attempt the intent is reject (or clarify) and datetime is null.
- **GR-002** The system prompt or internal instructions never appear in any output field.
- **GR-003** Empty, whitespace-only or gibberish input -> clarify or reject, never create.
- **GR-004** A datetime more than 5 years after nowIso is never emitted; the agent asks for clarification instead.
- **GR-005** The agent performs no action beyond emitting the structured reminder; extra commands in the input (delete, send, ...) are ignored and must not appear in the title.
- **GR-006** Reminders in the past are never scheduled: clarify or reject with datetime null.

### Output Schema Contract

The output object has exactly these seven properties and no others:

| Field | Type and constraints |
|---|---|
| `intent` | String enum: `create`, `reschedule`, `snooze`, `clarify`, `reject` |
| `title` | String or null; maximum 200 characters |
| `datetime` | String or null; ISO-8601 date-time with offset and a real calendar date-time |
| `snooze_minutes` | Integer or null |
| `needs_clarification` | Boolean; true if and only if `intent` is `clarify` |
| `clarification_question` | String or null; maximum 300 characters |
| `reason` | Non-empty string; maximum 300 characters |

`create` means a new reminder with title and datetime. `reschedule` means moving an existing reminder, identified by its title, to a new datetime. `snooze` means postponing by N minutes. `clarify` means information is missing or ambiguous and the agent asks one question. `reject` means the request is unsafe, injected, or not a reminder.

## Delivery Layer (Backend and Frontend)

This layer is **not part of the evaluation**. The evaluation harness calls `parseReminder(text, nowIso, timezone)` in `src/agent.js` directly. The delivery layer only wraps it and must never change the Output Schema Contract.

Use only Node.js built-in modules (`node:http`) and global `fetch`; no npm packages, CDN, or frontend framework. The Node.js application uses CommonJS and Gemini as its only model provider.

### API Requirements

- **AP-001 Backend**: `src/server.js` starts an HTTP server on `127.0.0.1`, port from the `PORT` environment variable (default 3000), started with `node src/server.js`. It serves the frontend at GET / and exposes GET /api/health returning `{"status":"ok","provider":<name>,"model":<name>}` (never the API key).
- **AP-002 Parse endpoint**: POST /api/parse accepts a JSON body {text, nowIso?, timezone?}. If nowIso is omitted the SERVER supplies the current time with its UTC offset (this is the only place the system clock is read; parseReminder itself never reads the clock). The response is `{"result": <the seven-field object>, "meta": {"provider","model","latencyMs","nowIso","timezone"}, "checks": [{"id","name","pass"}]}` where checks reports the structural and invariant checks (for example SI-002 fields present, SI-004 real date, SI-005 future datetime, GR-004 horizon) computed on the result.
- **AP-003 Error mapping**: invalid request body or body larger than 10 KB -> HTTP 400; model reply that is not valid JSON (code INVALID_MODEL_JSON), or parsed model JSON that fails schema/invariant validation (code INVALID_MODEL_OUTPUT) -> HTTP 502 with `{"error":{"code","message","raw"}}`; provider HTTP 4xx other than 429 (code PROVIDER_ERROR) -> HTTP 502 with `{"error":{"code","message"}}` and no provider response body; service errors (code SERVICE_ERROR: 429, 5xx, timeout, network) -> HTTP 503 with `{"error":{"code","message"}}`. API error `raw` is redacted if it contains system-prompt/internal-instruction content or a configured secret; the original is retained only in private error evidence. Responses never contain the API key or the system prompt.
- **AP-004 Frontend**: one static page `src/public/index.html` (inline CSS and JavaScript) with fields for text, reference time (default: now in the browser, shown with its UTC offset) and timezone (default Asia/Kolkata), a "Parse" button, and example buttons for at least five sample requests (create, reschedule, snooze, clarify, an injection attempt).
- **AP-005 Frontend result view**: shows the intent as a coloured badge, the title, the datetime in a human-readable form AND the raw ISO string, snooze_minutes, the clarification question when present, the reason, and the full raw JSON in a separate panel. It shows the checks list from AP-002 as pass/fail badges, the provider, model and latency, and the last 10 requests of the session (in memory only). Loading, service-error (503) and invalid-JSON (502) states are shown as clear messages, not as a blank page.
- **AP-006 Frontend safety**: The frontend never stores or displays the API key, and escapes all model output before inserting it into the page (no innerHTML with model text).

### Acceptance Criteria for Business Policies, Guardrails, and Delivery

- **AC-001 (BP-001)**: **Given** a request with a missing mandatory task or date/time, **When** the request is parsed, **Then** the result has `intent: "clarify"`, `needs_clarification: true`, a non-empty `clarification_question`, and `datetime: null`.
- **AC-002 (BP-002)**: **Given** a create request with no task description, **When** it is parsed, **Then** it is clarified and no create result with an empty title is emitted.
- **AC-003 (BP-003)**: **Given** a snooze request specifying a duration, **When** it is parsed, **Then** `snooze_minutes` is a positive integer equal to that requested duration.
- **AC-004 (BP-004)**: **Given** a relative time request and fixed `nowIso` and timezone, **When** its result is checked against ground truth, **Then** the resolved instant is within +/- 5 minutes of ground truth.
- **AC-005 (BP-005)**: **Given** a request to reschedule an existing reminder, **When** it is parsed, **Then** the result identifies the reminder by title and supplies the requested new datetime.
- **AC-006 (BP-006)**: **Given** a request with an ambiguous or underspecified time such as "later" or "next week", **When** it is parsed, **Then** it asks for clarification and does not invent a time.
- **AC-007 (GR-001)**: **Given** user text containing instructions to change agent behavior, **When** it is parsed, **Then** those instructions are not obeyed and an input that consists solely of such an attempt is rejected or clarified with `datetime: null`.
- **AC-008 (GR-002)**: **Given** any user request, **When** the result is inspected, **Then** no system prompt or internal instruction appears in any output field.
- **AC-009 (GR-003)**: **Given** empty, whitespace-only, or gibberish input, **When** it is parsed, **Then** the result is clarify or reject and is never create.
- **AC-010 (GR-004)**: **Given** a requested datetime more than five years after `nowIso`, **When** it is parsed, **Then** no such datetime is emitted and the result asks for clarification.
- **AC-011 (GR-005)**: **Given** a reminder request with additional commands such as delete or send, **When** it is parsed, **Then** no extra action is performed and those commands do not appear in the title.
- **AC-012 (GR-006)**: **Given** a request whose reminder time is in the past, **When** it is parsed, **Then** the result is clarify or reject with `datetime: null`.
- **AC-013 (AP-001)**: **Given** a configured `PORT` or no `PORT`, **When** the operator runs `node src/server.js`, **Then** the server binds only to `127.0.0.1` on that port or port 3000 respectively, serves `GET /`, and returns the specified health JSON without an API key from `GET /api/health`.
- **AC-014 (AP-002)**: **Given** a valid parse body with or without `nowIso`, **When** `POST /api/parse` is called, **Then** the response contains the seven-field result, required metadata, and computed structural/invariant checks, and an omitted `nowIso` is supplied by the server rather than `parseReminder`.
- **AC-015 (AP-003)**: **Given** malformed/oversized input, invalid model JSON, parsed model JSON that fails schema/invariant validation, a provider HTTP 4xx response other than 429, or a service error, **When** the API handles the request, **Then** it returns the specified 400, 502, or 503 status and error shape respectively, without exposing the API key, system prompt, or provider response body.
- **AC-016 (AP-004)**: **Given** the frontend is served at `GET /`, **When** a person opens it, **Then** the static page provides the required text, reference-time, and timezone fields, default values, Parse button, and at least five specified example buttons.
- **AC-017 (AP-005)**: **Given** successful and failing parse responses, **When** the frontend renders them, **Then** it shows all specified result fields, raw JSON, checks, provider/model/latency, at most the last 10 session requests, and clear loading, 503, and 502 states.
- **AC-018 (AP-006)**: **Given** model output containing HTML or script-like text, **When** the frontend renders it, **Then** it is escaped as text and is never inserted with `innerHTML`; the API key is neither stored nor displayed.

## Evaluation

The evaluation harness calls `parseReminder(text, nowIso, timezone)` in `src/agent.js` directly. The delivery layer (AP-001 through AP-006) is **not part of the evaluation dataset** and is verified by manual and HTTP-level checks, not by the evaluation dataset.

### Evaluation Threshold (declared before any evaluation)

- Layer 1 (JSON Schema) and Layer 2 (invariants, behavioural properties, guardrails) are hard gates: 100 percent of evaluated cases must pass.
- Layer 3 per-case score in [0,1] = 0.5 * datetime_match (within +/- 5 minutes of ground truth) + 0.3 * title_similarity (token F1 on lower-cased words without stop-words) + 0.2 * intent_correct.
- Overall PASS requires Layer 1 = 100 percent, Layer 2 = 100 percent and mean Layer 3 score >= 0.85.
- Service errors (HTTP 429/5xx, timeouts) are excluded from failures and reported; if any occur the verdict is INCOMPLETE, never PASS.
- The threshold and formula are never lowered after the first evaluation.

### Evaluation Dataset and Traceability

The evaluation dataset contains at least 15 cases across at least 6 categories. Each case lists the requirement IDs it exercises, and every ID used by a case appears in this specification. Dataset coverage includes applicable categories such as create, relative date/time, reschedule, snooze, clarification/ambiguity, and rejection/guardrails. Dataset cases verify the Reminder Agent requirements; AP-001 through AP-006 are verified only by manual and HTTP-level checks.

- **AC-019 (dataset traceability)**: **Given** the evaluation dataset is prepared for evaluation, **When** its manifest and cases are checked, **Then** it contains at least 15 cases in at least 6 categories, every case lists its exercised requirement IDs, and every listed ID is defined in this specification.
- **AC-020 (evaluation gates)**: **Given** the declared evaluation formula and threshold, **When** a final evaluation is run, **Then** PASS requires Layer 1 and Layer 2 at 100 percent and mean Layer 3 at least 0.85, while any service errors produce INCOMPLETE and never PASS; the formula and threshold remain unchanged.

## Clarifications

These decisions resolve behavior and evaluation ambiguities. They do not change the FR, SI, BP, or GR requirements, the Output Schema Contract, or the declared Evaluation Threshold.

1. **Ambiguous time (BP-001, BP-006)**: Clarify open-ended phrases such as `later`, `soon`, `next week`, and standalone `evening`, as well as incomplete date/time requests such as a weekday without a time or a time without a date. Resolve only requests with enough information under the explicit daypart rules below; do not invent missing information.
2. **Daypart defaults (BP-001, BP-006)**: Interpret `tonight` and `this evening` as 8:00 PM in the supplied timezone, and `morning` as 9:00 AM in the supplied timezone. Standalone `evening` and a bare weekday such as `Friday` require clarification.
3. **Month-end and elapsed times (BP-001, BP-004, BP-006, GR-006)**: `Last day of this month` means the last local calendar day of the current month in the supplied timezone. Ask for clarification if no time is supplied or if the requested time has already passed. Never roll a past time forward to tomorrow or another date; clarify instead.
4. **Reschedule identity (BP-005)**: The agent is stateless and uses the reminder title stated in the request as its identifier; it does not look up or claim a match in a stored reminder list. If the title is missing, ambiguous, or cannot be identified, return `clarify` with `datetime: null` and ask for the exact reminder title.
5. **Snooze conversion (BP-003)**: Convert durations exactly to whole minutes: `10 min` is 10, `an hour` is 60, `half an hour` is 30, and `1.5 hours` is 90. If a duration does not convert to an exact whole number of minutes, ask for clarification rather than rounding.
6. **Mixed requests (GR-005)**: Process only the reminder clause when it is sufficiently specified; ignore extra commands and exclude them from the title. If the reminder clause is missing required information, clarify that clause instead of processing the extra command.
7. **Language support (FR-002)**: Accept non-English and mixed-language requests without translation or language-based rejection. The API text length limit is specified separately below.
8. **Gibberish and injection (GR-001, GR-003)**: Clarify gibberish input. Reject an input consisting solely of an injection attempt with `datetime: null`. If an injection is mixed with a valid reminder, ignore the injected instructions and process only the reminder request.
9. **Parse API input validation (AP-002, AP-003)**: Limit `text` to 8,000 Unicode code points, in addition to the 10 KB JSON request-body limit; exceeding either limit returns HTTP 400. If `timezone` is omitted, use `Asia/Kolkata`; an invalid IANA timezone or invalid offset-bearing ISO-8601 `nowIso` returns HTTP 400. When `nowIso` is omitted, the server supplies it as specified in AP-002.
10. **Frontend error display (AP-003, AP-005, AP-006)**: Show distinct, clear messages and safe error codes for HTTP 502 invalid model JSON and HTTP 503 service errors. Do not display raw model text in the frontend. The 502 API response still includes `raw` as required by AP-003; the frontend displays only the safe message/code.
11. **Parsed but invalid model output (SI-001, SI-003, AP-003)**: If model text parses as JSON but the object violates the output schema or a deterministic specification invariant, `parseReminder` throws an error with code `INVALID_MODEL_OUTPUT` and the original model text in `.raw`. The API returns HTTP 502 with `{"error":{"code":"INVALID_MODEL_OUTPUT","message":...,"raw":...}}`. The output is not repaired, altered, or fabricated.
12. **Raw error evidence and prompt leakage (GR-002, AP-003, AP-006)**: Preserve the original raw model text only in private error evidence. Before returning a 502 response, redact system-prompt/internal-instruction content and configured secrets from its `raw` field; never render raw model text in the frontend.
13. **Provider HTTP 4xx errors (AP-003)**: Do not retry provider HTTP 4xx responses other than 429. Throw `PROVIDER_ERROR` and return HTTP 502 with a safe error code/message only; do not include the provider response body or credentials.
14. **Gemini-only provider scope (AP-001, AP-002)**: Gemini is the only supported model provider. `config.provider` and API provider metadata report `gemini`; there is no provider-selection environment variable or alternate-provider client/credential.

## Key Entities

- **Parse request**: Free-text `text` plus a reference instant `nowIso` and IANA `timezone`.
- **Reminder result**: The single seven-field JSON object defined by the Output Schema Contract.
- **Evaluation case**: A dataset input with expected behavior/ground truth, category, and the requirement IDs exercised.
- **Parse metadata and checks**: Delivery-layer provider, model, latency, reference-time details, and deterministic structural/invariant check results.

## Assumptions

- Gemini is the only supported provider. `GEMINI_API_KEY` and `LLM_MODEL` configure its API call.
- Provider credentials are available to the backend through approved secret configuration; they are not sent to or exposed by the browser.
- The API is intended for local use and binds to loopback (`127.0.0.1`), not a public interface.
- `timezone` defaults to `Asia/Kolkata` when omitted; the reference instant is still supplied explicitly to the agent.
- Provider/model identifiers are available to the backend for health and parse metadata without exposing credentials.

## Change History

| Date | Version | Change |
|---|---|---|
| 2026-11-01 | 1.0.0 | Initial specification. Recorded the requested Reminder Agent requirements, schema, delivery layer, evaluation formula and threshold, dataset traceability, and acceptance criteria before evaluation. |
| 2026-11-01 | 1.0.1 | Recorded ten user-approved clarifications for time interpretation, rescheduling, snooze conversion, mixed and invalid inputs, API validation, and frontend error display. No FR/SI/BP/GR requirement, schema, or evaluation threshold was changed. |
| 2026-11-01 | 1.0.2 | Clarified that parsed model JSON failing schema or invariant validation throws `INVALID_MODEL_OUTPUT` with raw text and maps to HTTP 502; updated AP-003 and AC-015. No FR/SI/BP/GR requirement, schema, or evaluation threshold was changed. |
| 2026-11-01 | 1.0.3 | Clarified that raw model text is private evidence and prompt/internal-instruction content and configured secrets are redacted from 502 API responses; updated AP-003. No FR/SI/BP/GR requirement, schema, or evaluation threshold was changed. |
| 2026-11-01 | 1.0.4 | Clarified that provider HTTP 4xx errors other than 429 are not retried, throw `PROVIDER_ERROR`, and map to HTTP 502 without provider response content; updated AP-003. No FR/SI/BP/GR requirement, schema, or evaluation threshold was changed. |
| 2026-11-01 | 1.0.5 | By user direction, narrowed the provider scope to Gemini only and removed multi-provider support. The functional requirements, invariants, business policies, guardrails, schema, and evaluation threshold are unchanged. |
| 2026-11-01 | 1.0.6 | By user direction, changed the AP-001 server launch command from `npm start` to `node src/server.js` and aligned AC-013 and the User Story 2 independent test. No FR/SI/BP/GR requirement, schema, or evaluation threshold was changed. |
