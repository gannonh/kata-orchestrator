# KAT-162 End-to-End Demo Proof + Quality Gate for Slice A Design

**Issue:** KAT-162  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-162/a5-end-to-end-demo-proof-quality-gate-for-slice-a  
**Parent:** KAT-157 (Slice A - Build Session / Spec 04)  
**Branch target:** `feature/kat-162-a5-end-to-end-demo-proof-quality-gate-for-slice-a`  
**Specs:** `_plans/design/specs/04-build-session.md` (primary), `_plans/design/specs/02-coordinator-session.md`, `_plans/design/specs/03-spec-notes-panel.md`  
**Related workflow docs:** Linear docs `Execution Model: UI Baseline then Parallel Functional Vertical Slices`, `Desktop App Linear Workflow Contract`

## Scope and Outcome

Produce hard evidence that Slice A is demoable and stable, with a single CI-compatible flow that proves:

1. prompt submission starts a run
2. run completes with a draft
3. draft can be applied to spec
4. run/spec/session state persists
5. relaunch restores the same working state

Required outputs for issue closure:

- passing desktop quality gate command output (`npm run test:app:quality-gate` from repo root)
- one `@ci`-compatible E2E scenario covering the full flow above
- visual artifacts (screenshot sequence and/or video) mapped to demo definition
- linked evidence in KAT-162 and parent slice tracking
- explicit follow-up tickets for any discovered debt (no implicit deferment)

## Context Loaded

From Linear start sequence:

- KAT-162 moved to `In Progress`.
- Blocker KAT-189 is `Done`.
- Parent KAT-157 hard-gates Done on linked evidence.

From existing test/codebase context:

- `tests/e2e/kat-159-run-lifecycle.spec.ts` covers shell and chat basics.
- `tests/e2e/kat-160-spec-panel-parity.spec.ts` covers prompt -> draft apply visual path (currently `@uat`, not CI-safe).
- `tests/e2e/kat-161-restart-resume.spec.ts` covers relaunch resume persistence.
- `tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts` provides deterministic seeding/event patterns and visual captures for Spec 04 states.

## Constraints and Assumptions

- This ticket is verification-lane closure work; keep feature churn minimal.
- E2E flow must be deterministic and CI-safe; do not depend on external auth/network.
- Evidence must be reproducible from checked-in tests and predictable artifact paths.
- Assumption: screenshot sequence is acceptable as demo artifact if video is not required by the milestone note template.

## Approaches Considered

### Approach 1: Stitch existing tests and documentation only

Reuse KAT-160 + KAT-161 + KAT-189 results and assemble a narrative evidence note.

Pros:

- lowest code churn
- fastest to produce

Cons:

- no single end-to-end proof run for KAT-162 acceptance
- weaker auditability for "prompt -> run -> apply -> persist -> relaunch" as one scenario

### Approach 2 (Recommended): Add one dedicated KAT-162 CI E2E scenario plus evidence manifest

Create a new deterministic E2E test that runs the full flow in one spec and generates mapped artifacts.

Pros:

- strongest closure signal for hard-gate verification
- single traceable test reference for acceptance criteria
- integrates naturally with `test:app:quality-gate`

Cons:

- moderate implementation effort
- requires careful state setup/teardown to avoid flakiness

### Approach 3: Manual demo walkthrough only (agent-browser/playwright ad hoc)

Capture manual screenshots/video and attach evidence without adding a durable automated spec.

Pros:

- very fast initial capture
- useful supplemental proof for milestone demos

Cons:

- not durable regression protection
- weaker CI contract and repeatability

## Recommendation

Use **Approach 2** and include optional manual/demo media only as a supplement.  
KAT-162 is a hard-gate verification ticket; a single deterministic CI E2E scenario is the most defensible evidence contract.

## Proposed Design

## 1) Dedicated E2E Scenario (CI-Compatible)

Add `tests/e2e/kat-162-slice-a-demo-proof.spec.ts` with tags `@ci @quality-gate @uat`.

Scenario flow:

1. ensure workspace shell + active session
2. submit prompt (`Message input` + `Send`)
3. drive deterministic run progression (reuse KAT-189 run event injection pattern where needed)
4. assert status transitions and message rendering in center panel
5. apply draft in right panel (`Apply Draft to Spec`)
6. assert structured spec sections + task rows
7. persist checkpoint assertions against state file
8. relaunch app from copied state file
9. assert restored active space/session, message timeline, and spec applied markers

Primary acceptance assertions:

- no return to Home on relaunch
- latest prompt and agent response visible
- `Applied from <run-id>` visible in spec panel
- task/status continuity retained after restart

## 2) Evidence Artifact Contract

Write captures to `test-results/kat-162/` with stable names:

- `01-prompt-submitted.png`
- `02-run-completed-with-draft.png`
- `03-draft-applied-spec.png`
- `04-post-relaunch-restored-session.png`
- `kat-162-evidence-<timestamp>.json` (structured evidence summary)

Evidence JSON should include:

- test name + timestamp
- state file path used for relaunch
- run id used for draft apply
- assertions proven (booleans or value snapshots)
- artifact file paths

## 3) Quality Gate Integration

No script changes required. KAT-162 test joins existing E2E suite and runs through:

- `npm run test:app:quality-gate` (repo root)

Gate expectation:

- lint passes
- app coverage passes
- full app E2E suite passes including KAT-162 scenario

## 4) Linear Evidence Linking Plan

Post-completion, add a KAT-162 comment with:

- quality-gate command result summary
- specific test reference: `tests/e2e/kat-162-slice-a-demo-proof.spec.ts`
- artifact links under `test-results/kat-162/`
- acceptance mapping table (prompt/run/apply/persist/relaunch -> proof)
- follow-up tickets created for any debt

Mirror link in parent epic KAT-157 and milestone notes per issue requirement.

## 5) Explicit Debt Capture Rules

During implementation/verification:

- if instability/flakiness appears, create follow-up ticket immediately
- include repro steps + failing assertion context
- keep KAT-162 focused on proof path, not broad remediation

## Testing Strategy

Minimum verification set before closure:

- `npm run test:app:quality-gate` (repo root)
- optional focused run during development: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`

## Non-Goals

- Broad UI parity rework already handled by prior slice tickets.
- Re-architecting orchestrator internals beyond what is needed for deterministic proof.
- Replacing existing KAT-160/KAT-161/KAT-189 evidence; KAT-162 should reference and consolidate, not duplicate scope.

## Risks and Mitigations

- Risk: flaky timing around run state transitions.  
  Mitigation: deterministic event injection patterns and explicit `expect(..., { timeout })` boundaries.

- Risk: relaunch assertions become environment-sensitive.  
  Mitigation: reuse managed fixture state file isolation and copied relaunch state strategy from KAT-161 tests.

- Risk: evidence drift (screenshots from non-final run).  
  Mitigation: publish artifacts from final passing quality-gate run only.

## Deliverables

- `docs/plans/2026-03-05-kat-162-end-to-end-demo-proof-quality-gate-for-slice-a-design.md` (this design)
- `tests/e2e/kat-162-slice-a-demo-proof.spec.ts` (implementation phase)
- `test-results/kat-162/*` artifacts (implementation/verification phase)
- KAT-162 + KAT-157 evidence comments with linked proof (completion phase)

## Approval Gate

Design is ready for implementation planning via `writing-plans` once approved.
