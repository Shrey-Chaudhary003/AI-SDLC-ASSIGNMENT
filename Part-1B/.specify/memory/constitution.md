# Reminder Agent Constitution

## Core Principles

### I. Specification Authority and Traceability
- **BP-001** `spec.md`, `plan.md`, `tasks.md`, and `contracts/` are the authoritative source of project requirements. Implementation, tests, and evaluation must trace to them and must not silently override them.
- **BP-002** Every requirement in those artifacts must have a stable ID using one of these prefixes: `FR-` (functional requirement), `SI-` (system invariant), `BP-` (business/process policy), `GR-` (guardrail), or `AC-` (acceptance criterion). Plans, tasks, contracts, code, and evidence must retain those IDs when referring to requirements.
- **BP-003** Resolve ambiguity in the authoritative specification before implementation. Record every such resolution in its `Change History`; never resolve ambiguity silently in code.

### II. Exact, Schema-Conforming Model Output
- **FR-001** The application converts a free-text reminder request into exactly one structured JSON object conforming to the schema defined by the authoritative specification and contract.
- **SI-001** Every model output must be validated against that schema. Invalid output is a failure; the application must not silently repair, coerce, omit, infer, or fabricate values to make it appear valid.

### III. Layered Validation and Evaluation
- **SI-002** Layer 1 structural validation and Layer 2 deterministic invariant/property checks are hard gates. They must be implemented as deterministic code and pass at 100 percent; a failure in either layer fails the evaluation.
- **AC-001** Layer 3 semantic scoring is measured against the formula and threshold declared in the specification. An LLM judge, if used, is supplementary and must never replace or bypass either hard-gate layer.
- **AC-002** Declare the evaluation threshold and scoring formula in the specification before the final evaluation. Do not lower, weaken, or redefine them after that evaluation begins.

### IV. Controlled Implementation and Immutable Guardrails
- **GR-001** A coding agent may create or change files only under `src/` and `prompts/`.
- **GR-002** A coding agent must never create, edit, rename, or delete files in `evals/`, `specs/`, `.harness/`, or `.specify/memory/constitution.md`.
- **GR-003** A coding agent must not remove or weaken a guardrail, special-case dataset inputs, change expected results, or change the evaluation threshold.
- **GR-004** Changes outside the permitted implementation paths require the authorized human/specification process; they are not implementation shortcuts.

### V. Deterministic Time and Model Configuration
- **SI-003** Inject the reference time and timezone as inputs. Never resolve relative date or time expressions using the machine's system clock.
- **GR-005** Model temperature must be at most `0.2` and its configured value must be recorded in the configuration used for the run.
- **FR-002** The application must use Node.js with CommonJS modules, built-in modules only, and the runtime's global `fetch`; do not add third-party runtime dependencies or substitute a separately installed fetch implementation.

### VI. Secret and Service-Error Handling
- **GR-006** Read the API key only from environment variables or `.env`. Never print or log the key, and never commit it.
- **SI-004** Report model/service failures—including HTTP 429 or 5xx responses, timeouts, and network failures—as service errors, separate from application failures. Do not count service errors as application failures.

### VII. Preserved Evidence and Human Decision
- **BP-004** Preserve the first-generation model output as evidence before any repair attempt.
- **BP-005** Permit at most two repair attempts. Each attempt must be driven only by recorded harness failure evidence; do not make unsupported or dataset-specific changes.
- **AC-003** Close the work with a human `ACCEPT` or `REJECT` decision that records residual risks. Passing automated checks alone is not human acceptance.

## Additional Constraints

- **SI-005** Keep implementation behavior, contracts, prompts, and evaluation aligned with the authoritative requirement IDs; changes to requirements must be made upstream before implementation changes.
- **GR-007** Keep secrets and preserved evaluation evidence out of committed source unless the authoritative specification explicitly defines a safe, approved storage mechanism.
- **AC-004** Report structural/invariant gate results, semantic score versus its predeclared threshold, service errors, repair attempts, preserved first-generation evidence, and the human decision separately.

## Development Workflow

1. Read the authoritative specification and identify the requirement IDs relevant to the change.
2. Resolve ambiguities upstream and record them in `Change History` before coding.
3. Implement only within the permitted paths. Keep deterministic validation independent of semantic scoring and model judgment.
4. Preserve the initial output, capture harness evidence for any repair, and stop after two repair attempts.
5. Evaluate against the unchanged formula and threshold declared before final evaluation. Report service errors separately.
6. Obtain and record a human `ACCEPT` or `REJECT` decision with residual risks.

## Governance

This constitution governs implementation and evaluation. The authoritative project artifacts named in **BP-001** define the detailed requirements and contracts and may not contradict this constitution. Any conflict or ambiguity must be resolved through the authorized specification process and recorded in `Change History` before implementation; coding agents must not silently choose an interpretation or modify protected artifacts. All reviews and evaluations must verify the applicable requirement IDs and guardrails. No passing score waives a hard gate or the required human decision.

## Change History

| Date | Version | Change |
|---|---|---|
| 2026-11-01 | 1.0.0 | Initial ratification for Reminder Agent. |

**Version**: 1.0.0 | **Ratified**: 2026-11-01 | **Last Amended**: 2026-11-01
