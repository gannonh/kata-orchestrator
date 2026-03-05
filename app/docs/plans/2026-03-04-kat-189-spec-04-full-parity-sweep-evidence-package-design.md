# KAT-189 Spec 04 Full Parity Sweep + Evidence Package Design

**Issue:** KAT-189  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-189/a10-spec-04-full-parity-sweep-evidence-package  
**Parent:** KAT-157 (Slice A - Build Session / Spec 04)  
**Branch target:** `feature/kat-189-a10-spec-04-full-parity-sweep-evidence-package`  
**Specs:** `_plans/design/specs/04-build-session.md` (primary), `_plans/design/specs/03-spec-notes-panel.md`, `_plans/design/specs/02-coordinator-session.md`  
**Relevant mocks:** `10-build-session-spec-draft-review.png`, `11-build-session-architecture-proposal.png`, `12-build-session-tech-stack-a.png`, `13-build-session-tech-stack-b.png`, `14-build-session-task-tracking.png`

## Scope and Outcome

Close remaining Spec 04 parity gaps and produce one consolidated evidence package (tests + visuals) that satisfies the hard-gate `Done` requirements for this lane.

Required outcome:

- Mock 10-14 states are explicitly verified against current UI behavior.
- Any residual parity gaps discovered during sweep are fixed in-scope.
- Evidence is consolidated into one package with traceable links to commands, tests, and artifacts.

## Context Loaded

From Linear and workflow docs:

- `KAT-189` is now `In Progress`.
- Blockers `KAT-161` and `KAT-188` are `Done`.
- Parent epic `KAT-157` defines Spec 04 as authority and requires linked evidence before `Done`.
- Desktop workflow contract requires verified states/interactions plus evidence links.

From existing implementation/docs:

- Prior slice tickets implemented major pieces of Spec 04 parity:
  - session shell / run lifecycle (`KAT-158`, `KAT-159`)
  - structured right-panel spec + toggles (`KAT-160`)
  - resume persistence (`KAT-161`)
  - agent roster (`KAT-185`)
  - conversation entry index (`KAT-186`)
  - approval actions (`KAT-187`)
  - task tracking sync (`KAT-188`)
- Existing E2E evidence is split across per-ticket specs under `tests/e2e/kat-*.spec.ts` and `test-results/kat-*`.

From current renderer scan:

- Left/center/right architecture is present, but parity still needs an end-to-end sweep across mock states 10-14.
- Left status/task presentation includes a runtime task-tracking section, but final parity for exact section behavior/affordances should be confirmed in one sweep.
- Evidence is currently fragmented by ticket instead of bundled for KAT-189 closure.

## Constraints and Assumptions

- This ticket is verification-lane closure work; it should avoid broad new feature scope.
- Changes must preserve established behavior from `KAT-160/161/185/186/187/188`.
- Evidence must be reproducible via checked-in test specs and deterministic artifact paths.
- Assumption: it is acceptable for KAT-189 to include small targeted UI fixes discovered by the sweep (not just documentation).

## Approaches Considered

### Approach 1: Evidence-only aggregation (no new sweep)

Aggregate existing ticket artifacts and command outputs into one markdown evidence note.

Pros:

- Fastest path.
- Minimal code churn.

Cons:

- Risks missing regressions between ticket completion and current branch state.
- Does not prove full mock 10-14 parity in one controlled run.

### Approach 2 (Recommended): Full parity sweep harness + targeted fixes + consolidated evidence manifest

Create a KAT-189 sweep spec that exercises mock 10-14 progression end-to-end, capture fresh artifacts, patch discovered parity gaps, and publish a single evidence package doc.

Pros:

- Highest confidence closure.
- Ensures evidence aligns with current shipped behavior, not historical snapshots.
- Produces a clean auditable package for Linear.

Cons:

- More upfront effort than evidence-only aggregation.
- May surface additional small fixes before final pass.

### Approach 3: Manual QA walkthrough + screenshots

Use manual runs (agent-browser/playwright scripts) and produce screenshots/video with checklist sign-off.

