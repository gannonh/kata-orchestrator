# KAT-169 [02.1] Agent/context sidebar domain model + state contracts Design

**Issue:** KAT-169  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-169/021-agentcontext-sidebar-domain-model-state-contracts  
**Branch target:** `feature/kat-169-021-agentcontext-sidebar-domain-model-state-contracts`  
**Parent epic:** KAT-163 Post-Slice A - Coordinator Session Parity (Spec 02)  
**Specs:** `_plans/design/specs/02-coordinator-session.md`  
**Relevant mocks:** `04-coordinator-session-initial-state.png`, `05-coordinator-session-pasted-context.png`, `06-coordinator-session-spec-context-reading.png`, `07-coordinator-session-spec-analyzing.png`

## Scope and Outcome

Define the canonical coordinator-session data contracts for:

- session-scoped agent roster inputs used by the left sidebar
- session-scoped context resource inputs used by the left sidebar
- run/session selectors that downstream center/sidebar tickets consume as read-only inputs

This ticket is an **Enabler**. It owns data shape, normalization, and selector behavior only. It does **not** own:

- conversation rendering primitives (`KAT-171`)
- guided workflow/sidebar presentation (`KAT-170`, `KAT-175`)
- spec/task rendering contracts (`KAT-178`)
- pasted-content interaction details (`KAT-172`)

Required outcome:

- one stable coordinator-session contract surface for agent rows and context items
- shared selectors/adapters that remove mock-only parsing from downstream UI work
- tests that lock the selector outputs and persistence compatibility

## Context Loaded

Sources reviewed for this design:

- Linear:
  - KAT-169 issue, comments, and blocker relation
  - KAT-215 (`Done` as of March 6, 2026) because it owns the upstream agent registry
  - KAT-163 parent epic
  - KAT-171 as the first downstream center consumer
- Linear documents:
  - `Execution Model: UI Baseline then Parallel Functional Vertical Slices`
  - `Desktop App Linear Workflow Contract`
  - `UI Ticket Fidelity Contract (Desktop App)`
- Specs and mocks:
  - `_plans/design/specs/README.md`
  - `_plans/design/specs/02-coordinator-session.md`
  - `_plans/design/mocks/README.md`
  - local mock images `04` through `07`
- Current implementation:
  - `src/shared/types/space.ts`
  - `src/shared/types/run.ts`
  - `src/main/state-store.ts`
  - `src/main/ipc-handlers.ts`
  - `src/main/session-agent-registry.ts`
  - `src/preload/index.ts`
  - `src/renderer/hooks/useSessionAgentRoster.ts`
  - `src/renderer/types/agent.ts`
  - `src/renderer/components/layout/LeftPanel.tsx`
  - `src/renderer/components/left/AgentsTab.tsx`
  - `src/renderer/components/left/ContextTab.tsx`
  - `src/renderer/components/center/mockChatPresentation.ts`
- Relevant prior local design docs:
  - `docs/plans/2026-03-05-kat-215-f2-agent-entity-model-registry-service-design.md`
  - `docs/plans/2026-03-05-kat-214-shared-conversation-ui-primitives-design.md`
  - `docs/plans/2026-03-02-kat-185-agent-roster-sidebar-build-session-design.md`

## Current State Summary

The upstream registry work from KAT-215 is present and stable:

- `AppState.agentRoster` persists canonical `SessionAgentRecord` entries.
- `session:create` seeds baseline roster rows.
- `session-agent-roster:list` returns sorted registry entries.

The coordinator-sidebar contract still does not exist:

- renderer consumers only have a generic `AgentSummary` shape, not a coordinator-session-specific read model
- left Context tab is still driven by mock project tasks and `./notes` copy unrelated to Spec 02
- `RunRecord` persists prompt/messages/draft but no typed context references
- center analyzing/context-reading states still rely on hardcoded chips and text heuristics in `mockChatPresentation.ts`

That means downstream tickets currently lack a stable, non-presentational source for:

- prompt preview text shown under the coordinator row
- the `Spec` context item shown in the left sidebar
- the run-specific context references shown as chips during mock 06
- the compact context summary signal used in mock 07

