# Repair prompt template (Part 1B)

Use this only when an evaluation produced FAIL. Copy real values from
`evidence/failure-evidence-<label>.json`. Send it to the coding agent together with
`.harness/harness-rules.md`. Maximum two repair attempts.

```
The evaluation harness rejected the application.

Run label: <label>
Aggregate: Layer 1 <x>/<n>, Layer 2 <y>/<n>, Layer 3 mean <m> (threshold <t>)

Failing case(s) (copied from failure-evidence-<label>.json, nothing else):
<paste the failures array entries: id, input, expected, output, failedRequirements,
 layer1Errors, layer2Failed, layer3>

Repair the application only: the system prompt in prompts/, prompt construction, the parser,
the validator or a guardrail in src/.
Do NOT modify evals/, specs/, .harness/, expected results or the threshold.
Do NOT remove or weaken any guardrail. Do NOT special-case these inputs.
Explain the root cause and list the files you changed.
```

After the repair: `npm run eval -- --label repair1` (then `repair2` if needed). Never reuse a label.
If the failure is only a service error (verdict INCOMPLETE), do NOT repair anything: wait, then re-run
with a new label such as `initial-rerun`.
