# KAT-214 Shared Conversation UI Primitives Package Design

**Issue:** KAT-214  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-214/f1-shared-conversation-ui-primitives-package  
**Parent Epic:** KAT-167 Foundations — Shared Orchestrator UI/Data Primitives  
**Branch target:** `feature/kat-214-f1-shared-conversation-ui-primitives-package`  
**Specs:** `_plans/design/specs/02-coordinator-session.md`, `_plans/design/specs/04-build-session.md`, `_plans/design/specs/06-wave-execution.md`  
**Relevant mocks:** `04-07`, `10-14`, `18-25`

## Scope and Outcome

Standardize shared center-panel conversation primitives for user/agent/status rendering so specs 02, 04, and 06 consume one reusable contract instead of duplicating message UI behavior.

Required outcome:

- Shared primitives for user message, agent message, compact message summary, and run-status badge rendering.
- Deterministic state rendering (`empty`, `pending`, `idle`, `error`) with no per-surface divergence.
- Shared presentation model usable by coordinator session, build session, and wave execution surfaces.
- TDD-backed primitive correctness and composability.

This ticket is an **Enabler**. Final fidelity remains owned by downstream tickets (`KAT-171`, `KAT-175`, `KAT-219`, `KAT-163`).

## Context Loaded

From Linear issue and comments:

- Ownership boundary: `src/renderer/components/center/*` only.
- Out of scope: shared app-state/schema edits in `src/shared/types/*` (KAT-215), right-panel spec/task primitives in `src/renderer/components/right/*` (KAT-218).
- Acceptance bar: primitive correctness, composability, deterministic state rendering.

From project docs:

- Execution model requires reusable building blocks that can be consumed by parallel vertical slices.
- Workflow contract requires evidence-based closure; specs are the acceptance authority.

From specs/mocks and current code:

- Spec 02/04/06 all require chat-style user/agent/status patterns.
- Current center components already contain partial primitives (`MessageBubble`, `RunStatusBadge`, `MessageList`, `MessageActionRow`, `ToolCallResult`, `StreamingIndicator`) but contracts are still surface-coupled and inconsistent at the type boundary.

## Clarified Design Assumptions

- We will not introduce new shared persisted state fields in this ticket.
- Primitives remain renderer-presentational and receive data via adapter functions.
- Existing UX patterns in mocks are normalized into a single role/status/variant matrix.

## Approaches Considered

### Approach 1 (Recommended): Standardize a `center/primitives` contract layer and migrate existing center components to it

Create a stable primitive package inside `src/renderer/components/center/` with shared prop contracts and adapter helpers. Reuse existing files where possible, but enforce one canonical API.

Pros:

- Lowest risk while still delivering true standardization.
- Keeps ownership boundaries intact (center-only).
- Enables downstream tickets to consume primitives without waiting for schema migration.

Cons:

- Some temporary type adapters remain until KAT-215 lands unified shared types.

### Approach 2: Keep components as-is and only add style/token alignment

Retain current component APIs and align visual details by patching class names and small props.

Pros:

- Fastest short-term patching.

Cons:

- Does not solve contract drift.
- Pushes integration complexity to downstream tickets.

### Approach 3: Full cross-layer unification now (including shared types)

Refactor renderer and shared state types together in KAT-214.

Pros:

- Single-step end state.

Cons:

- Violates explicit worktree boundary (KAT-215 ownership).
- Higher merge risk across parallel lanes.

## Recommendation

Proceed with **Approach 1**.

It satisfies the enabler objective: one reusable center primitive package with deterministic rendering and minimal cross-lane conflict.

## Proposed Design

## 1) Primitive Package Structure

Create/normalize this package shape under `src/renderer/components/center/`:

- `primitives/ConversationMessage.tsx` (user/agent/system message renderer)
- `primitives/ConversationMessageActions.tsx` (decision/approval action row)
- `primitives/ConversationStatusBadge.tsx` (run-state badge)
- `primitives/ConversationStream.tsx` (ordered list + scroll-to-message behavior)
- `primitives/ConversationBlocks.tsx` (optional block renderer for chips/tool-call/status rows)
- `primitives/types.ts` (canonical primitive props/types)
- `primitives/adapters.ts` (mappers from existing chat/session message types)
- `primitives/index.ts` (barrel export)

Implementation note: existing files (`MessageBubble`, `RunStatusBadge`, `MessageList`, etc.) can become thin wrappers or be renamed in place to avoid unnecessary churn.

## 2) Canonical Rendering Contract

Define a renderer-local contract (no shared-state changes):

```ts
export type PrimitiveMessageRole = 'user' | 'agent' | 'system'

export type PrimitiveRunState = 'empty' | 'pending' | 'idle' | 'error'

export type PrimitiveMessageVariant = 'default' | 'collapsed'

export type PrimitiveMessage = {
  id: string
  role: PrimitiveMessageRole
  content: string
  createdAt: string
  summary?: string
}
```

Status badge contract:

- `empty` -> `Ready`
- `pending` -> `Thinking` (pulsing indicator)
- `idle` -> `Stopped`
- `error` -> `Error`

This preserves current behavior while making it explicit and reusable for specs 02/04/06.

## 3) Surface Mapping Rules (02 / 04 / 06)

Single primitive set, different presentation composition:

- Spec 02 (Coordinator session): user prompt + optional pasted/context chips + thinking/stopped badge.
- Spec 04 (Build session): user/agent markdown thread + approval action rows + status badge.
- Spec 06 (Wave execution): same message primitives with additional system-style coordinator updates and task/tool result blocks.

Rule: surfaces may compose blocks differently, but must not redefine role/status rendering rules.

## 4) Adapter Boundary

Add adapter functions that map existing inputs to primitive types:

- `ConversationMessage` -> `PrimitiveMessage`
- `ChatMessage` -> `PrimitiveMessage`
- Run state to `PrimitiveRunState`

Adapters live in center renderer only. No shared type changes in this ticket.

## 5) Deterministic Rendering Requirements

- No randomized ordering or implicit timestamp sorting; preserve input order.
- Collapsed summary rendering must be explicit via `variant='collapsed'` + `summary`.
- Status badge display is pure function of run state.
- Decision action rows must disable consistently for pending/resolved states.

## 6) Accessibility Contract

- Status badge remains `role="status"` with `aria-live="polite"`.
- Message stream supports jump-to-message by stable IDs (`message-${id}` pattern).
- Action buttons remain keyboard-triggerable and disabled states are semantic (`disabled` attribute).

## 7) Testing Strategy (TDD)

Unit tests for primitives:

- `ConversationMessage` role + variant matrix rendering.
- `ConversationStatusBadge` mapping for all run states.
- `ConversationStream` scroll-to-message registration behavior.
- `ConversationMessageActions` disabled/pending/resolved behavior.
- Adapter tests for `ChatMessage` and `ConversationMessage` compatibility.

Integration tests:

- `ChatPanel` and `MockChatPanel` render through primitive APIs only.
- Spec 02-like, 04-like, and 06-like fixture sets produce deterministic snapshot output.

## 8) Non-Goals

- Shared app-state/schema changes in `src/shared/types/*`.
- Right panel spec/task markdown rendering changes.
- Agent roster/entity model changes.
- Terminal/embed primitives beyond center message/status composition.

## 9) Risks and Mitigations

- Risk: Wrapper phase leaves duplicate components temporarily.
  - Mitigation: enforce exports from `primitives/index.ts` and migrate call sites in one pass.

- Risk: Visual drift from specs while refactoring names.
  - Mitigation: capture parity screenshots for representative states from mocks 04/10/18.

- Risk: Contract mismatch with upcoming KAT-215 shared type evolution.
  - Mitigation: keep adapters explicit and local so KAT-215 can replace mapper internals without changing primitive props.

## Approval Gate

If approved, next step is implementation planning (task breakdown + test-first sequence) on this branch.
