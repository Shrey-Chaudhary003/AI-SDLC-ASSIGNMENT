# Data Model: Reminder Agent

The application is stateless: it does not persist reminders or provider responses as application records. This document describes the request/result values and error/check records crossing module and API boundaries.

## ParseRequest

| Field | Type | Constraints |
|---|---|---|
| `text` | string | May be empty at the module boundary; API accepts at most 8,000 Unicode code points and at most 10 KB total JSON body. Non-English and mixed-language input is accepted. |
| `nowIso` | string | ISO-8601 timestamp with UTC offset, including `Z`; supplied by caller or server. Must represent a valid calendar date-time. |
| `timezone` | string | IANA timezone; defaults to `Asia/Kolkata` at the module/API boundary when omitted. |

## ReminderResult

The sole successful result is the exact seven-field object in [agent-contract.md](../../contracts/agent-contract.md) and the Output Schema Contract in [spec.md](./spec.md). It is neither decorated with metadata nor mutated by validation.

`intent` determines the required behavior:

- `create`: non-empty task title and future datetime.
- `reschedule`: identifies the existing reminder by the title in the request and provides a future datetime; missing/ambiguous identity is clarified.
- `snooze`: positive integer `snooze_minutes` exactly representing the requested duration.
- `clarify`: `needs_clarification: true`, one non-empty question, and `datetime: null`.
- `reject`: no scheduled datetime.

## RuntimeConfig

| Field | Type | Secret? | Source |
|---|---|---|---|
| `provider` | Constant `gemini` | No | Fixed supported provider |
| `model` | string | No | `LLM_MODEL` |
| `temperature` | number (`0.1`) | No | Fixed configuration |
| Gemini API key | string | **Yes** | `GEMINI_API_KEY`; never included in exported config or logs |

## ValidationCheck

Delivery-layer checks are records `{id, name, pass}`. They describe deterministic validation of the returned object against structural and applicable invariant checks; they never modify the object. Core checks include exact field set/types/enums, real offset-bearing datetime, create/reschedule future time, clarify consistency, non-empty create title, positive snooze duration, five-year horizon, and prompt-leak guard.

## ParseMetadata

The API response metadata is `{provider, model, latencyMs, nowIso, timezone}`. It contains no secret. `latencyMs` measures one full parse call including retries and backoff.

## Errors

| Code | Meaning | API status |
|---|---|---|
| `CONFIG_ERROR` | Required provider/config/key/prompt unavailable or unsupported provider | 500 safe error |
| `INVALID_MODEL_JSON` | Model text cannot be parsed as JSON | 502 with `{code,message,raw}`; raw is redacted for prompt/internal instructions or configured secrets |
| `INVALID_MODEL_OUTPUT` | Parsed JSON violates schema or deterministic invariant | 502 with `{code,message,raw}`; same redaction rule |
| `PROVIDER_ERROR` | Provider returned non-retriable 4xx other than 429 | 502 with safe `{code,message}` only; provider body omitted |
| `SERVICE_ERROR` | HTTP 429/5xx, timeout, or network failure | 503 with `{code,message}`; `.status` included on the thrown error when known |
| `INVALID_REQUEST` | Malformed request, invalid timestamp/timezone, body over 10 KB, or text over 8,000 code points | 400 safe error |

Original raw model text remains on the in-memory error for private evidence handling. API responses redact protected content, and the frontend does not display raw model text.