Pros:

- Flexible and quick for exploratory validation.

Cons:

- Lower repeatability.
- Weaker CI linkage and harder regression protection.

## Recommendation

Use **Approach 2**.

KAT-189 is explicitly about full parity sweep and evidence packaging. The recommended approach provides the strongest closure signal and aligns best with the project hard-gate `Done` rule.

## Proposed Design

### 1) Parity Contract Matrix (Spec 04 Mocks 10-14)

Create a matrix in `docs/plans/2026-03-04-kat-189-spec-04-evidence-package.md` with rows:

- Mock/state (`10`, `11`, `12`, `13`, `14`)
- Required UI behavior from spec
- Assertion source (unit/E2E test name)
- Artifact link (screenshot/video path)
- Status (`pass`, `fixed`, `deferred-with-owner`)

This matrix is the canonical closure checklist for KAT-189.

### 2) Single Sweep E2E Spec

Add `tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts` that:

- boots the app into build-session context,
- exercises conversation flow and proposal/approval interactions,
- verifies left/center/right synchronized behavior for mock states 10-14,
- captures screenshots into `test-results/kat-189/`.

Planned artifact set:

- `test-results/kat-189/mock10-spec-draft-review.png`
- `test-results/kat-189/mock11-architecture-proposal.png`
- `test-results/kat-189/mock12-tech-stack-a.png`
- `test-results/kat-189/mock13-tech-stack-b.png`
- `test-results/kat-189/mock14-task-tracking.png`

### 3) Targeted Gap-Closure Rules

During sweep, if mismatch is found:

- Apply smallest fix that restores spec behavior.
- Add/adjust unit test for the fixed component.
- Re-run targeted E2E sweep assertion for that state.
- Record fix in matrix row as `fixed` with commit reference.

Likely high-value gap checks:

- Left sidebar section behavior and visibility across mock 10 vs 12-14 progression.
- Task row affordances and parity between left tracking and right spec checklist.
- Center conversation proposal/approval rendering sequence.
- Right panel section completeness and task state synchronization.

### 4) Consolidated Evidence Package

Create `docs/plans/2026-03-04-kat-189-spec-04-evidence-package.md` containing:

- command log (exact commands + pass/fail summary),
- parity matrix,
- artifact links,
- mapping to KAT-189 acceptance statement,
- explicit note for any deferred item (must include owner ticket, never unowned).

### 5) Linear-Ready Completion Note Template

Prepare a single comment payload for KAT-189:

- PR link
- test command results
- parity matrix summary (5/5 states)
- artifact links
- deferment block (if any)

This avoids fragmented closure comments.

## Testing Strategy

Required verification set:

- `npm run lint`
- Targeted renderer/main unit tests touching any changed components
- `npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts`
- Existing spec-04 parity specs rerun as safety net:
  - `kat-160-spec-panel-parity.spec.ts`
  - `kat-185-agent-roster-sidebar.spec.ts`
  - `kat-187-approval-actions.spec.ts`
  - `kat-188-task-tracking-parity.spec.ts`

## Non-Goals

- Re-architecting orchestrator runtime contracts beyond parity fixes found by sweep.
- Expanding scope into Spec 05/06 flows.
- Replacing existing per-ticket evidence docs; KAT-189 package will reference them where useful.

## Risks and Mitigations

- Risk: sweep uncovers broader UX deltas than expected.  
  Mitigation: enforce smallest-fix rule and create follow-up issues for out-of-scope items.
- Risk: flaky E2E evidence capture.  
  Mitigation: deterministic fixtures, stable selectors, fixed artifact names.
- Risk: evidence drift between runs.  
  Mitigation: regenerate package from final passing run only.

## Deliverables

- `docs/plans/2026-03-04-kat-189-spec-04-full-parity-sweep-evidence-package-design.md` (this design)
- `tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts` (implementation phase)
- `docs/plans/2026-03-04-kat-189-spec-04-evidence-package.md` (implementation phase)
- `test-results/kat-189/*` screenshot artifacts (implementation phase)
