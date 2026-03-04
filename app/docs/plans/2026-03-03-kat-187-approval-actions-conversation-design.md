# KAT-187 Approval Actions in Conversation (Tech Stack / Plan Decisions) Design

**Issue:** KAT-187  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-187/a8-approval-actions-in-conversation-tech-stackplan-decisions  
**Parent:** KAT-157 (Slice A - Build Session / Spec 04)  
**Branch target:** `feature/kat-187-a8-approval-actions-in-conversation-tech-stackplan-decisions`  
**Specs:** `_plans/design/specs/04-build-session.md` (primary), `_plans/design/specs/02-coordinator-session.md`, `_plans/design/specs/03-spec-notes-panel.md`  
**Relevant mocks:** `12-build-session-tech-stack-a.png`, `13-build-session-tech-stack-b.png`

## Scope and Outcome

Implement inline approval/decision actions in the center conversation thread for the tech-stack proposal states represented by mocks 12 and 13.

Required outcome:

- Agent tech-stack proposal messages render action buttons inline with the message content.
- Action clicks send deterministic follow-up prompts through the existing run submission flow.
- Decision actions are replay-safe across persisted run history.
- The design preserves KAT-188 boundary (task tracking parity remains separate).

## Context Loaded

From Linear and specs:

- KAT-187 blockers KAT-160 and KAT-186 are `Done` as of March 3, 2026.
- Spec 04 explicitly calls out mock-12/13 behavior: proposal content includes `Why`, `How to keep Tech stable later`, and `Revised views`, followed by inline approvals (`Approve the plan...`, `Keep the last switch...`).
- Parent epic KAT-157 defines Spec 04 as authority and requires hard-gate evidence before `Done`.
- Desktop workflow contract requires tests + screenshot/video evidence for state/interaction coverage.

From current code:

- Conversation surface is `ChatPanel` + `MessageList` + `MessageBubble`.
- Conversation state shape is `SessionConversationState` with `messages: ConversationMessage[]`; message payloads are plain markdown strings.
- `useIpcSessionConversation` already handles submit/replay events and keeps run lifecycle semantics (`empty/pending/error/idle`).
- No inline message action model currently exists in `ConversationMessage` or rendering components.

## Constraints and Assumptions

- This ticket is treated as an **Enabler** for conversation decision UX in the Build Session flow; full fidelity for downstream task-tracking progression remains in KAT-188.
- KAT-187 should avoid a full main/preload schema migration unless required by reliability.
- Inline actions must remain auditable in the same conversation history rather than hidden side effects.
- Existing chat input/run status behavior should remain stable.

## Approaches Considered

### Approach 1 (Recommended): Renderer decision-card extraction + deterministic follow-up prompts

Detect decision prompts from agent markdown in renderer, render inline buttons, and map each button to a canonical follow-up prompt submitted through existing `submitPrompt`.

Pros:

- Small scope and fast delivery inside current architecture.
- No new IPC/state schema required to deliver mock-12/13 behavior.
- Replay compatibility stays straightforward because selected action becomes a normal user message.

Cons:

- Decision card detection is heuristic and tied to message shape.
- Needs strict parser tests to avoid false positives.

### Approach 2: Add typed decision payloads to runtime events

Extend main/preload runtime events so agent messages include structured `decisionCard` metadata.

Pros:

- Deterministic rendering contract and less text parsing risk.
- Better long-term basis for broader decision interactions.

Cons:

- Expands scope across shared/main/preload/renderer.
- Delays delivery for this ticket despite current need being narrow.

### Approach 3: Render decision actions in right panel only

Move decision affordances to spec panel while leaving center conversation read-only.

Pros:

- Reuses right-panel interaction scaffolding.

Cons:

- Conflicts with spec 04 mock behavior where actions are inline in conversation.
- Breaks local context: user reads proposal in center and must switch panels to act.

## Recommendation

Use **Approach 1** for KAT-187. It gives mock-12/13 parity quickly, keeps action handling auditable, and avoids premature runtime contract expansion.

## Proposed Design

## 1) Inline Decision Model (Renderer-only)

Introduce a local model for decision cards extracted from agent messages:

