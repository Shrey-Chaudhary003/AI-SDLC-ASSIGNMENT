# Reminder Agent Module Contract

This contract fixes the public module behavior and provider boundary. Requirement meanings, the seven-field schema, invariants, and evaluation remain governed by [the feature specification](../specs/001-reminder-agent/spec.md).

## 1. Public module API

`src/agent.js` uses CommonJS and exports:

```js
module.exports = { parseReminder, config };
```

- `parseReminder(text, nowIso, timezone) -> Promise<object>` accepts a string `text` (including empty text), an ISO-8601 reference timestamp with UTC offset, and an IANA timezone. If timezone is omitted, use `Asia/Kolkata`.
- A successful promise resolves to one plain object with exactly the seven fields specified by FR-001 and the Output Schema Contract. No metadata or additional fields are attached.
- `config` has exactly `{ provider, model, temperature }`; it contains no API key or other secret. `temperature` is `0.1`.
- Gemini is the only supported provider. `config.provider` is the constant `gemini`. Configuration is loaded once when the module initializes.

## 2. System prompt and time input

The complete system prompt lives at `prompts/system-prompt.md` and is read from disk by the application. A missing/unreadable prompt is a configuration failure, not a reason to use an embedded fallback.

Every model request receives the caller-supplied `nowIso` and `timezone` as explicit context. Relative dates are interpreted against those values in that timezone. `parseReminder` does not read the machine clock; the API may supply a default `nowIso` under AP-002.

## 3. Provider requests

### Gemini

Send:

```http
POST https://generativelanguage.googleapis.com/v1beta/models/<LLM_MODEL>:generateContent
Content-Type: application/json
x-goog-api-key: <GEMINI_API_KEY>
```

Use `generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }`. The body includes the system prompt and user request/time context according to Gemini's `generateContent` request shape. Use `AbortSignal.timeout(45_000)`. Retry HTTP 429 and 503 only, with at most three total request attempts and increasing delays of 1 second then 2 seconds. Do not retry other provider 4xx or other 5xx. Never log the request URL, request headers, key, or full request body.

## 4. Configuration and `.env`

Configuration may be read only from `process.env` and an optional project-root `.env` file:

| Variable | Use |
|---|---|
| `LLM_MODEL` | Required Gemini model name |
| `GEMINI_API_KEY` | Required Gemini API key |

The built-in-only loader skips empty lines and lines beginning with `#`; it never overwrites any variable already present in `process.env`. Missing required values throw an `Error` with `code === 'CONFIG_ERROR'`. The exported `config` contains no secrets. The API key and request URL are never printed or logged.

## 5. Error contract

Errors are `Error` instances with stable `code` values:

- Invalid JSON model text throws `code === 'INVALID_MODEL_JSON'` and sets `.raw` to the original model text.
- JSON that parses but fails the output schema or a deterministic specification invariant throws `code === 'INVALID_MODEL_OUTPUT'` and sets `.raw` to the original model text.
- HTTP 429/5xx, timeout, and network failures throw `code === 'SERVICE_ERROR'`; set `.status` when an HTTP status is known.
- Provider HTTP 4xx other than 429 throws `code === 'PROVIDER_ERROR'`; set `.status` when known, do not retry, and do not include the provider response body in a public error.
- Configuration failures throw `code === 'CONFIG_ERROR'`.

No invalid output is returned as a successful result. There is no silent repair, coercion, schema completion, or fabricated fallback. The API maps errors according to AP-003. The original `.raw` is private in-process evidence; before returning it in a 502 response, redact any system-prompt/internal-instruction content and configured secrets. The frontend never renders raw model text.

## 6. Non-mutating validation and test strategy

Before resolving successfully, validate the exact parsed object against the Output Schema Contract and deterministic applicable invariants: exact field set, required types/enums/lengths, valid offset-bearing real calendar datetime, future create/reschedule time, clarification consistency, required title/snooze values, five-year horizon, and prompt-leak guard. Validation must not change the object. On any failure, throw `INVALID_MODEL_OUTPUT` with the original model text. Semantic interpretation that cannot be checked deterministically remains subject to the model prompt and the evaluation harness's hard gates; no LLM judge replaces deterministic checks.

Unit tests use Node's built-in `node:test` and injected fake fetch implementations. They make no real provider requests. Cover successful provider response parsing, exact request options, timeout signal, 429/503 retries and increasing delays, retry exhaustion, non-retryable 4xx and other 5xx, network/timeout failures, invalid JSON, parsed schema/invariant violations, missing configuration, and validation non-mutation. API tests use fake model responses and verify HTTP status/body mapping, limits, and prompt/secret redaction.
