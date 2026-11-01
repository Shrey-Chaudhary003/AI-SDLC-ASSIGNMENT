# Repair prompt template (Part 1A)

Use this only when a harness run FAILED. Fill the angle-bracket parts with real values copied
from `evidence/harness-results/<label>.findings.json` and from the spec. Send it to the coding
agent together with `.harness/harness-rules.md`. Maximum two repair attempts.

```
The deterministic harness rejected the generated implementation.

Run label: <label>
Failing gate(s): <gate names>

Sensor findings (copied from <label>.findings.json, nothing else):
<paste the failingGates array>

Expected behaviour from the specification:
<AC-ID and the Given/When/Then text from spec.md for each failing test, or the rule being violated>

Observed behaviour:
<actual vs expected from the test output / rule message>

Fix the root cause in src/ only.
Do NOT modify tests/, specs/, .harness/, eslint configs or the constitution.
Do NOT add suppression comments, skip tests, or weaken any check.
Preserve valid behaviour and change only what the findings require.
Explain the root cause and list the files you changed.
```

After the repair: run `npm run harness -- repair1` (then `repair2` if needed). Never reuse a label.
