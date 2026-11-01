# Harness Rules (feedforward) - Part 1B

Attach this file to the coding agent together with the Spec Kit artifacts
(`.specify/memory/constitution.md`, `specs/<feature>/spec.md`, `plan.md`, `tasks.md`, `contracts/`).
It plays the same role as `harness-rules.md` in Lab Sheet 2.

1. The approved Spec Kit artifacts are the single source of truth. Do not change them.
2. Generate or change files only under `src/` and `prompts/`.
3. Never create, edit, rename or delete anything in `evals/`, `specs/`, `.harness/` or
   `.specify/memory/constitution.md`. That includes the dataset, expected results, the schema,
   the evaluators and the threshold configuration.
4. The application must export `parseReminder(text, nowIso, timezone)` from `src/agent.js` and return
   a plain object with exactly these fields: `intent`, `title`, `datetime`, `snooze_minutes`,
   `needs_clarification`, `clarification_question`, `reason`.
5. `parseReminder` must also export `config = { provider, model, temperature }` (no secrets).
6. Resolve every relative time expression against the injected `nowIso` and `timezone`.
   Never call `new Date()` or `Date.now()` to decide what "tomorrow" means.
7. If the model reply is not valid JSON, throw an Error with `code = 'INVALID_MODEL_JSON'` and `raw` set to
   the text. Do not silently repair or fabricate a reminder.
8. For HTTP 429/5xx, timeouts and network failures throw an Error with `code = 'SERVICE_ERROR'`
   (and `status` when known). Retrying inside the application is allowed; fabricating output is not.
9. Read the API key only from environment variables / `.env` (see `.env.example`). Never print,
   log or hard-code it. Use Node.js built-ins only (global `fetch`), no npm packages.
10. Keep the model temperature low (<= 0.2) and request JSON-only output.
11. Never special-case the evaluation dataset inputs. Behaviour must come from the prompt and
    general validation logic.
12. A repair may change only: the system prompt, prompt construction, parser, validator, guardrails.
    It must not remove or weaken a guardrail.
13. The automated loop allows at most TWO repair attempts after the initial generation.
14. Generated code is untrusted until the evaluation verdict is PASS and a human has reviewed it.

## Layers (what the evaluation harness checks)

| Layer | Kind | Checked by |
|---|---|---|
| 1 | structural (hard gate, 100%) | `schema.json` |
| 2 | invariants and properties (hard gate, 100%) | `layer2.js`: future datetime, real calendar date, clarify rules, snooze > 0, horizon, no prompt leak, per-case expectations |
| 3 | semantic score (mean >= threshold) | `layer3.js`: datetime within tolerance, title token-F1, intent correct |
