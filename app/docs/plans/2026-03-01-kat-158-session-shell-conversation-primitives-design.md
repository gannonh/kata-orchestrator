# KAT-158 Session Shell + Conversation Primitives Design

**Issue:** KAT-158  
**Branch:** `feature/kat-158-a1-session-shell-conversation-primitives-minimum-0204`  
**Specs:** `app/_plans/design/specs/02-coordinator-session.md`, `app/_plans/design/specs/04-build-session.md`

## Scope and Outcome

Deliver the minimum renderer shell needed for Slice A demo readiness:

- Left/context, center conversation, and right spec panel layout parity (minimum viable)
- Conversation primitives:
  - message list
  - user message bubble
  - agent message bubble
  - run status badge
- Prompt input bar with deterministic `empty`, `loading/pending`, and `error` states
- Unit coverage for shell state transitions and message rendering

This ticket intentionally stops before real orchestrator lifecycle integration (`KAT-159`).

## Approaches Considered

### Approach 1 (Recommended): Adapt Existing Renderer Shell + Mock Chat Stack

Use current `AppShell`, `LeftPanel`, `CenterPanel`, `RightPanel`, and center chat primitives as the base. Add a small deterministic session-shell state layer and wire the center panel to explicit pre-run/pending/error transitions.

Pros:
- Lowest delivery risk and fastest path to demo checkpoint
- Reuses existing test coverage foundations
- Keeps `KAT-158` scoped to UI shell and primitives while preserving a clean handoff to `KAT-159`

Cons:
- Temporary local state adapter to be replaced/connected later
- Some mock naming may survive until follow-up cleanup

### Approach 2: New Slice-A-Specific Shell Components

Build new `BuildSessionShell` with dedicated left/center/right feature components and route around existing shared panel scaffolding.

Pros:
- Very explicit separation between mock baseline and production session flow
- Cleaner conceptual mapping to spec terminology

Cons:
- Larger churn and duplicate layout logic
- Higher regression risk for already-tested shell behaviors
- Slower path to checkpoint

### Approach 3: Pull Real Runtime Wiring Into This Ticket

Include provider/context/run lifecycle wiring now and merge part of `KAT-159` into `KAT-158`.

Pros:
- Fewer handoffs across adjacent tickets

Cons:
- Violates current queue sequencing
- Increases scope and failure surface
- Weakens deterministic-state testing requirement for this ticket

## Recommendation

Proceed with **Approach 1**. It gives deterministic UI states and layout parity quickly, keeps this ticket isolated to the design-spec minimum, and sets up `KAT-159` to replace adapter state with real runtime data without rewriting the shell.

## Proposed Design

## 1) Shell Composition (Minimum 02/04 Parity)

- Keep `AppShell` grid/resizer infrastructure.
- Keep existing three-region composition:
  - left: `LeftPanel`
  - center: `CenterPanel`
  - right: `RightPanel`
- Tune copy/labels and section defaults to match minimum parity expectations for Slice A demo states (not full post-slice parity).

Design intent: reuse stable layout mechanics and constrain this ticket to behavior/state and conversation primitives.

## 2) Conversation Primitive Contract

Introduce or normalize a minimal session conversation model in renderer state:

```ts
type SessionMessageRole = 'user' | 'agent'

type SessionMessage = {
  id: string
  role: SessionMessageRole
  content: string
  createdAt: string
}

type RunUiStatus = 'empty' | 'pending' | 'error' | 'idle'
```

Primitive behavior:

- `MessageList`: ordered render + auto-scroll on append
- `UserMessageBubble`: right-aligned plain text bubble
- `AgentMessageBubble`: left-aligned markdown-capable bubble
- `RunStatusBadge`: visual status chip for `pending`, `idle`, `error`

## 3) Deterministic Prompt Input + Session State Machine

Use a local reducer/controller for predictable transitions:

- `empty` (no submitted prompt yet, idle shell)
- `pending` (prompt submitted, run started but unresolved)
- `error` (simulated/forced failure branch for deterministic UI proof)
- `idle` (non-empty message history with no active run)

Core transitions:

1. `SUBMIT_PROMPT` from `empty|idle` -> append user message -> `pending`
2. `RUN_PENDING_TIMEOUT_OR_COMPLETE` -> append agent message (or keep pending based on mode) -> `idle`
3. `RUN_FAILED` -> `error` with retained message history
4. `RETRY_FROM_ERROR` -> `pending`
5. `CLEAR_INPUT` does not alter run state

Input bar rules:

- Submit disabled for trimmed-empty text
- Enter submits, Shift+Enter inserts newline
- While `pending`, submit action disabled (deterministic no-concurrency behavior for this ticket)
- Error state displays deterministic retry affordance

## 4) Right Panel and Left Context for This Ticket

`KAT-158` will not implement full agent roster/task index parity from later tickets. Minimum behavior:

- Left panel remains visible and structurally aligned as session shell context column
- Right panel remains visible as spec column with existing spec tab content
- Center panel drives the demo checkpoint behavior

This satisfies minimum shell parity needed to run Slice A end-to-end pre-run/pending demos.

## 5) Testing Strategy (TDD)

Required unit coverage:

- State transition tests for reducer/controller:
  - `empty -> pending` on submit
  - `pending -> idle` success path
  - `pending -> error` failure path
  - `error -> pending` retry path
- Rendering tests:
  - user bubble vs agent bubble role rendering
  - run status badge variants
  - message list appends and auto-scroll behavior
- Input tests:
  - disabled submit for empty input
  - Enter submit and Shift+Enter newline
  - pending-state submit lock

Primary state screenshot evidence (required by issue):

1. Empty pre-run shell
2. Pending run shell after submit
3. Error shell
4. Idle shell with rendered message history (recommended, even if not hard-required)

## 6) Non-Goals

- Real orchestrator provider/context/state wiring (`KAT-159`)
- Full spec panel structured parsing/task toggles (`KAT-160`)
- Persistence and resume across relaunch (`KAT-161`)
- Full left-lane agent/task/conversation index parity (`KAT-185+`)

## Risks and Mitigations

- Risk: Over-coupling temporary state logic to mock hooks.
  - Mitigation: isolate reducer/controller in a small module with typed events and tests; wire through props.
- Risk: Visual drift against spec references.
  - Mitigation: capture required screenshots and compare against 02/04 minimum state expectations before closing.
- Risk: Ambiguous pending vs idle transitions in demo.
  - Mitigation: enforce deterministic single-run state machine and explicit test assertions for each transition.

## Approval Gate

If approved, next step is to generate the implementation plan via `writing-plans` at:

- `docs/plans/2026-03-01-kat-158-session-shell-conversation-primitives-implementation-plan.md`
