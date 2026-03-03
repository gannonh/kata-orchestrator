# KAT-185 Agent Roster Entity + Build-Session Sidebar Integration Design

**Issue:** KAT-185  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-185/a6-agent-roster-entity-sidebar-integration-for-build-session  
**Branch target:** `feature/kat-185-a6-agent-roster-entity-sidebar-integration-for-build-session`  
**Specs:** `app/_plans/design/specs/04-build-session.md` (primary), `app/_plans/design/specs/02-coordinator-session.md` (session context)

## Scope and Outcome

Deliver a persistent, session-scoped agent roster model and wire it into the build-session left sidebar so agent rows are no longer renderer-only mock data.

This ticket is the foundation for follow-on sidebar tickets:

- KAT-186 (conversation entry index and jump-to-message)
- KAT-188 (task tracking parity)

## Current State Summary

- Renderer `LeftPanel` currently shows `AgentsTab` from static `mockAgents` in `src/renderer/mock/agents.ts`.
- Main process persisted `AppState` currently includes only `spaces`, `sessions`, and active IDs.
- State persistence validation is strict (`src/main/state-store.ts`), so schema changes must be backward-compatible to avoid wiping valid saved state.

## Constraints and Assumptions

- Linear marks KAT-159 as `Done` (runtime lifecycle blocker complete), but this workspace does not yet contain those runtime additions.  
- This design therefore defines a roster model and sidebar integration that works with current local baseline and remains compatible with KAT-159/KAT-186/KAT-188 sequencing.
- Scope stays focused on roster entity and roster rendering; task-index and conversation-index behavior remain out of scope for this ticket.

## Approaches Considered

### Approach 1 (Recommended): Persisted roster entity in `AppState` + sidebar reads from IPC

Add a normalized session-agent roster record to shared state, validate/persist it in main, expose list API over preload IPC, and render `AgentsTab` from real roster data.

Pros:

- Solves the core requirement (persistent roster model) directly.
- Keeps renderer source-of-truth in main process state instead of local mocks.
- Enables clean extension for KAT-186 and KAT-188 without refactoring again.

Cons:

- Requires coordinated type/schema changes across shared, main, preload, and renderer.
- Requires migration-safe state-store evolution.

### Approach 2: Derive roster on the fly from run/conversation records only

Do not persist a first-class roster entity; compute visible agents from run artifacts each render.

Pros:

- Fewer state fields.
- No additional list APIs if run payload already available.

Cons:

- Weak persistence semantics for sidebar ordering, display names, and pinned/system agents.
- Creates coupling to run payload shape and complicates future sidebar features.

### Approach 3: Renderer-only roster state with localStorage persistence

Keep main process unchanged; save agent rows in renderer local storage and render from that.

Pros:

- Fastest implementation.

Cons:

- Violates architecture boundary (main owns persisted app state).
- Harder to keep consistent with session creation/runtime events.
- Not acceptable for long-term Slice A integration.

## Recommendation

Proceed with **Approach 1**. It is the smallest change that creates a durable roster contract and aligns with the desktop app architecture.

## Proposed Design

## 1) Shared Data Model (New)

Add `SessionAgentRecord` in `src/shared/types/space.ts` (or a colocated shared type module imported there):