## Clarifications and Assumptions

- Reuse `SessionAgentRecord` from KAT-215 as the canonical stored agent entity. KAT-169 should not redefine or fork agent persistence.
- Introduce coordinator-specific read models instead of pushing UI-only fields such as prompt preview into `SessionAgentRecord`.
- Model context in two layers:
  - session resources that exist independently of a run (`Spec`, future notes/manual additions)
  - run references that capture which context inputs were consumed during a specific run
- `Spec` should be available as a coordinator context resource even before a run has produced a draft.
- Downstream UI tickets should consume selector outputs only, not parse prompt text or hardcode chip labels.

## Approaches Considered

### Approach 1 (Recommended): Session context resources + run context references + coordinator selectors

Keep agents in the existing registry from KAT-215, add first-class context contracts, and publish coordinator-specific selectors/adapters that derive read models for sidebar and center tickets.

Pros:

- Preserves the clean ownership split with KAT-215.
- Gives KAT-170/KAT-171 a stable public contract without forcing them to inspect raw state.
- Removes current hardcoded context-chip and prompt-summary heuristics from renderer presentation code.
- Scales to future manual context items and run-specific context consumption.

Cons:

- Requires coordinated updates across shared types, state-store normalization, main runtime wiring, preload IPC, and selector tests.
- Introduces one more domain layer between persistence and UI.

### Approach 2: Renderer-only selectors over existing `runs/specDocuments/agentRoster` with no schema changes

Define selectors in renderer only and infer context items from spec presence, run prompt text, and existing messages.

Pros:

- Lowest implementation cost.
- Minimal cross-layer change.

Cons:

- Leaves context as an implicit convention instead of a contract.
- Forces KAT-171 to keep using heuristic parsing for mock 06/07.
- Makes future `Add context` flows harder because no canonical stored context entity exists.

### Approach 3: Push all coordinator-sidebar fields directly into persisted agent/session state

Persist prompt preview, compact summaries, and sidebar display strings directly on `SessionAgentRecord` or `SessionRecord`.

Pros:

- Straightforward UI consumption.
- Fewer selectors in the short term.

Cons:

- Pollutes shared persistence with presentation-specific data.
- Creates drift between canonical source data and rendered strings.
- Increases migration churn for future copy/layout updates.

## Recommendation

Proceed with **Approach 1**.

It keeps KAT-215 as the owner of raw agent persistence while making KAT-169 the owner of coordinator-session contracts. The public contract should be selector-first: downstream tickets receive stable read-only shapes that already encode coordinator semantics.

## Proposed Design

## 1) Coordinator Domain Package

Add a dedicated coordinator-session domain layer, separate from presentational components.

Recommended location:

- `src/renderer/features/coordinator-session/domain/` or
- `src/renderer/components/center/domain/` if the team wants to stay inside existing renderer boundaries

Required exports:

- canonical coordinator read-model types
- pure selectors/adapters from persisted state/runtime state to those read models
- no JSX and no styling concerns

## 2) Persisted Context Contracts

Keep agents in `AppState.agentRoster` unchanged.

Add two new context contracts:

### Session context resource

Represents durable, session-scoped context that can appear in the left sidebar.

```ts
export const SESSION_CONTEXT_RESOURCE_KINDS = [
  'spec',
  'note',
  'workspace-file',
  'manual'
] as const

export type SessionContextResourceKind =
  (typeof SESSION_CONTEXT_RESOURCE_KINDS)[number]

export type SessionContextResourceRecord = {
  id: string
  sessionId: string
  kind: SessionContextResourceKind
  label: string
  sourcePath?: string
  description?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

Top-level persistence:

```ts
type AppState = {
  ...
  contextResources: Record<string, SessionContextResourceRecord>
}
```

Seed rule:

- `session:create` must seed one baseline resource:
  - `Spec`
  - `kind: 'spec'`
  - deterministic `sortOrder: 0`

### Run context reference

Represents a run-scoped reference consumed during prompt analysis and context reading.

```ts
export const RUN_CONTEXT_REFERENCE_KINDS = [
  'pasted-text',
  'resource',
  'workspace-snippet'
] as const

