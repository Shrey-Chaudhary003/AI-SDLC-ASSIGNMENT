# Quickstart and Validation: Reminder Agent

## Prerequisites

- Node.js 20 or newer.
- A Gemini account/key for manual model-backed runs. Unit tests do not require credentials or network access.
- Set `LLM_MODEL` and `GEMINI_API_KEY` in the process environment or local `.env`. Gemini is the only supported provider. The loader does not overwrite existing process environment variables.

Do not commit `.env` or paste provider keys into the browser.

## Offline unit tests

```powershell
npm test
```

All unit and local HTTP tests inject fake fetch/provider responses. They must not call a real model API. Tests cover valid/invalid model replies, schema and invariant failures, time anchoring, timezone and input validation, retry attempts/backoff, service/provider error classification, API mappings, and safe DOM rendering.

## Local API and frontend

```powershell
node src/server.js
```

The server binds to `127.0.0.1` on `PORT` or `3000`.

1. Open `http://127.0.0.1:3000/`.
2. Confirm the reference time includes its UTC offset and timezone defaults to `Asia/Kolkata`.
3. Try the create, reschedule, snooze, clarification, and injection examples.
4. Confirm fields, human-readable and raw datetime, raw result JSON, checks, provider/model/latency, and the in-memory last-ten history.
5. Confirm errors display safely: 502 distinguishes invalid model JSON/output from provider rejection; 503 reports a service error. Raw model text is never rendered in the frontend.

The following HTTP checks use the configured backend. For deterministic endpoint tests, inject fake provider responses rather than invoking a real model:

- `GET /` serves the static page.
- `GET /api/health` returns provider/model metadata without credentials.
- `POST /api/parse` with a valid body returns result, metadata, and deterministic checks.
- Malformed/oversized JSON, text longer than 8,000 Unicode code points, invalid timezone, and invalid `nowIso` return HTTP 400.
- Invalid model JSON and schema/invariant-invalid model JSON return HTTP 502; provider HTTP 4xx other than 429 returns a safe HTTP 502 without provider body.
- Exhausted 429/503 retries, other 5xx, timeout, and network failures return HTTP 503.

## Evaluation

The evaluator calls `parseReminder(text, nowIso, timezone)` directly; delivery/API checks are not part of its dataset. Run the existing evaluation only as a separate, explicitly authorized evaluation step with the approved dataset and unchanged threshold. Report Layer 1, Layer 2, Layer 3, and service errors separately. Any service error yields INCOMPLETE, not PASS.

## Failure cases to verify

| Injected condition | Expected outcome |
|---|---|
| Malformed model text | `INVALID_MODEL_JSON`; original raw text attached to error |
| JSON object with missing/extra fields, wrong types, invalid enum, invalid real date, past schedule, or horizon violation | `INVALID_MODEL_OUTPUT`; no output repair or fabrication |
| HTTP 429 then success; HTTP 503 then success | Retry with increasing delay, no more than three total attempts |
| HTTP 429/503 after all attempts | `SERVICE_ERROR`, service failure, no application-failure count |
| HTTP 500/502/other 5xx, timeout, or rejected fetch | `SERVICE_ERROR`; no success-shaped fallback |
| Provider HTTP 401/403/other non-429 4xx | `PROVIDER_ERROR`, no retry, API 502 with safe message only |
| Missing API key, model, provider, or unreadable prompt | `CONFIG_ERROR`; never expose configuration secrets |
| Raw output echoes system prompt or configured key | Preserve original only privately; redact protected material from API `raw`; do not render raw in UI |
| Fake HTML in any result field | Render as text, not executable markup |
| Empty/ambiguous/past/too-far-future request | Clarify/reject according to `spec.md`; never fabricate or roll time forward |
