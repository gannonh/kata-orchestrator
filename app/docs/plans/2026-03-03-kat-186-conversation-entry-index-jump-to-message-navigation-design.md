# KAT-186 Conversation Entry Index + Jump-to-Message Navigation Design

**Issue:** KAT-186  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-186/a7-conversation-entry-index-jump-to-message-navigation  
**Branch target:** `feature/kat-186-a7-conversation-entry-index-jump-to-message-navigation`  
**Specs:** `app/_plans/design/specs/04-build-session.md` (primary), `app/_plans/design/specs/02-coordinator-session.md`, `app/_plans/design/specs/03-spec-notes-panel.md`  
**Depends on:** KAT-185 (`Done`)  
**Blocks:** KAT-187

## Scope and Outcome

Add a left-sidebar conversation entry index for the active build-session thread and wire click-to-jump behavior that scrolls the center panel to the selected message.

This ticket delivers navigation and index rendering only. It does not add approval actions or rework the entire left sidebar information architecture.

## Current State Summary

- `ChatPanel` renders messages from `useIpcSessionConversation` into `MessageList` + `MessageBubble`.
- `LeftPanel` renders tabbed modules (Agents/Context/Changes/Files) and currently has no conversation index section.
- Persisted run messages already exist in `RunRecord.messages` with stable `id`, `role`, `content`, `createdAt`.
- Renderer conversation state currently discards persisted message IDs/timestamps during replay and synthesizes new IDs in `sessionConversationState.ts`.
- `MessageList` auto-scrolls to bottom on updates and exposes no targeted scroll API.

## Constraints and Assumptions

- KAT-185 roster integration is already merged and is the data boundary baseline for left sidebar work.
- KAT-186 should stay focused on entry-index + jump behavior; approval controls remain for KAT-187.
- Existing tabbed `LeftPanel` shell remains in place for this ticket; we add conversation index within the active build-session left surface instead of redesigning the shell structure.
- Message volume is expected to be moderate; no virtualization is required for this slice.

## Approaches Considered

### Approach 1 (Recommended): Renderer-derived index + DOM-anchor scroll API

Derive `ConversationEntry` items from the active `state.messages`, render them in a new left-sidebar section, and jump by scrolling to message DOM anchors keyed by stable message IDs.

Pros:

- Smallest safe change with clear ownership in renderer.
- No new persisted schema required.
- Fast feedback loop for UX parity and tests.

Cons:

- Requires tightening renderer state to preserve stable message IDs/timestamps.
- Jump behavior is local to mounted message list (not deep-linkable across routes).

### Approach 2: Persist explicit conversation index records in main state

Add first-class `conversationEntries` storage in main process state and query over IPC.

Pros:

- Canonical index data can support future cross-surface features.
- Could encode semantic labels independent of rendered messages.

Cons:

- Scope expansion across shared/main/preload for a UI-navigation ticket.
- Duplicates information already present in message history.

### Approach 3: Query-time extraction with no stable message IDs

Continue synthetic renderer IDs and use sequence-based jump targeting (`message-1`, `message-2`).

Pros:

- Lowest immediate code churn.

Cons:

- Fragile on replay/reorder and risks mismatched anchors.
- Harder to guarantee deterministic jump targets after app restart.

## Recommendation

Proceed with **Approach 1**. It satisfies KAT-186 with minimal architecture risk while establishing stable message identity required for reliable sidebar navigation.

## Proposed Design

## 1) Conversation Identity and State Fidelity

Keep persisted message identity intact end-to-end.

### Changes

- Extend reducer/event handling so replayed and runtime messages preserve:
  - `id`
  - `createdAt`
  - `role`
  - `content`
- Avoid synthetic ID generation for messages originating from persisted runs.

### Notes

- Local optimistic user prompt append can still create temporary IDs before persistence, but persisted replay must use true IDs.
- If duplicate IDs are observed (unexpected), reducer should ignore duplicate inserts defensively.

## 2) Sidebar Conversation Entry Model

Add a renderer-only derived model:

```ts
type ConversationEntry = {
  id: string            // maps directly to message.id
  messageId: string
  label: string         // short display text
  timestamp: string     // derived from createdAt, e.g. 2:41 PM
  role: 'user' | 'agent'
}
```

### Derivation rules

