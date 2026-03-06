# KAT-171 Conversation Message Primitives + Coordinator Status Badges Design

**Issue:** KAT-171  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-171/023-conversation-message-primitives-coordinator-status-badges  
**Parent epic:** KAT-163 Post-Slice A - Coordinator Session Parity (Spec 02)  
**Branch target:** `feature/kat-171-023-conversation-message-primitives-coordinator-status`  
**Specs:** `_plans/design/specs/02-coordinator-session.md`  
**Relevant mocks:** `04-coordinator-session-initial-state.png`, `05-coordinator-session-pasted-context.png`, `06-coordinator-session-spec-context-reading.png`, `07-coordinator-session-spec-analyzing.png`

## Scope and Outcome

Build the reusable center-panel primitives that Spec 02 needs for coordinator conversation rows and coordinator lifecycle badges, without taking ownership of the pasted-content interaction, guided workflow sidebar, or final mock-parity evidence.

Required outcome:

- Reusable message-card primitives for coordinator-facing user and agent rows.
- Deterministic coordinator status badge states for `thinking`, `running`, and `stopped`.
- A composition seam for collapsed/analyzing message presentation shown in mock 07.
- Integration-safe consumption of the shared agent/context contract already present in the codebase.
- Test coverage proving primitive correctness plus integration with the session agent roster contract.

This ticket is an **Enabler**. Final fidelity remains owned by `KAT-175`, `KAT-176`, `KAT-219`, and the parent umbrella `KAT-163`.

## Context Loaded

Sources reviewed for this design:

- Linear issue `KAT-171`, parent epic `KAT-163`, and ticket comments copied into the request.
- Dependency/foundation issues:
  - `KAT-214` shared conversation UI primitives package
  - `KAT-169` agent/context sidebar domain model + state contracts
- Linear project documents:
  - `Execution Model: UI Baseline then Parallel Functional Vertical Slices`
  - `Desktop App Linear Workflow Contract`
  - `UI Ticket Fidelity Contract (Desktop App)`
- Local desktop guidance:
  - `AGENTS.md`
  - `_plans/design/specs/README.md`
  - `_plans/design/specs/02-coordinator-session.md`
  - `_plans/design/mocks/README.md`
  - mock PNGs `04` through `07`
- Current implementation and recent history:
  - `src/renderer/components/center/primitives/*`
  - `src/renderer/components/center/ChatPanel.tsx`
  - `src/renderer/components/center/MessageBubble.tsx`
  - `src/renderer/components/center/mockChatPresentation.ts`
  - `src/shared/types/space.ts`
  - `src/renderer/hooks/useSessionAgentRoster.ts`
  - recent commit history for `KAT-214` and `KAT-215`

## Clarifications and Assumptions

- As of **March 6, 2026**, Linear shows `KAT-171` blocked only by `KAT-214`, which is `Done`; the local codebase already includes the `KAT-214` primitives and the richer session agent roster shape introduced by adjacent foundation work.
- `KAT-169` is still open in Linear, but the contract surface this ticket must consume already exists locally in `src/shared/types/space.ts`. This design therefore treats `SessionAgentRecord` as the read-only contract seam and avoids redefining agent/context models locally.
- `KAT-172` owns pasted-content badge behavior and expand/collapse interaction.
- `KAT-175` owns the guided workflow sidebar and its final integration in the right panel.
- `KAT-178` owns spec/task schema decisions; this ticket does not invent new spec document state.

## Problem Statement

`KAT-214` standardized base conversation primitives, but Spec 02 still needs a coordinator-specific composition layer that those shared pieces do not yet provide:

- The current `ConversationStatusBadge` only exposes `empty | pending | idle | error`, while this ticket explicitly owns the coordinator-facing states `thinking | running | stopped`.
- The current `ConversationMessage` renders body content only. Mock 05 needs a message card shell with timestamp, dismiss affordance, and footer slots for follow-on work like pasted-content badges and model controls.
- Mock 07 requires a compact/collapsed coordinator message representation tied to the same primitive contract rather than a one-off screen implementation.
- The ticket comment requires integration proof using the shared agent/context contract, not locally invented data shapes.

## Approaches Considered

