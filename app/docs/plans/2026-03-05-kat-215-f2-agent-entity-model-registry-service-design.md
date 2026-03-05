# KAT-215 [F2] Agent Entity Model + Registry Service Design

**Issue:** KAT-215  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-215/f2-agent-entity-model-registry-service  
**Branch target:** `feature/kat-215-f2-agent-entity-model-registry-service`  
**Parent epic:** KAT-167 (Foundations - Shared Orchestrator UI/Data Primitives)  
**Specs:** `_plans/design/specs/02-coordinator-session.md`, `_plans/design/specs/04-build-session.md`, `_plans/design/specs/06-wave-execution.md`, `_plans/design/specs/07-completion-verification.md`

## Scope and Outcome

Define the shared agent identity model and registry contracts used across coordinator, wave execution, and completion views, with persistence-safe state loading in main process.

Required outcome:

- One canonical agent entity contract that supports all four referenced specs.
- Registry service contract that supports seed/list/upsert/status transition operations.
- Backward-compatible state-store behavior for existing saved state.
- No center/right presentation changes in this ticket.

## Context Loaded

Sources reviewed for this design:

- Linear issue KAT-215 + KAT-167 parent epic + all KAT-215 comments.
- Linear docs:
  - `Execution Model: UI Baseline then Parallel Functional Vertical Slices`
  - `Desktop App Linear Workflow Contract`
  - `UI Ticket Fidelity Contract (Desktop App)`
- Spec and mock sources:
  - `_plans/design/specs/02-coordinator-session.md` (mocks 04-07)
  - `_plans/design/specs/04-build-session.md` (mocks 10-14)
  - `_plans/design/specs/06-wave-execution.md` (mocks 18-25)
  - `_plans/design/specs/07-completion-verification.md` (mocks 26-29)
  - `_plans/design/mocks/README.md` and representative mock images (04, 05, 07, 10, 14, 18, 24, 26, 29)
- Current implementation:
  - `src/shared/types/space.ts`
  - `src/shared/types/run.ts`
  - `src/shared/types/task-tracking.ts`
  - `src/main/state-store.ts`
  - `src/main/ipc-handlers.ts`
  - `src/renderer/hooks/useSessionAgentRoster.ts`

## Clarifications and Assumptions

- Worktree contract is respected: owned scope is shared types + `src/main/state-store.ts` + registry/state contracts only.
- As of **March 5, 2026**, Linear `get_issue(includeRelations: true)` shows KAT-215 has no blockers and currently blocks KAT-169. This conflicts with older copied context where KAT-215 appeared blocked by KAT-169.
- KAT-215 is an **Enabler** ticket; final UI fidelity remains owned by consuming tickets (KAT-169, KAT-185, KAT-199).

## Problem Statement

We already have a minimal `SessionAgentRecord` and seeded roster, but it is not yet a full shared registry contract for all surfaces:

- Status vocabulary is too narrow (`idle|running|blocked|complete`) for delegation lifecycle shown in specs (queued/delegating/running/completed/failed).
- No first-class fields for wave grouping and per-run association required by wave/completion surfaces.
- No explicit registry operation contract; behavior is spread between state shape and ad hoc list/sort logic.
- Persistence validation must evolve without wiping legacy state.

## Approaches Considered

### Approach 1 (Recommended): Evolve existing `SessionAgentRecord` into a richer canonical entity + add registry service facade

Keep `AppState.agentRoster` as the persisted container, expand the record and status model, and formalize registry operations in main process.

Pros:

- Lowest migration risk and minimal churn for existing renderer/useSessionAgentRoster wiring.
- Fits ownership boundary and allows incremental adoption by downstream lanes.
- Backward compatibility is straightforward in `state-store`.

Cons:

- Naming remains `agentRoster` even though it behaves as registry storage.
- Requires transitional handling for legacy `complete` vs `completed` status labels.

### Approach 2: Introduce new `agentRegistryBySession` map and deprecate `agentRoster`

Add a new nested store keyed by session and migrate from existing map.

Pros:

- Cleaner long-term naming and explicit indexing.

Cons:

- Bigger migration + dual-read complexity.
- Higher chance of regressions in persistence and existing IPC contracts.

### Approach 3: Derive agents from run/task events only (no persisted registry)

Compute agent lists from run/task data at read time.

Pros:

- Less stored state.

Cons:

- Cannot preserve ordering/identity semantics across sessions reliably.
- Makes cross-surface consistency and future manual edits harder.

## Recommendation

Proceed with **Approach 1**: evolve current roster into a canonical agent entity model and add explicit registry contracts.

## Proposed Design

## 1) Shared Agent Entity Contract

Extend `src/shared/types/space.ts` with a richer, shared contract.

### Status model

```ts
export const SESSION_AGENT_STATUSES = [
  'idle',
  'queued',
  'delegating',
  'running',
  'blocked',
  'completed',
  'failed'
] as const
```

Migration alias rule:

- Persisted legacy value `complete` is accepted on load and normalized to `completed`.

### Kind and surface fields

Retain current kinds and add support for wave/completion semantics via optional fields:

```ts
export type SessionAgentRecord = {
  id: string
  sessionId: string
  name: string
  role: string
  kind: SessionAgentKind
  status: SessionAgentStatus
  avatarColor: string
  delegatedBy?: string
  currentTask?: string
  sortOrder: number
  activeRunId?: string
  waveId?: string
  groupLabel?: string
  lastActivityAt?: string
  createdAt: string
  updatedAt: string
}
```

