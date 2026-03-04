# KAT-188 Task Tracking State Parity for Build-Session Mock 14 Design

**Issue:** KAT-188  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-188/a9-task-tracking-state-parity-for-build-session-mock-14  
**Parent:** KAT-157 (Slice A - Build Session / Spec 04)  
**Branch target:** `feature/kat-188-a9-task-tracking-state-parity-for-build-session-mock-14`  
**Specs:** `_plans/design/specs/04-build-session.md` (primary), `_plans/design/specs/03-spec-notes-panel.md` (task checkbox behavior baseline)  
**Relevant mocks:** `14-build-session-task-tracking.png`, `19-wave1-merge-strategy.png`, `task-detail-no-activity.png`, `task-detail-high-activity.png`

## Scope and Outcome

Implement build-session task tracking parity for the left panel and synchronized task state behavior across the session surface.

Required outcome:

- Task rows in the left panel match Mock 14 structure and interaction patterns.
- Task state updates reflect live run activity while the orchestrator is active.
- High-activity and no-activity row detail states match the provided detail mocks.
- Left-panel task states stay in sync with right-panel spec task states.

## Context Loaded

From Linear and related project docs:

- KAT-188 is unblocked (`KAT-160` and `KAT-187` are `Done` as of March 3, 2026).
- Parent issue KAT-157 defines `_plans/design/specs/04-build-session.md` as authority and requires evidence before `Done`.
- Workflow contract requires state/interaction verification plus tests and screenshots for closure.
- Fidelity classification comment marks KAT-188 as **Final fidelity (scoped)** for the left-panel task tracking surface.

From current code:

- `LeftPanel` currently renders status progress from `mockProject.tasks` with preview-state controls; it does not render the Mock 14 task list surface.
- `RightPanel` + `useSpecDocument` already support structured task parsing and checkbox toggling in the spec tab.
- Runtime event stream (`SessionRuntimeEvent`) currently emits only run-state and message events; no typed task-activity snapshots exist.
- Agent roster data is available via `session-agent-roster:list`, but statuses are not updated in real time during runs.

From provided mock/detail assets:

- **No-activity detail state:** rows show checkbox + title + disclosure affordance, without inline activity detail text.
- **High-activity detail state:** active rows show colored status indicators plus one-line live activity detail and specialist badge.
- **Mock 19 alignment:** left task surface, center conversation, and right spec panel show consistent task progression states.

## Constraints and Assumptions

- This ticket owns final fidelity for task tracking states on the left-panel build-session flow.
- Existing right-panel task toggles from KAT-160 remain source-of-truth for persisted task completion state.
- Current runtime does not emit real subagent task telemetry; this design introduces a typed task-activity projection layer rather than waiting for a separate backend task engine.
- Existing center and right tab systems should not regress (dynamic tabs, draft apply/edit flows).

## Approaches Considered

### Approach 1: Renderer-only derivation from existing run/message events

Derive task activity entirely in renderer from `run_state_changed` + `message_updated` text, without changing main/preload event contracts.

Pros:

- Smallest cross-layer change.
- Fast to ship for UI parity.

Cons:

- Brittle parsing in renderer and no shared contract for task activity.
- Harder to keep agent roster/task activity consistent across reloads.
- Difficult to test deterministically at the IPC boundary.

### Approach 2 (Recommended): Main-owned task-activity projection + typed runtime snapshots

Add a typed `task_activity_snapshot` runtime event emitted from main process. Renderer consumes snapshots and renders left/right task states from the same projected source.

Pros:

- Stable contract for UI parity and replay-safe behavior.
- Keeps projection logic close to run lifecycle events and state persistence.
- Enables deterministic unit tests in main and renderer.

Cons:

- Requires coordinated changes in shared types, preload bridge, main runtime handling, and renderer hooks.

### Approach 3: Polling-based sync via `run:list` + roster list

Poll runs and roster on intervals while a run is active; derive task activity from latest records.

Pros:

- Avoids runtime event schema changes.

Cons:

- Laggy UX and unnecessary IPC churn.
- Harder to synchronize transient high-activity detail rows.
- More race conditions than event-driven updates.

## Recommendation

Use **Approach 2**. It provides the cleanest real-time contract and prevents UI-specific heuristics from leaking through multiple renderer components.

## Proposed Design

## 1) Task Tracking Domain Model

Introduce a shared renderer domain model for task tracking that can represent both persisted checkbox state and live activity detail:

```ts
type TaskTrackingStatus = 'not_started' | 'in_progress' | 'blocked' | 'complete'

type TaskActivityLevel = 'none' | 'low' | 'high'

type TaskTrackingItem = {
  id: string
  title: string
  status: TaskTrackingStatus
  activityLevel: TaskActivityLevel
  activityDetail?: string
  activeAgentId?: string
  updatedAt: string
}

type TaskActivitySnapshot = {
  sessionId: string
  runId: string
  items: TaskTrackingItem[]
  counts: {
    not_started: number
    in_progress: number
    blocked: number
    complete: number
  }
}
```

Normalization rule:

- Task IDs must be stable between left and right panels. Use a deterministic title-based slug/hash (`slug(task title)`) instead of sequence-only IDs.
- `spec-parser` should preserve `markdownLineIndex` for write-back, but expose a stable `id` for cross-panel sync.

## 2) Runtime Event Contract Extension