```ts
type InlineDecisionActionId =
  | 'approve_tech_stack_plan'
  | 'keep_last_stack_switch'
  | 'ask_for_clarification'

type InlineDecisionAction = {
  id: InlineDecisionActionId
  label: string
  followUpPrompt: string
  variant: 'default' | 'secondary' | 'outline'
}

type InlineDecisionCard = {
  sourceMessageId: string
  promptLabel: string
  actions: InlineDecisionAction[]
}
```

Detection contract:

- Only agent messages are eligible.
- Require an approval prompt pattern near message tail (e.g. `Approve this plan...` and `Clarifications` token).
- Normalize known mock labels:
  - `Approve the plan...`
  - `Keep the last switch...`
- Unknown/partial shapes fail closed (no action row rendered).

## 2) Center Panel Rendering

Extend the center conversation render path so each agent `MessageBubble` can display an optional action row under markdown content.

Implementation boundary:

- `MessageBubble` receives optional `decisionCard` and `onDecisionAction`.
- `ChatPanel` resolves decision cards from `state.messages` and wires action callbacks to `submitPrompt`.
- Styling uses existing shadcn button primitives to match current center panel visual language.

## 3) Action Execution and Replay Semantics

Action click behavior:

1. Disable action row while run is `pending`.
2. Submit the action's canonical `followUpPrompt` via `submitPrompt`.
3. Let existing runtime pipeline append the user message and subsequent agent response.

Replay/resolution:

- A decision card is considered resolved once a subsequent user message matches one of the action prompts.
- Resolved cards render as non-interactive (`Decision sent`) after replay as well.
- No additional persistence field is required for v1.

## 4) Error Handling and Safety

- Parser errors do not break message rendering.
- If `runSubmit` fails, existing error handling path (`RUN_FAILED` + retry) remains authoritative.
- Rapid repeat-click protection: action row disabled for `pending` state and for resolved cards.

## 5) Accessibility and UX

- Buttons use semantic `button` elements with explicit accessible names.
- Keyboard navigation (`Tab`, `Enter`, `Space`) must work end-to-end.
- Action row remains visually attached to originating message bubble to preserve conversational context.

## Data Flow

1. `useIpcSessionConversation` provides `SessionConversationState.messages` and `runState`.
2. `ChatPanel` maps eligible agent messages through `extractInlineDecisionCard`.
3. `MessageBubble` renders markdown plus optional action row.
4. User click invokes `submitPrompt(followUpPrompt)`.
5. Existing message/run pipeline persists and replays the decision as normal conversation turns.

## Testing Strategy (TDD)

Unit tests:

- `tests/unit/renderer/center/message-decision-parser.test.ts`
  - detects mock-12/13 shaped prompts
  - ignores normal agent messages
  - fails closed on malformed input
- `tests/unit/renderer/center/MessageBubble.test.tsx`
  - renders action row for decision cards only
  - respects disabled/resolved states
- `tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`
  - action-submitted prompt follows standard pending/idle/error lifecycle

Integration tests:

- `tests/unit/renderer/center/ChatPanel.test.tsx`
  - clicking inline action triggers `submitPrompt` with canonical follow-up text
  - pending state disables action row
- Replay contract test:
  - action resolves from message history ordering without extra stored flags

Evidence for completion gate:

- Unit/integration test outputs linked in ticket/PR.
- Screenshots in `test-results/kat-187/`:
  - `mock12-actions-visible.png`
  - `mock13-actions-post-click.png`

## Non-Goals

- KAT-188 task panel parity and cross-panel task state synchronization.
- Introducing new runtime IPC schema for typed decision cards.
- Reworking model/provider selection behavior.
- Full conversation protocol redesign beyond inline decision actions.

## Risks and Mitigations

- **Risk:** prompt pattern drift from future orchestrator copy changes.  
  **Mitigation:** centralize patterns/constants and back with focused parser fixtures.

- **Risk:** duplicate action submissions due to repeated clicks.  
  **Mitigation:** disable actions during pending runs and after resolution.

- **Risk:** UX mismatch with exact mock labels.  
  **Mitigation:** enforce explicit label mapping and snapshot assertions for mock-12/13 states.

## Approval Gate

If this design is accepted, the next artifact is:

- `docs/plans/2026-03-03-kat-187-approval-actions-conversation-implementation-plan.md`