Rationale:

- `activeRunId` and `waveId` enable wave/completion grouping without introducing parallel entity types.
- `groupLabel` supports sidebar group headings like `Wave 1 Coordinators` / `EPOCH-1`.
- `lastActivityAt` supports stable recency ordering for live updates.

## 2) Registry Service Contract (Main)

Introduce a dedicated registry module contract (implementation in follow-on coding step) used by IPC/runtime handlers.

```ts
type UpsertSessionAgentInput = {
  sessionId: string
  agent: Omit<SessionAgentRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }
}

type ListSessionAgentsOptions = {
  sessionId: string
  runId?: string
  waveId?: string
  includeCompleted?: boolean
}

type SessionAgentRegistry = {
  seedBaselineAgents(sessionId: string, createdAt: string): SessionAgentRecord[]
  upsert(input: UpsertSessionAgentInput): SessionAgentRecord
  transitionStatus(agentId: string, nextStatus: SessionAgentStatus, at: string): SessionAgentRecord
  list(options: ListSessionAgentsOptions): SessionAgentRecord[]
  summarize(sessionId: string): {
    total: number
    queued: number
    running: number
    blocked: number
    completed: number
    failed: number
  }
}
```

Behavioral rules:

- Seeding is idempotent per session.
- Sort order remains deterministic: `sortOrder`, then `updatedAt`, then `createdAt`.
- `transitionStatus` is monotonic for terminal states (`completed|failed` cannot move backward without explicit reset).

## 3) State-Store Compatibility and Validation

Update `src/main/state-store.ts` validation and normalization.

Load rules:

- Accept legacy files without agent fields beyond current baseline.
- Accept legacy `status: complete` and normalize to `completed`.
- Drop malformed registry entries defensively (current behavior retained).
- Continue preserving all valid spaces/sessions/runs even when some agent entries are invalid.

Save rules:

- Persist only normalized statuses.
- Keep atomic write behavior unchanged.

## 4) Cross-Surface Query Projections

Define stable projections from the same registry store.

- Coordinator projection: baseline coordinator/system rows + active delegated specialists.
- Wave projection: filter by `activeRunId`, group by `waveId`/`groupLabel`, include lifecycle statuses.
- Completion projection: include terminal statuses and summary counts.

These are read contracts only; UI components stay out of scope for this ticket.

## 5) Integration Touchpoints

Expected integration points for implementation phase:

- Session creation path seeds baseline rows using registry service (currently inline in `ipc-handlers.ts`).
- Run lifecycle handlers upsert/transition statuses for active specialists.
- Existing `session-agent-roster:list` continues serving sorted records from canonical registry data.

## 6) Error Handling

- Invalid `sessionId` in list/upsert operations returns typed error.
- Unknown `agentId` transition attempts return deterministic no-op error.
- Status transition violations (e.g., terminal to non-terminal) return validation error.
- Fail closed: no partial writes to state.

## 7) Testing Strategy (TDD)

Minimum test coverage for this design:

- Shared type tests:
  - status literal set includes new lifecycle values.
  - legacy alias normalization behavior (`complete` -> `completed`).
- State-store tests:
  - legacy state files still load.
  - invalid agent entries dropped without wiping other state.
  - optional new fields persist and reload.
- Registry service tests:
  - idempotent seeding.
  - upsert and status transitions.
  - deterministic sorting and projection filters (session/run/wave).

Evidence gate for issue completion:

- Test output for shared/main coverage.
- Screenshot or traceable proof from consuming lane showing registry data consumed in UI.

## Non-Goals

- Center panel conversation rendering changes.
- Right panel spec markdown/task rendering changes.
- Permission dialog UI implementation.
- Full wave orchestration runtime redesign.

## Risks and Mitigations

- Risk: status vocabulary drift across existing consumers.
  Mitigation: support legacy alias normalization and preserve old list channel.

- Risk: over-coupling registry to one surface.
  Mitigation: keep model generic (`runId`, `waveId`, `groupLabel` optional).

- Risk: accidental schema regression in persisted files.
  Mitigation: add explicit migration regression tests in `state-store`.

## Approval Gate

If this design is approved, next step is implementation planning (`writing-plans`) for KAT-215 with explicit tasks limited to:

- `src/shared/types/*`
- `src/main/state-store.ts`
- registry/state-contract plumbing required for consumer lanes.

## Implementation Evidence (March 5, 2026)

Implementation completed on branch `feature/kat-215-f2-agent-entity-model-registry-service` with TDD-first updates across shared contracts, state-store normalization, registry service extraction, and IPC registry wiring.

Evidence and verification outputs are recorded in:

- `docs/plans/2026-03-05-kat-215-evidence-package.md`

Key outcomes delivered:

- Expanded `SessionAgentRecord` and `SESSION_AGENT_STATUSES` to support coordinator/build/wave/completion lifecycle requirements.
- Added legacy `complete` -> `completed` normalization during state load while preserving valid extended metadata.
- Introduced `src/main/session-agent-registry.ts` with deterministic list ordering and idempotent baseline seeding.
- Routed `session:create` and `session-agent-roster:list` through the registry service contract.
- Confirmed no center/right presentation edits as part of this ticket.