### Approach 1 (Recommended): Extend the shared primitive package with coordinator-specific composition wrappers and status-state adapters

Keep `src/renderer/components/center/primitives` as the source of truth. Add a coordinator-oriented message-card shell, explicit status badge state mapping, and thin adapters from existing conversation/run/agent inputs.

Pros:

- Reuses the `KAT-214` package rather than duplicating it.
- Keeps this ticket inside its enabler scope.
- Preserves a clean seam for `KAT-172` and `KAT-175` to compose on top.
- Minimizes merge risk because shared renderer primitives remain the single contract.

Cons:

- Requires a small contract evolution in the status badge API.
- Some temporary adapters remain until all consuming surfaces standardize on the same status vocabulary.

### Approach 2: Build coordinator-only components beside the shared primitive package

Create a new Spec 02-specific component set in the coordinator view layer and leave existing shared primitives untouched.

Pros:

- Fastest path to a single-surface mock match.

Cons:

- Reintroduces drift immediately after `KAT-214`.
- Makes later wave/build/completion parity work harder.
- Violates the ticket's purpose as a reusable primitive owner.

### Approach 3: Fully integrate ChatPanel, pasted badge, workflow sidebar, and status semantics in one ticket

Use this ticket to finish the full center/right coordinator state stack.

Pros:

- Fewer intermediate abstractions.

Cons:

- Collides with `KAT-172`, `KAT-175`, and `KAT-176` ownership boundaries.
- Blurs enabler vs final-fidelity responsibilities.
- Increases the chance of hidden contract churn with still-open tickets.

## Recommendation

Proceed with **Approach 1**.

It satisfies the ticket's actual scope: establish the reusable message/status building blocks that Spec 02 needs, while leaving higher-level stateful interactions and final fidelity to their owner tickets.

## Proposed Design

## 1) Primitive Ownership Boundary

This ticket should own only the coordinator-facing presentation primitives and adapters inside the renderer center panel:

- `ConversationMessageCard` or equivalent wrapper that composes the existing `ConversationMessage` body renderer with metadata and footer slots
- `ConversationStatusBadge` evolution for coordinator badge states
- collapsed-summary rendering used by analyzing state
- adapter helpers that map existing run/session/agent inputs into those primitives

This ticket should not own:

- pasted-content line counting or expand/collapse logic
- right-panel workflow content
- spec document editing state
- agent registry mutation/persistence

## 2) Status Badge Contract

Replace the current badge contract of "domain run state in, label out" with an explicit primitive badge state:

```ts
export type CoordinatorStatusBadgeState =
  | 'ready'
  | 'thinking'
  | 'running'
  | 'stopped'
  | 'error'
```

Label and tone mapping:

- `ready` -> `Ready`
- `thinking` -> `Thinking`
- `running` -> `Running`
- `stopped` -> `Stopped`
- `error` -> `Error`

Adapter rules:

- `ConversationRunState.pending` maps to `thinking`
- `ConversationRunState.idle` maps to `stopped`
- `ConversationRunState.empty` maps to `ready`
- `ConversationRunState.error` maps to `error`
- `RunRecord.status.running` or an active `SessionAgentRecord.status` in `queued | delegating | running` may map to `running` when the coordinator surface is showing delegated execution rather than pure prompt-analysis

This separates the primitive's visual contract from any single upstream runtime enum and gives downstream tickets one deterministic badge API.

## 3) Message Card Primitive

Add a coordinator-ready message card wrapper around the existing shared body renderer. Proposed renderer-local shape:

```ts
type ConversationMessageCardProps = {
  message: PrimitiveMessage
  variant?: 'default' | 'collapsed'
  timestampLabel?: string
  agentLabel?: string
  onDismiss?: () => void
  metadata?: ReactNode
  footer?: ReactNode
}
```

Behavior:

- `default` renders the full message body using the existing markdown/plain-text logic from `ConversationMessage`.
- `collapsed` renders `summary` instead of full content and preserves the existing dashed/compact treatment from the shared primitive.
- `timestampLabel` supports mock 05's `Just now` and similar coordinator timestamps.
- `onDismiss` provides the top-right close affordance without coupling dismissal behavior to storage or navigation.
- `metadata` supports a light-weight line for context labels or note counts.
- `footer` is the extension seam for `KAT-172` pasted-content badge and model/action rows.

