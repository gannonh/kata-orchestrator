# KAT-187 Approval Actions in Conversation (Tech Stack / Plan Decisions) Design

**Issue:** KAT-187  
**Parent:** KAT-157 (Slice A - Build Session / Spec 04)  
**Branch target:** `feature/kat-187-a8-approval-actions-in-conversation-tech-stackplan-decisions`  
**Specs:** `_plans/design/specs/04-build-session.md` (primary), `_plans/design/specs/02-coordinator-session.md`, `_plans/design/specs/03-spec-notes-panel.md`

## Scope and Outcome

Deliver inline decision actions in the center conversation thread for mock 12/13 style planning states.

Required behavior:

- Render decision/approval actions directly under qualifying agent messages in the conversation
- Support the tech-stack/plan decision flow (approve, alternative choice, reorder/clarify path)
- Keep decisions visible in conversation history and compatible with current run persistence/replay
- Keep left-sidebar task parity work out of scope (KAT-188)

## Current State Summary

From current app code:

- Conversation messages are persisted as plain `RunRecord.messages` (`user`/`agent`, string content only).
- `ChatPanel` renders `MessageBubble` entries and `ChatInput`; no inline message actions exist.
- `useIpcSessionConversation` replays persisted runs and rehydrates conversation state.
- Right panel structured spec flow already exists (KAT-160), including `latestDraft` apply and task toggles.
- KAT-186 is marked `Done` in Linear (conversation index/jump behavior), but this design does not require coupling to that feature to ship KAT-187.

## Constraints and Assumptions

- KAT-160 and KAT-186 are complete dependencies for KAT-187 in Linear as of **March 3, 2026**.
- KAT-187 should not introduce a broad orchestrator protocol rewrite; it should fit the existing run/message pipeline.
- Action click behavior should not bypass the existing message-submit lifecycle; decisions should remain auditable in conversation history.
- The design should preserve a migration path to richer structured decision payloads later.

## Approaches Considered

### Approach 1: Renderer-Only Action Inference from Agent Message Content (Recommended)

Parse agent message markdown for decision markers and render inline action buttons beneath that message. Clicking a button submits a deterministic follow-up user message through the existing `run:submit` path.

Pros:

- Minimal architecture change; no new IPC contracts required for v1
- Works with current persisted message model and replay semantics
- Keeps decisions auditable because choice is emitted as a real user message

Cons:

- Requires robust but heuristic parsing of agent text patterns
- Action availability depends on message shape consistency

### Approach 2: Structured Decision Payload from Main Process Runtime

Extend runtime events so agent messages can carry typed `decisionCard` metadata (prompt, options, intent IDs) separate from raw markdown.

Pros:

- Clean contract, deterministic rendering, no text heuristics
- Better long-term foundation for advanced orchestration actions

Cons:

- Larger scope: IPC/event/state schema changes across main/preload/renderer
- Not necessary to deliver KAT-187 UI slice quickly

### Approach 3: Right-Panel Decision Queue (Non-inline)

Show decision actions in the right panel only, not in conversation bubbles.

Pros:

- Reuses right-panel interaction patterns

Cons:

- Violates mock intent (actions are inline in conversation)
- Creates split mental model between message context and decision controls

## Recommendation

Proceed with **Approach 1**.

It is the best fit for current code and ticket scope: fast to ship, testable, and preserves message-history truth without introducing high-risk state/IPC migrations.

## Proposed Design

## 1) Decision Card Detection Contract

Add a renderer parser that extracts an `InlineDecisionCard` from an agent message when the message includes a recognized decision prompt block.

Proposed model:

```ts
type InlineDecisionAction = {
  id: 'approve_plan' | 'switch_to_tauri' | 'adjust_wave_order'
  label: string
  followUpPrompt: string
  tone: 'primary' | 'secondary' | 'ghost'
}

type InlineDecisionCard = {
  messageId: string
  title: string
  actions: InlineDecisionAction[]
}
```

Detection strategy:

- Parse message markdown paragraphs/lists.
- Match decision-trigger text near the tail of agent output (e.g., “Please review and approve the plan above”).
- Read immediate bullet/action lines as candidate options.
- If a full card cannot be inferred, render message normally (no actions).

## 2) UI Rendering in Center Conversation

Extend `MessageBubble` (agent variant) to optionally render a compact action row below markdown content.

- Use existing `Button` variants for primary/secondary affordances.
- Ensure actions are keyboard reachable and screen-reader labeled.
- Preserve existing message rendering for all non-decision messages.

New/updated components:

- `src/renderer/components/center/MessageBubble.tsx` (action row slot)
- `src/renderer/components/center/MessageActionRow.tsx` (new)
- `src/renderer/components/center/message-decision-parser.ts` (new)

## 3) Action Click Behavior

Clicking an inline action should:

1. Submit `followUpPrompt` via existing `submitPrompt` flow from `useIpcSessionConversation`.
2. Append user message through normal reducer/event path (already persisted).
3. Trigger orchestrator response naturally (pending -> idle/error lifecycle unchanged).

This keeps decision traceability in run history without new persistence primitives.

## 4) Replay and Resolved-State Behavior

Resolved state is derived, not separately persisted:

- A decision card is considered “resolved” if the next user message equals one of the card action prompts.
- Resolved cards render as disabled with a lightweight “Decision sent” treatment.
- On session replay, the same derivation restores resolution without schema changes.

## 5) Integration with Existing Spec Flow

KAT-187 should not directly mutate right-panel task state.

Interaction boundary:

- Decision action triggers next run turn.
- Any spec changes continue to flow through existing run/draft behavior (`latestDraft` -> right panel apply path).
- Task parity and left-panel checklist synchronization remain KAT-188 scope.

## 6) Error Handling

- If action submit fails, keep the action row enabled and surface existing run error UI (`RunStatusBadge` / retry path).
- If parser fails or content is ambiguous, fail closed (no action row).
- Never block normal message rendering because of decision parsing errors.

## 7) Accessibility and UX Fidelity

- Action buttons use semantic `<button>` with clear text labels.
- Preserve contrast and sizing consistent with current center panel.
- Keep action cluster visually attached to the originating agent message.
- Do not auto-scroll away from clicked message beyond existing list behavior.

## Testing Strategy (TDD)

Unit tests:

- `message-decision-parser.test.ts`: detects valid decision cards, ignores non-matching messages, handles malformed input.
- `MessageBubble.test.tsx`: renders action row only for matched cards, preserves existing markdown rendering.
- `sessionConversationState` / hook tests: action click submits correct prompt and keeps run lifecycle semantics.

Integration tests:

- `ChatPanel.test.tsx`: clicking action button sends prompt via mocked hook adapter and shows pending/idle transitions.
- Replay test in `useIpcSessionConversation.test.ts`: resolved action state is re-derived from persisted message order.

E2E evidence:

- Add/extend `tests/e2e` scenario to capture mock-12/13 style state with visible inline actions.
- Capture evidence screenshots under `test-results/kat-187/`:
  - `tech-stack-decision-actions-visible.png`
  - `tech-stack-decision-after-click.png`

## Non-Goals

- Left-sidebar task tracking parity and cross-panel task state sync (KAT-188)
- New orchestration IPC protocol for typed decision payloads
- New model/provider routing behavior
- Full redesign of message markdown semantics beyond decision blocks

## Risks and Mitigations

- **Risk:** fragile parsing for future message text variations.  
  **Mitigation:** centralize parser patterns, unit-test representative variants, fail closed.

- **Risk:** duplicate submissions from repeated clicks.  
  **Mitigation:** disable action row while run state is `pending`; treat resolved cards as non-interactive.

- **Risk:** drift between mock labels and prompt payload text.  
  **Mitigation:** define canonical action IDs + labels in one mapping module and verify in tests.

## Approval Gate

If approved, next step is `writing-plans` to produce:

- `docs/plans/2026-03-03-kat-187-approval-actions-conversation-implementation-plan.md`