```ts
export const SESSION_AGENT_STATUSES = ['idle', 'running', 'blocked', 'complete'] as const
export type SessionAgentStatus = (typeof SESSION_AGENT_STATUSES)[number]

export const SESSION_AGENT_KINDS = ['system', 'coordinator', 'specialist'] as const
export type SessionAgentKind = (typeof SESSION_AGENT_KINDS)[number]

export type SessionAgentRecord = {
  id: string
  sessionId: string
  name: string
  role: string
  kind: SessionAgentKind
  status: SessionAgentStatus
  avatarColor: string
  delegatedBy?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

Extend `AppState`:

```ts
agentRoster: Record<string, SessionAgentRecord>
```

Rationale:

- Normalized shape prevents duplicate entries and supports targeted updates.
- `sortOrder` supports stable sidebar ordering across relaunches.
- `kind` and `delegatedBy` support current and future sidebar display patterns.

## 2) Persistence and Schema Compatibility

Update `createDefaultAppState()` to include `agentRoster: {}`.

State-store compatibility requirement:

- Loading legacy state files that do not contain `agentRoster` must not reset user spaces/sessions.
- `load()` should coerce missing optional top-level collections to defaults before strict validation or validate with backward-compatible rules.

Validation rules:

- Unknown/invalid roster records are dropped defensively.
- Valid records continue loading even if some entries are malformed.

## 3) Main Process Integration

Add roster lifecycle in main:

- Seed baseline agents when a session is created (`session:create` handler):
  - `Kata Agents` (`kind: system`)
  - `MVP Planning Coordinator` (`kind: coordinator`)
- Keep seeding idempotent (no duplicate roster entries when session is reloaded).

Add IPC query endpoint:

- `session-agent-roster:list` input: `{ sessionId: string }`
- output: `SessionAgentRecord[]` sorted by `sortOrder`, then `createdAt`

Preload bridge:

- Add typed method `sessionAgentRosterList(input)` on `window.kata`.

## 4) Renderer Sidebar Integration

Replace `mockAgents` as data source for the build-session agent view:

- `LeftPanel` (or `AgentsTab`) loads roster by active session through preload API.
- Map `SessionAgentRecord` to existing presentational `AgentCard` props.
- Preserve current collapsible grouped view for background agents:
  - coordinator/system rows at top
  - specialist rows under collapsible summary

Fallback behavior:

- If no active session or roster unavailable, render empty state copy.
- If IPC fails, show non-blocking error text in `AgentsTab` while keeping panel usable.

## 5) Data Flow

1. User creates/open session.
2. Main `session:create` persists session + seeded roster.
3. Renderer loads sidebar and requests `session-agent-roster:list`.
4. Renderer renders persistent roster rows in left sidebar.
5. Future tickets can update roster status/entries without changing sidebar contract.

## 6) Error Handling

- Invalid `sessionId` in list API returns typed error and empty array at renderer boundary.
- Renderer handles promise rejection with inline muted warning (no crash).
- State-store parse/validation logs roster warnings but preserves valid state.

## 7) Testing Strategy (TDD)

Required tests:

- Shared type tests for new enums/record shape.
- `state-store` tests:
  - legacy file without `agentRoster` loads safely
  - malformed roster entries are ignored
  - valid roster entries persist and reload
- `ipc-handlers` tests:
  - `session:create` seeds baseline roster
  - `session-agent-roster:list` returns sorted rows
  - unknown session behavior is deterministic
- Preload tests for new API method.
- Renderer tests (`AgentsTab` and/or `LeftPanel`):
  - uses IPC roster data instead of `mockAgents`
  - renders seeded coordinator/system entries
  - renders empty and error states

Evidence gate for ticket closure:

- Unit test output covering shared/main/preload/renderer changes.
- Screenshot of build-session left sidebar showing persisted roster rows after app reload.

## 8) Non-Goals

- Conversation entry index/jump behavior (KAT-186).
- Approval actions in center conversation (KAT-187).
- Full task tracking parity with mock 14 (KAT-188).
- Full redesign of other left tabs (Context/Changes/Files) beyond roster integration scope.

## Risks and Mitigations

- Risk: strict state validation causes accidental state reset after schema change.  
  Mitigation: implement backward-compatible load path and add explicit regression tests.

- Risk: renderer remains coupled to `mockAgents`.  
  Mitigation: enforce IPC-backed roster in tests and remove direct `mockAgents` dependency from `LeftPanel` runtime path.

- Risk: naming drift across mocks and runtime events.  
  Mitigation: seed canonical baseline names now and treat display label updates as explicit migrations.

## Approval Gate

If this design is approved, next step is to generate the implementation plan using `writing-plans` at:

- `docs/plans/2026-03-02-kat-185-agent-roster-sidebar-build-session-implementation-plan.md`