This keeps the current body renderer intact while adding the message shell the coordinator mocks actually show.

## 4) Compact/Analyzing Representation

Mock 07 should reuse the same message primitive rather than inventing a separate list item type.

Rule:

- The compact analyzing state is a `ConversationMessageCard` rendered with `variant='collapsed'`.
- The summary source is explicit: either a provided `message.summary` or a deterministic summarizer already used by `mockChatPresentation.ts`.
- Supporting labels like `Pasted content text` or `2 notes context text` should live in `metadata`, not in the core message body contract.

This keeps the collapsed state compositional and testable.

## 5) Integration with Agent/Context Contract

This ticket must consume the shared contract rather than shadowing it.

Integration rules:

- Import `SessionAgentRecord` from `src/shared/types/space.ts` for coordinator/agent identity fixtures in tests.
- Do not define a local `CoordinatorAgent` type.
- If agent roster data is absent, primitives still render from message/run inputs alone.
- When agent data is present, it is used only to derive visible labels or activity state, not to mutate store state.

For context chips:

- Keep the primitive contract display-oriented: accept already formatted chip labels.
- Do not introduce a new persisted `ContextSnippet` schema in this ticket.

## 6) Surface Mapping for Spec 02 States

The same primitive set should cover all four referenced states:

- Mock 04 initial state:
  - expanded user message card
  - `thinking` badge
- Mock 05 pasted context:
  - expanded user message card with timestamp
  - footer slot populated by `KAT-172` badge later
  - `stopped` badge
- Mock 06 context reading:
  - expanded user message card
  - metadata or adjacent chip row for context labels
  - `thinking` badge
- Mock 07 analyzing:
  - collapsed message card with summary
  - metadata row for pasted-content and notes-context indicators
  - `thinking` badge

This gives `KAT-175` and `KAT-176` a stable center-panel contract to integrate and verify against.

## 7) Testing Strategy (TDD)

Unit coverage required by this design:

- `ConversationStatusBadge` renders all five visual states, especially `thinking`, `running`, and `stopped`.
- status adapters map conversation and persisted run inputs deterministically.
- `ConversationMessageCard` renders:
  - user vs agent labels
  - timestamp line
  - dismiss button when supplied
  - footer slot content
  - collapsed summary behavior
- collapsed analyzing state uses summary text and hides full body content.

Integration coverage required by the ticket comment:

- A renderer integration test uses real `SessionAgentRecord` fixtures from `src/shared/types/space.ts`, not duplicated local shapes.
- A conversation fixture proves coordinator primitives still render correctly when agent roster data is present and when it is absent.
- Existing `ChatPanel` or mock coordinator presentation tests are updated to consume the new primitive API rather than bypassing it.

## 8) Non-Goals

- Implementing pasted-content expand/collapse behavior (`KAT-172`)
- Building the guided workflow sidebar (`KAT-175`)
- Final state-parity screenshots and E2E evidence (`KAT-176`)
- Defining new persisted context/spec schemas (`KAT-178`)
- Agent registry persistence or lifecycle mutations (`KAT-169` / `KAT-215`)

## 9) Risks and Mitigations

- Risk: `running` means different things across prompt analysis vs delegated execution.
  - Mitigation: use explicit adapter functions so the primitive state is stable even if upstream lifecycle enums differ.

- Risk: coordinator-specific message shell duplicates too much of the shared body primitive.
  - Mitigation: keep the new card wrapper as composition around `ConversationMessage`, not a replacement for it.

- Risk: open Linear state for `KAT-169` implies future contract adjustments.
  - Mitigation: import the current shared type directly and isolate any mismatch through a small adapter layer.

- Risk: downstream tickets bolt on footer/actions inconsistently.
  - Mitigation: standardize `metadata` and `footer` extension points now, so later work plugs into one card layout.

## Approval Gate

If this design is accepted, the next step is an implementation plan that starts with failing primitive tests, then updates the shared center primitives and their consuming coordinator presentation tests.