- Build entries from visible `ConversationMessage[]` for active session.
- Prefer agent and user messages both (spec parity: timeline of turns).
- Label heuristic:
  - First markdown heading text if present.
  - Else first non-empty line.
  - Else fallback `Message`.
- Truncate label to a fixed width (single-line ellipsis).

## 3) New Left Sidebar Section Component

Add `ConversationEntryIndexSection` under left-panel build-session surface.

### Behavior

- Renders entry rows (`label + timestamp`) ordered by message time.
- Active entry highlight is driven by most recently clicked entry.
- Empty state: `No conversation entries yet.`
- Loading/error are non-blocking and do not hide other left content.

### Placement

- In current shell, render below agent roster in the `agents` tab (build-session path) to avoid cross-tab structural redesign.

## 4) Jump-to-Message Navigation Contract

Introduce a targetable scroll contract between center and left components.

### Message list side

- `MessageList` exposes `scrollToMessage(messageId: string): boolean` via callback prop from `ChatPanel`.
- Each message row gets `data-message-id` and `id` anchor using stable IDs.
- Scroll uses `scrollIntoView({ block: 'center', behavior: 'smooth' })` with a fallback to immediate scroll when smooth behavior is unavailable.

### Sidebar side

- `LeftPanel` receives `onJumpToMessage(messageId)` callback.
- Clicking an index row invokes callback; if target not found, no crash and optional debug log.

### App shell wiring

- `AppShell` owns a lightweight shared callback channel:
  - center registers `scrollToMessage` handler
  - left invokes jump requests

This keeps left/center decoupled without introducing global state.

## 5) Accessibility and UX

- Index rows are buttons with descriptive accessible names:
  - `Jump to message: <label> at <time>`
- Maintain visible focus ring and keyboard support (`Enter`, `Space`).
- Preserve existing auto-scroll-to-bottom for new messages; manual jump should not disable later auto-scroll behavior.

## 6) Error Handling

- Missing message target: return `false` from scroll API, no thrown error.
- Invalid message timestamp: display fallback `--:--`.
- Empty message content: fallback label `Message`.

## Data Flow

1. `useIpcSessionConversation` replays/streams messages with stable IDs.
2. `ChatPanel` renders anchored messages and registers `scrollToMessage` with parent.
3. `LeftPanel` derives `ConversationEntry[]` from same conversation state (or receives derived list from parent).
4. User clicks entry.
5. `onJumpToMessage(messageId)` triggers center scroll to matching message anchor.

## Testing Strategy (TDD)

Required test coverage:

- `tests/unit/renderer/center/sessionConversationState.test.ts`
  - preserves persisted IDs/timestamps
  - no duplicate message insertion on repeated events
- `tests/unit/renderer/center/MessageList.test.tsx`
  - `scrollToMessage` targets specific message anchor
  - graceful false return when message not found
- `tests/unit/renderer/center/ChatPanel.test.tsx`
  - forwards/registers jump handler contract
- `tests/unit/renderer/left/LeftPanel.test.tsx`
  - renders conversation entry index with labels/timestamps
  - clicking entry calls jump callback with correct `messageId`
- `tests/unit/renderer/AppShell.test.tsx`
  - verifies left-to-center jump wiring path

Evidence for ticket completion:

- Unit test output for left/center/app-shell coverage above.
- Screenshot/video showing a sidebar entry click jumping center thread to the selected message.

## Non-Goals

- Inline approval actions in conversation bubbles (KAT-187).
- Task checklist parity changes beyond existing surfaces (KAT-188 scope).
- Full left-sidebar structural migration away from current tab architecture.
- New persisted IPC data models solely for conversation index.

## Risks and Mitigations

- Risk: synthetic IDs continue in part of the pipeline and break anchor stability.  
  Mitigation: add reducer contract tests that assert persisted IDs survive replay.

- Risk: auto-scroll-to-bottom fights manual jump selection.  
  Mitigation: confine auto-scroll trigger to message changes only; jump is explicit and should immediately apply.

- Risk: left and center coupling grows brittle.  
  Mitigation: keep a minimal callback interface at `AppShell` boundary instead of direct component imports.

## Approval Gate

If approved, implementation planning should proceed in:

- `docs/plans/2026-03-03-kat-186-conversation-entry-index-jump-to-message-navigation-implementation-plan.md`