export type RunContextReferenceKind =
  (typeof RUN_CONTEXT_REFERENCE_KINDS)[number]

export type RunContextReferenceRecord = {
  id: string
  kind: RunContextReferenceKind
  label: string
  resourceId?: string
  excerpt?: string
  lineCount?: number
  sortOrder: number
  capturedAt: string
}
```

Attach references to `RunRecord`:

```ts
type RunRecord = {
  ...
  contextReferences?: RunContextReferenceRecord[]
}
```

Rationale:

- session resources power the left sidebar
- run references power the mock 06 chips and mock 07 compact context summary
- one run can consume multiple context sources without mutating the underlying resource definitions

## 3) Coordinator Read Models

Publish UI-facing read models that downstream tickets consume instead of raw records.

### Agent roster item

```ts
export type CoordinatorAgentListItem = {
  id: string
  name: string
  role: string
  kind: SessionAgentKind
  status: SessionAgentStatus
  avatarColor: string
  promptPreview: string | null
  currentTask: string | null
  isPrimary: boolean
  delegatedBy?: string
  updatedAt: string
}
```

Rules:

- `promptPreview` is derived from the latest run for the session, not stored on the agent.
- baseline coordinator row is marked `isPrimary: true`.
- background/delegated grouping remains a consumer concern; selector only exposes enough data to support it.

### Sidebar context item

```ts
export type CoordinatorContextListItem = {
  id: string
  label: string
  kind: SessionContextResourceKind
  description?: string
  sourcePath?: string
  lastReferencedRunId?: string
  updatedAt: string
}
```

Rules:

- `Spec` must always be present for a valid session.
- `lastReferencedRunId` is derived by scanning latest run references for a matching `resourceId`.
- no presentation-only flags such as `selected`, `collapsed`, or icon names belong in this contract.

### Run context chip

```ts
export type CoordinatorRunContextChip = {
  id: string
  label: string
  kind: RunContextReferenceKind
  lineCount?: number
}
```

### Compact context summary

```ts
export type CoordinatorRunContextSummary = {
  referenceCount: number
  pastedLineCount?: number
  labels: string[]
}
```

This is the contract KAT-171 should use for the analyzing-state summary instead of parsing raw prompt text.

## 4) Selector Surface

The public selector surface for KAT-169 should be narrow and stable.

Recommended exports:

```ts
type CoordinatorContractState = Pick<
  AppState,
  'sessions' | 'runs' | 'agentRoster' | 'specDocuments' | 'contextResources'
>

export function selectCoordinatorAgentList(
  state: CoordinatorContractState,
  sessionId: string
): CoordinatorAgentListItem[]

export function selectCoordinatorContextItems(
  state: CoordinatorContractState,
  sessionId: string
): CoordinatorContextListItem[]

export function selectCoordinatorActiveRunContextChips(
  state: CoordinatorContractState,
  sessionId: string
): CoordinatorRunContextChip[]

export function selectCoordinatorActiveRunContextSummary(
  state: CoordinatorContractState,
  sessionId: string
): CoordinatorRunContextSummary | null

export function selectCoordinatorPromptPreview(
  state: CoordinatorContractState,
  sessionId: string
): string | null
```

Selection rules:

- latest run for a session is the newest by `createdAt`
- prompt preview is a trimmed single-line excerpt of latest run prompt
- context chips preserve `sortOrder` from `contextReferences`
- missing context references yield `[]`, not `null`
- missing session yields deterministic empty results instead of thrown errors at the selector boundary

## 5) Main Process Wiring

Required state/runtime wiring:

- `createDefaultAppState()` adds `contextResources: {}`
- `state-store` validates and normalizes `contextResources`
- `session:create` seeds baseline `Spec` context resource alongside agent seeding
- `run:submit` creates `RunRecord` with empty `contextReferences`
- runtime handlers gain an explicit path to upsert/replace `run.contextReferences`

Because the current runtime does not yet call a real `retrieveContext()` service, KAT-169 should define a minimal setter/update seam now rather than hardcode renderer-side placeholders later.

Recommended main contract:

```ts
type ReplaceRunContextReferencesInput = {
  runId: string
  references: RunContextReferenceRecord[]
}
```

This can initially be exercised by tests and follow-on runtime work, even if the first shipping UI still shows only baseline/fallback data.

## 6) Preload and IPC Surface

Add a typed IPC read path for context resources.

Recommended API:

- `session-context-resources:list` input `{ sessionId: string }`
- output `SessionContextResourceRecord[]`

Preload:

```ts
sessionContextResourcesList: (input: { sessionId: string }) =>
  Promise<SessionContextResourceRecord[]>
