# KAT-161 Draft Apply + Persistence + Session Resume Across App Relaunch Design

**Issue:** KAT-161  
**Parent:** KAT-157 (Slice A - Build Session / Spec 04)  
**Specs:** `_plans/design/specs/02-coordinator-session.md`, `_plans/design/specs/03-spec-notes-panel.md`, `_plans/design/specs/04-build-session.md`

## Scope and Outcome

Deliver Slice A persistence semantics so a user can relaunch the app and continue from the same active space/session with coherent run and spec state.

KAT-161 outcome:

- Persist session/run/spec/task state at explicit checkpoints.
- Restore active workspace/session on app relaunch instead of always booting into fresh Home -> new session flow.
- Reconcile stale in-flight run states after restart using safe fallback behavior.
- Keep draft-apply markers and task statuses consistent after reload/relaunch.
- Add integration tests for restart/resume and corrupted-state scenarios.

## Current Gaps (Observed)

- `App` always starts in Home view and creates a brand-new session when opening a space; it does not restore prior active workspace/session.
- `RightPanel` spec/task state is stored in renderer `localStorage` (`kata.spec-panel.v1:<spaceId>:<sessionId>`), while runs/session selections are stored in main-process app state file.
- Run records persist status/messages, but run draft metadata and "draft applied" checkpoint semantics are not persisted in main state.
- In-flight runs can remain in transient statuses across restart without a deterministic resume/reconcile policy.

## Assumptions and Constraints

- KAT-160 established structured spec rendering and task toggles; KAT-161 hardens persistence/relaunch behavior.
- KAT-160 is done and is the only blocker for KAT-161 in Linear.
- State file (`app-state.json`) remains the canonical persisted store for desktop relaunch behavior.
- Hard-gate evidence for this ticket requires integration-level restart proof (tests + relaunch capture).

## Approaches Considered

### Approach 1 (Not Recommended): Keep Split Persistence (Main State + Renderer localStorage) and Add Thin Startup Heuristics

Pros:
- Lowest immediate code churn.
- Minimal IPC changes.

Cons:
- Continues split-brain persistence (main state vs renderer localStorage).
- Harder to guarantee spec/task/run coherence after relaunch.
- Corruption handling remains fragmented and brittle.

### Approach 2 (Recommended): Unify Session-Scoped Persistence in Main State With Explicit Reconciliation

Pros:
- Single source of truth for relaunch semantics (spaces/sessions/runs/spec docs/task state).
- Deterministic resume and recovery behavior.
- Clear corruption fallback rules in one place.
- Better fit for integration testability and evidence capture.

Cons:
- Requires new state schema + migration path from existing localStorage data.
- Requires additional IPC endpoints and renderer wiring updates.

### Approach 3 (Not Recommended): Introduce Separate Embedded DB for Persistence

Pros:
- Stronger long-term queryability and migration features.

Cons:
- Oversized for KAT-161 scope/timeline.
- Higher operational complexity than needed for current Slice A milestone.

## Recommendation

Proceed with **Approach 2**: consolidate persistence and resume semantics in the main-process state store, with deterministic startup restoration and in-flight run reconciliation.

## Proposed Design

## 1) State Model Extensions (Main Process Canonical Store)

Extend persisted state with session-scoped spec persistence and draft-application markers:

- Add `specDocuments: Record<string, PersistedSpecDocument>` to `AppState`, keyed by `spaceId:sessionId`.
- `PersistedSpecDocument` fields:
  - `markdown: string`
  - `appliedRunId?: string`
  - `appliedAt?: string`
  - `updatedAt: string`
- Extend `RunRecord`:
  - `draft?: LatestRunDraft`
  - `draftAppliedAt?: string`

Invariant rules:

- `appliedRunId` must refer to a run in the same session; if not, clear it during load/reconcile.
- Task statuses are derived from markdown task markers on load to avoid dual-write divergence.

## 2) IPC and Renderer Contracts

Add minimal IPC to make startup and spec persistence deterministic:

- `app:bootstrap` -> returns full persisted selection context (`activeSpaceId`, `activeSessionId`) plus needed state slices for initial render.
- `space:setActive` and `session:setActive` -> persist selection changes immediately.
- `spec:get` / `spec:save` / `spec:applyDraft` -> move spec persistence from renderer localStorage into main state.
- `run:markDraftApplied` -> stamp run-level `draftAppliedAt` when draft is applied.

Renderer updates:

- `App` bootstraps from persisted active IDs; if valid, enter workspace directly.
- Remove forced `sessionCreate` on every space-open path; create new session only when none exists or user explicitly requests one.
- Replace localStorage-backed `useSpecDocument` writes with IPC-backed persistence.

## 3) Restart Reconciliation Semantics

On app startup, reconcile transient/inconsistent state before first render:

- Any run with status `queued` or `running` is transitioned to `failed` with:
  - `completedAt = now`
  - `errorMessage = "Recovered after app restart: in-flight run was interrupted"`
- Keep existing messages; append a system/agent recovery message for timeline clarity.
- Validate active IDs:
  - If `activeSpaceId` missing -> null.
  - If `activeSessionId` not in `activeSpaceId` -> null.
- Validate `specDocuments` entries; drop malformed entries and continue.

Behavioral contract:

- Relaunch never resumes a transport-level live run.
- Relaunch always resumes a coherent persisted checkpoint.

## 4) Draft Apply + Task Status Consistency

Draft application flow:

1. Latest run draft exists on run record.
2. User clicks `Apply Draft to Spec`.
3. Main process writes spec document with `appliedRunId`, `appliedAt`.
4. Run record gets `draftAppliedAt`.

Consistency guarantees:

- On reload/relaunch, right panel reconstructs identical markdown and task states from persisted spec document.
- If applied run no longer exists (corruption/manual edits), keep markdown but clear run linkage markers.

## 5) Corruption and Edge-Case Fallbacks

Fallback policy is fail-safe and non-destructive where possible:

- Invalid top-level schema -> existing state-store behavior (default state).
- Invalid individual `specDocuments` records -> drop record, preserve rest of state.
- Invalid run draft metadata -> clear draft field, preserve run messages/status.
- Any recoverable parse/load issue logs warning and proceeds with usable state.

## 6) Testing and Evidence Plan

Unit tests:

- `state-store` schema validation for new `specDocuments` + run draft/applied markers.
- Reconciliation tests for queued/running -> failed transition on startup.
- IPC handler tests for new bootstrap/active-selection/spec persistence channels.

Renderer tests:

- `App` restores workspace shell from persisted active IDs without creating a fresh session.
- Right panel reloads persisted spec/tasks and applied markers through IPC.

Integration/E2E restart tests:

- Seed state, run prompt, apply draft, toggle tasks, relaunch app with same state file.
- Assert:
  - active space/session restored
  - conversation history visible
  - spec content + task statuses preserved
  - draft-applied markers preserved
- Add interrupted-run scenario:
  - force app close while run is pending/running
  - relaunch and verify safe failed fallback state.

Evidence artifacts:

- Relaunch screenshots/video under `test-results/kat-161/`.
- Integration test outputs linked in Linear issue.

## 7) Non-Goals

- Full spec 02/03/04 visual parity completion outside persistence semantics.
- New long-running background run resumption protocol (true continuation).
- Re-architecture to SQLite/DB persistence.

## 8) Risks and Mitigations

- **Risk:** Migration from localStorage to main-state spec storage causes perceived data loss.  
  **Mitigation:** one-time best-effort import on first access + fallback warning path.

- **Risk:** Startup reconciliation marks legitimate work as failed too aggressively.  
  **Mitigation:** restrict to non-terminal statuses only (`queued`/`running`), preserve all messages for auditability.

- **Risk:** Additional IPC surface introduces regressions.  
  **Mitigation:** contract tests in `ipc-handlers` plus renderer integration coverage.

## Approval Gate

If this design is approved, next step is `writing-plans` to produce:

- `docs/plans/2026-03-03-kat-161-draft-apply-persistence-session-resume-implementation-plan.md`
