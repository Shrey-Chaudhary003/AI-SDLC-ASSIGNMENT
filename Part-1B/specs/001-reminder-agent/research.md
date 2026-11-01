# Research: Reminder Agent

## Decision: call Gemini directly with global fetch

The contract requires Gemini only, Node.js built-ins, and global `fetch`, so SDKs and alternate providers are excluded. The Gemini client uses the prescribed `models/<LLM_MODEL>:generateContent` endpoint and JSON response configuration. Its response text goes to one parser and validator.

**Rationale**: Avoids runtime dependencies, keeps the evaluation path deterministic and injectable, and ensures the model reply is checked against one application-level contract.

**Alternatives considered**: Provider SDKs and alternate providers were rejected because the approved project scope requires Gemini and forbids npm packages.

**References**:
- Google Gemini `generateContent` API: https://ai.google.dev/api/generate-content
- Google Gemini structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- Google Gemini API key guidance: https://ai.google.dev/gemini-api/docs/api-key

The user-prescribed Gemini endpoint, `temperature: 0.1`, JSON response MIME type, 45-second timeout, and 429/503 retry policy take precedence over general provider recommendations.

## Decision: keep configuration and prompt loading local

Read `LLM_MODEL` and `GEMINI_API_KEY` from existing process environment values or optional project-root `.env`. Never override a variable already present in `process.env`; do not log the key or request URL. Read `prompts/system-prompt.md` from disk and provide both the injected reference timestamp and timezone in each model request.

**Rationale**: Matches the environment-only secret policy and makes relative-time behavior independent of machine clock state in the core parser.

**Alternatives considered**: Adding a dotenv package or a prompt embedded in source was rejected by the built-in-only and disk-prompt constraints.

## Decision: validate, do not repair

Parse model text exactly once as JSON, enforce the output schema and deterministic specification invariants, and return the same object only if all applicable gates pass. Invalid JSON raises `INVALID_MODEL_JSON`; parsed but invalid output raises `INVALID_MODEL_OUTPUT`; no coercion, field completion, or fabricated reminder is permitted. Preserve original raw text in private error evidence. Before an API error response, redact prompt/internal-instruction content and configured secrets from `raw`.

**Rationale**: Maintains the 100-percent deterministic hard gates, protects prompt/secrets, and makes invalid model behavior observable without disguising it as a valid result.

## Decision: separate provider, service, and application failures

Retry only HTTP 429/503, up to three total attempts with 1-second then 2-second waits. Do not retry other provider 4xx; report `PROVIDER_ERROR`. Other 5xx, exhausted 429/503 attempts, timeouts, and network failures are `SERVICE_ERROR`. Map errors through the API contract, and do not count service errors as application failures in evaluation.

**Rationale**: Keeps retries bounded and predictable, avoids retrying malformed/configuration requests, and preserves the spec's INCOMPLETE verdict for service errors.

## Decision: built-in deterministic tests

Use `node:test` and fake fetch implementations. Unit and local HTTP tests must not use real credentials or contact providers. Verify request shape, schema and invariant failures, retry policy and delay growth, error mapping, input limits, and safe frontend rendering. Keep API/frontend manual and HTTP-level checks out of the model evaluation dataset.

**Rationale**: Tests are repeatable and safe to run offline while verifying the API wrapper separately from `parseReminder`.

## Repository findings

- The project is CommonJS and already has `npm test` configured as `node --test`.
- Existing `.harness/check-api.js` demonstrates the Gemini `generateContent` JSON request pattern, but no `demo1.js` was found in the Part-1B workspace.
- The existing harness and `evals/` are protected and are not changed by this plan.