```

Why add IPC if selectors also exist:

- left/sidebar consumers already fetch session-scoped data through preload APIs
- keeping context-resource reads parallel to roster reads simplifies KAT-170 wiring
- raw IPC stays storage-oriented while KAT-169 selectors remain the public UI contract

## 7) Backward Compatibility Rules

State-store load behavior must remain tolerant:

- legacy state with no `contextResources` still loads
- legacy runs with no `contextReferences` still load
- malformed context resources or context references are dropped defensively
- valid spaces, sessions, runs, spec documents, and agent roster entries must survive partial context corruption

This follows the same compatibility standard already used for `agentRoster`.

## 8) Downstream Consumption Contract

### KAT-170

Consumes:

- `selectCoordinatorAgentList`
- `selectCoordinatorContextItems`

KAT-170 should not know about raw `SessionAgentRecord` or `SessionContextResourceRecord`.

### KAT-171

Consumes:

- `selectCoordinatorPromptPreview`
- `selectCoordinatorActiveRunContextChips`
- `selectCoordinatorActiveRunContextSummary`

KAT-171 should not hardcode `# Kata Cloud (Kata V2)` or `## Context...` in presentation code once this contract exists.

### KAT-172 and later

Can extend the same `RunContextReferenceRecord` contract for pasted-text metadata without changing the selector names.

## 9) Testing Strategy (TDD)

Minimum required test coverage:

### Shared type and state tests

- `contextResources` exists in `createDefaultAppState()`
- `SessionContextResourceRecord` and `RunContextReferenceRecord` type fixtures compile and round-trip
- legacy state without new fields still loads
- malformed context resources or run references are dropped without wiping valid state

### Main/IPC tests

- `session:create` seeds `Spec` context resource idempotently per session
- `session-context-resources:list` returns sorted resources for a session only
- `RunRecord.contextReferences` persists and reloads

### Selector tests

- agent list derives coordinator prompt preview from latest run
- context items always include `Spec` for seeded sessions
- context chips preserve `sortOrder`
- compact context summary counts labels/line counts correctly
- selectors return deterministic empty outputs for unknown sessions

### Regression target

Add tests that prove the coordinator contract can replace the current hardcoded chips/summaries in `mockChatPresentation.ts` without changing the selector surface.

## 10) Non-Goals

- rendering sidebar rows, chips, or badges
- implementing add-context modal/picker UX
- deciding final collapsed/expanded behavior for left sidebar sections
- introducing pasted-content badge UI or message dismissal controls
- changing agent lifecycle semantics already owned by KAT-215

## 11) Risks and Mitigations

- Risk: context contracts become too UI-shaped and leak presentation details into persistence.
  Mitigation: keep persisted types source-oriented and publish UI-facing coordinator read models separately.

- Risk: downstream tickets continue using heuristics because selector coverage is incomplete.
  Mitigation: make `selectCoordinatorActiveRunContextChips` and `selectCoordinatorActiveRunContextSummary` part of the required exported surface for KAT-169.

- Risk: adding both session resources and run references feels heavier than the current UI needs.
  Mitigation: seed only `Spec` initially and keep runtime reference updates append/replace-only until richer context retrieval lands.

## Draft Recommendation for Approval

Approve the contract split below:

1. Keep raw agent persistence in `agentRoster` from KAT-215.
2. Add persisted `contextResources` at session scope.
3. Add `contextReferences` at run scope.
4. Publish coordinator selectors as the only downstream UI contract.

If approved, the next step is an implementation plan that writes failing tests first for:

- state-store compatibility
- `session:create` context-resource seeding
- coordinator selectors for agent preview and context references