Extend `SessionRuntimeEvent` with a typed snapshot payload:

```ts
type TaskActivitySnapshotEvent = {
  type: 'task_activity_snapshot'
  snapshot: TaskActivitySnapshot
}
```

Emission behavior in main runtime path:

- On `run_state_changed: pending`: emit initial snapshot with scoped tasks and `in_progress` set based on seeded specialist work.
- On `message_updated`/`message_appended`: update top active items with one-line activity details and emit a fresh snapshot.
- On `run_state_changed: idle|error`: settle in-progress items (or leave as in-progress if unresolved) and emit terminal snapshot.

Projection source priority:

1. Applied spec tasks (`specDocuments[spaceId:sessionId]`) for canonical task list.
2. If spec not applied yet, latest draft task list for temporary projection.
3. If neither is available, emit empty snapshot.

## 3) Main Process Task-Activity Projector

Add projector logic in main runtime handling (`ipc-handlers`/run event path):

- Maintain an in-memory `sessionTaskActivity` map keyed by `sessionId` for active runs.
- Map agent progression to task rows:
  - coordinator/specialist `running` -> related task `in_progress`
  - specialist blocked signal -> task `blocked`
  - explicit completion signal or user checkbox -> task `complete`
- Generate concise `activityDetail` text from latest activity line (trimmed one-line format to match detail mocks).

Keep projection deterministic:

- For ambiguous mapping, fallback to first unresolved task in queue order.
- Never randomize task selection; deterministic ordering is required for stable tests/screenshots.

## 4) Renderer Integration and UI Composition

### Left panel

Replace preview-state task scaffolding in `LeftStatusSection` with a dedicated build-session task tracking section:

- Header summary line based on snapshot counts (example: `4 in progress · 3 done · 4 waiting`).
- Task rows with status icon + title + disclosure affordance.
- Row detail rendering rules:
  - `activityLevel=none`: compact row only (matches `task-detail-no-activity`).
  - `activityLevel=high`: show single-line detail + specialist badge chip (matches `task-detail-high-activity`).

### Right panel

Keep `TaskList` as the interactive checkbox surface, but enhance display from same snapshot source:

- Status badge reflects `TaskTrackingStatus` projection.
- Optional inline activity detail visible for high-activity rows in mock-19 state.

### App shell wiring

- `useIpcSessionConversation` holds latest `taskActivitySnapshot` in session conversation state.
- `AppShell` passes snapshot to both `LeftPanel` and `RightPanel`.
- `RightPanel` continues to persist checkbox updates via `useSpecDocument`; after persistence, local state merges into snapshot projection.

## 5) State Sync Contract (Left <-> Right)

Single writer rules:

- Persisted checkbox toggles (`specSave`/`specApplyDraft`) own final `complete/not_started/in_progress` task state storage.
- Runtime projector owns transient activity detail and active-agent attribution during active runs.

Merge precedence:

1. Persisted task completion status from spec document.
2. Runtime activity detail fields (`activityLevel`, `activityDetail`, `activeAgentId`) layered on top.

Conflict handling:

- If user marks a task complete while runtime still reports activity, completion status remains `complete`; activity detail clears on next snapshot.

## 6) Error Handling and Resilience

- If projector cannot map activity to a task, keep snapshot valid and attach activity to a synthetic `unmapped` bucket (not rendered in UI; logged for diagnostics).
- If `task_activity_snapshot` events are absent, left panel falls back to persisted spec task list with no-activity rendering.
- Renderer must treat unknown statuses as `not_started` and avoid crashing.

## 7) Testing Strategy (TDD)

Unit tests (main):

- projector maps run/message/agent transitions into deterministic snapshots.
- stable task ID generation from spec titles.
- edge cases: empty task list, duplicate task names, run failure.

Unit tests (renderer):

- `useIpcSessionConversation` consumes `task_activity_snapshot` and resets correctly on session switch.
- left task section renders no-activity and high-activity variants.
- right `TaskList` displays snapshot detail and keeps toggle behavior intact.

Integration tests:

- `AppShell` shares one snapshot source across left/right panels.
- right-panel toggle updates reflected in left-panel row state.

E2E / evidence:

- add targeted test that drives a run and captures:
  - mock-14 parity state
  - no-activity task detail state
  - high-activity task detail state
  - mock-19-like synchronized left/right state
- store artifacts under `test-results/kat-188/` and link in Linear.

## Non-Goals

- Full orchestrator multi-subagent execution engine rewrite.
- Reworking center-panel decision flow introduced in KAT-187.
- Redesigning left-panel tab architecture beyond task-tracking parity needs.
- Introducing comments/threads in spec panel (still deferred per current contract).

## Risks and Mitigations

- **Risk:** Task IDs drift when markdown task order changes.  
  **Mitigation:** deterministic title-based IDs and parser tests for stability.

- **Risk:** Event ordering races between checkbox toggles and incoming runtime snapshots.  
  **Mitigation:** merge precedence with persisted status as authoritative.

- **Risk:** Main-process projection complexity grows beyond ticket scope.  
  **Mitigation:** keep projector minimal (single snapshot event, deterministic mapping rules, no extra IPC channels).

## Approval Gate

If this design is accepted, next artifact is the implementation plan:

- `docs/plans/2026-03-04-kat-188-task-tracking-state-parity-implementation-plan.md`
