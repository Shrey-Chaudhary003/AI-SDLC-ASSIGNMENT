# Implementation Plan: Reminder Agent

**Branch**: `001-reminder-agent` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-reminder-agent/spec.md`

## Summary

Build a CommonJS `parseReminder(text, nowIso, timezone)` module that calls Gemini with an on-disk system prompt and injected reference time, and returns only the validated seven-field object. Add a loopback-only HTTP API and static browser page as a delivery wrapper. No runtime npm packages are introduced. The API validates inputs, computes observable checks and metadata, and maps invalid model output separately from provider/service failures.

The evaluation harness calls `src/agent.js` directly. Its dataset and hard/semantic gates remain untouched. Unit tests use fake fetch implementations and make no real model API calls.

## Technical Context

**Language/Version**: Node.js 20 or newer, CommonJS.

**Primary Dependencies**: Node.js built-in modules only (`node:fs`, `node:path`, `node:http`, `node:test`, `node:assert`, `node:crypto` as needed); runtime global `fetch`, `AbortSignal.timeout`, `Intl`.

**Storage**: No application database or durable reminder storage. `.env` is optional local configuration, not committed. Session request history exists only in browser memory. Evaluation evidence remains owned by the existing harness.

**Testing**: `node:test` through the existing `npm test` script. Fake fetch responses cover the Gemini client and module behavior; local HTTP tests exercise the backend without external model calls. No test makes a real model API request.

**Target Platform**: Node.js 20+ on a local machine; backend binds only to `127.0.0.1`.

**Project Type**: CommonJS module, CLI demo, local HTTP API, static browser frontend.

**Performance Goals**: No end-user latency SLO is specified. Each provider request uses the specified 45-second timeout. The Gemini retry path makes at most three total attempts for HTTP 429/503, with increasing backoff.

**Constraints**:
- Preserve the exact seven-field Output Schema Contract and deterministic hard gates.
- Read relative-time context only from `nowIso` and `timezone`; only the HTTP server and browser UI may obtain a default current time.
- Model temperature is `0.1` and appears in the public, secret-free `config`.
- Gemini is the only provider. `config.provider` and API metadata report `gemini`; there is no provider-selection variable, secondary client, or alternate-provider credential.
- `GEMINI_API_KEY`, `LLM_MODEL`, or the system prompt being unavailable is an explicit configuration failure.
- Provider 429/503 are retried up to three total requests with growing delays (1 second, then 2 seconds); other 4xx responses are not retried. Other 5xx, exhausted retries, timeout, and network failures are `SERVICE_ERROR`.
- Parsed JSON that fails schema/invariant validation is never changed or returned; it raises `INVALID_MODEL_OUTPUT`. The API returns HTTP 502 for this and `INVALID_MODEL_JSON`; raw error evidence is sanitized before any response and never rendered in the frontend.
- The only permitted package-manifest edit is adding the `npm start` script, explicitly authorized by the user. No dependencies or other manifest fields may change.

**Scale/Scope**: Single-process local tool; stateless reminder parsing; no reminder persistence, authentication, deployment, or public network binding.

## Constitution Check

*Gate: checked before research and again after design.*

| Gate | Result | Plan evidence |
|---|---|---|
| Specification and contract authority (BP-001–BP-003) | PASS | Implementation and tests trace to IDs in `spec.md` and `contracts/agent-contract.md`; unresolved behavior is recorded upstream before implementation. |
| Exact model JSON and hard gates (SI-001–SI-005, AC-001–AC-002) | PASS | Parse without repair; non-mutating structural/invariant validation; the evaluation threshold and formula remain unchanged. |
| File boundaries (GR-001–GR-004) | PASS with approved scope | Implementation under `src/` and `prompts/`; tests under `tests/` and only the `npm start` addition in `package.json` are explicitly authorized. Harness/evaluation/spec/constitution files remain protected from implementation changes. Plan artifacts and the requested contract are produced through the authorized specification workflow. |
| Time, temperature, and dependencies (SI-003, GR-005, FR-002) | PASS | Inject reference time/timezone; temperature 0.1; CommonJS, built-ins and global fetch only. |
| Secrets and service errors (GR-006, SI-004) | PASS | Environment/`.env` only; no key or request URL in logs; service errors are distinct from application failures. |
| Evidence and approval (BP-004–BP-005, AC-003–AC-004) | PASS | Preserve original model text in private error evidence; maximum two evidence-driven repair attempts; final human decision records residual risks. |

No constitution exception is required beyond the user-approved test path and single `npm start` script change recorded in the constitution.

## Design Decisions

1. `src/agent.js` owns the public module interface, prompt construction, model reply parsing, and non-mutating output validation. It delegates HTTP calls to the Gemini client and exports only `parseReminder` and a secret-free `config`.
2. `src/env.js` loads optional project-root `.env` values without overriding any existing `process.env` property. It skips blank/comment lines and reads only `LLM_MODEL` and `GEMINI_API_KEY`.
3. Keep Gemini transport isolated in `src/gemini-client.js`. Its `generateContent` JSON-mode response is passed as raw text to the shared parser and validator.
4. Use a single shared output schema and a deterministic validator. Validation reports failure rather than filling defaults, rewriting titles, normalizing fields, or otherwise repairing model output.
5. Delivery checks are a presentation of deterministic validation results; they do not mutate a valid result or substitute for evaluation Layers 1 and 2.
6. API error mapping follows the current spec and its Change History clarifications: 400 invalid request, 502 invalid model JSON/output or non-429 provider 4xx, and 503 service failure. API `raw` is redacted for prompt/internal-instruction or configured-secret content; the browser never displays raw model text.
7. Test transport by injecting fake fetch functions into the Gemini client (and a fake model boundary into server tests). Keep tests deterministic and credential-free; do not invoke the evaluation harness as part of unit tests.

## Project Structure

### Documentation and contract

```text
specs/001-reminder-agent/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
└── quickstart.md

contracts/
└── agent-contract.md
```

### Application and tests

```text
src/
├── agent.js
├── gemini-client.js
├── env.js
├── cli.js
├── server.js
└── public/
    └── index.html

prompts/
└── system-prompt.md

tests/
├── env.test.js
├── agent.test.js
├── gemini-client.test.js
└── server.test.js
```

`package.json` receives only the explicitly authorized `"start": "node src/server.js"` script. Its existing `test` script remains unchanged. Do not edit `.harness/`, `evals/`, `specs/`, or `.specify/memory/constitution.md` during implementation/evaluation.

**Structure Decision**: One Node.js project with a Gemini client behind a shared module, a small built-in HTTP server, one static HTML page, and built-in Node tests. No separate frontend/backend projects, dependencies, persistence layer, or general-purpose provider framework.

## Complexity Tracking

No constitution violations or additional architectural complexity are planned.
