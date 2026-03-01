# KAT-66 Design: Center Column Typography/Spacing/Message Bubble Parity

Date: 2026-02-24
Issue: KAT-66

## Goal
Align the center conversation column to mock-level fidelity for typography, spacing rhythm, message bubble hierarchy, and tool-block chrome while staying strictly within center-panel components.

## Confirmed Scope
- Fidelity target: hybrid
  - Pixel-close for message/thread surfaces
  - Token-constrained for input/tool blocks
- Behavior target: full mock-state parity for center-column conversation states
  - Thinking/stopped cadence transitions
  - Context-chip rendering states
  - Collapsed analyzing summary treatment
- Code boundary: center components only unless blocked
  - `src/renderer/components/center/MockChatPanel.tsx`
  - `src/renderer/components/center/MessageBubble.tsx`
  - `src/renderer/components/center/MessageList.tsx`
  - `src/renderer/components/center/ChatInput.tsx`
  - `src/renderer/components/center/ToolCallResult.tsx`
- No shell-level layout changes for this ticket.

## Approaches Considered
1. Style-first patch
- Retheme existing components with minimal structural change.
- Fastest, but state mapping becomes ad hoc and fragile.

2. Center-local presentation model (selected)
- Add a local adapter that maps chat/input state to ordered render blocks.
- Preserves center-only scope while supporting full mock-state parity cleanly.

3. Dedicated component per mock screenshot state
- Very explicit visual control.
- Higher duplication and weaker maintainability.

## Architecture
Use `MockChatPanel` as a render orchestrator with a center-local presentation adapter.

- Adapter converts raw inputs (`messages`, `isStreaming`, `toolCalls`) into ordered display blocks:
  - `userMessage`
  - `assistantMessage`
  - `contextChipRow`
  - `statusBadge`
  - `toolBlock`
  - `collapsedSummary`
- Presentational components consume block variants and focus on visual fidelity.
- Keep `src/renderer/types/chat.ts` unchanged for this ticket; avoid broad model churn.

## Data Flow and State Mapping
Derived `viewState` within `MockChatPanel`:
- `initial`
- `pastedContext`
- `contextReading`
- `analyzing`

Mapping rules:
- `initial`: first user message + thinking badge.
- `pastedContext`: expanded user message with pasted-lines badge treatment.
- `contextReading`: user message + context-chip row + thinking badge.
- `analyzing`: collapsed user summary + compact context summary + thinking badge.
- If streaming has stopped after send, render stopped status variant where applicable.

## Component-Level Design
### MockChatPanel
- Build presentation adapter and ordered block render pipeline.
- Render inline context-chip rows and status badges in conversation cadence.

### MessageBubble
- Tighten typography and spacing cadence to match mocks.
- Add collapsed summary variant for analyzing state.
- Refine user/assistant contrast and bubble shape hierarchy.

### ToolCallResult
- Restyle as conversation-stream tool chrome.
- Keep arguments/output readable while matching center column visual rhythm.

### ChatInput
- Align to mock hierarchy:
  - top meta strip
  - input body
  - action row with model/controls/send affordance
- Keep current send behavior; no backend behavior expansion.

### MessageList
- Tune list padding and vertical spacing to match rhythm expectations.

## Error Handling and Edge Cases
- Unknown/unsupported derived block types are ignored safely.
- Empty message arrays render stable empty state with intact input bar.
- Collapsed summary only appears in analyzing mode and falls back to full message if source data is insufficient.
- Status badge rendering is deterministic from adapter output, not from scattered component-local conditionals.

## Testing Strategy (TDD)
Add failing tests first, then implement:
- Presentation adapter/state mapping coverage:
  - `initial`
  - `pastedContext`
  - `contextReading`
  - `analyzing`
- Status badge variant rendering (`thinking`, `stopped`)
- Collapsed summary visibility/content
- Context-chip row render order and content
- Message bubble variant structure/class expectations
- Input/tool block structural parity checks (within center component scope)

Regression guard:
- Update existing center component tests only where behavior intentionally changes.
- Run targeted center unit tests plus impacted renderer test subset.

## Out of Scope
- Shell grid/header/panel seam adjustments.
- New global app state for conversation phases.
- IPC/API contract changes.
- Non-center panel fidelity updates.

## Expected Outcome
Center panel reaches spec-grade readability and hierarchy for conversation flow with mock-credible state transitions, while preserving the existing app architecture and strict center-only change boundary.
