# Reminder Agent Harness Log

## Evaluation policy

- Layer 1 schema and Layer 2 deterministic properties: 100% required.
- Layer 3 score: `0.5 * datetime_match + 0.3 * title_similarity + 0.2 * intent_correct`.
- Mean Layer 3 threshold: `0.85`.
- Any service error makes the verdict `INCOMPLETE`; service errors are not application failures.
- Dataset, schema, evaluator, and threshold were not changed during these runs.

## Attempts

| Attempt | Label | Timestamp (UTC) | Verdict | Layer 1 | Layer 2 | Layer 3 mean | Service errors | Notes |
|---|---|---|---|---:|---:|---:|---:|---|
| 1 | `initial` | 2026-11-01 18:21:13.750Z | FAIL | 18/18 (100%) | 17/18 (94.44%) | 0.9444 | 0 | EV-17 failed: a far-future reminder was rejected instead of clarified. |
| 2 | `repair1` | 2026-11-01 18:24:16.171Z | PASS | 18/18 (100%) | 18/18 (100%) | 1.0000 | 0 | Updated the general prompt rule so requests beyond the five-year horizon clarify, preserve an identifiable task title, and ask about an acceptable date. |

## Evidence

- Initial report: [eval-results-initial.json](./eval-results-initial.json)
- Initial failure details: [failure-evidence-initial.json](./failure-evidence-initial.json)
- Repair report: [eval-results-repair1.json](./eval-results-repair1.json)
- Harness attempt ledger: [attempt-log.json](./attempt-log.json)

The repair changed only `prompts/system-prompt.md`. No evaluation input, expected result, schema, evaluator, or threshold was modified.
