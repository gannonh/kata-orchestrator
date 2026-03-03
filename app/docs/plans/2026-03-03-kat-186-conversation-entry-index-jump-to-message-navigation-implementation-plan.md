# KAT-186 Conversation Entry Index + Jump-to-Message Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a left-sidebar conversation entry index for build sessions and enable click-to-jump scrolling to the corresponding center-thread message.

**Architecture:** Keep message identity stable from persisted run history into renderer conversation state, derive lightweight sidebar entry rows from those messages, and bridge left-to-center jump actions through `AppShell` callbacks. Add message anchors and a targeted scroll API in `MessageList` so sidebar clicks can reliably scroll to specific thread items.

**Tech Stack:** Electron renderer (React 19 + TypeScript), existing session conversation hook (`useIpcSessionConversation`), Vitest + Testing Library.

---

## Implementation Rules

- Use `@test-driven-development` for every task (Red -> Green).
- Use `@verification-before-completion` before claiming success.
- Keep scope to KAT-186 only (no approval-action UX from KAT-187, no task-checklist parity work from KAT-188).
- Stage only files touched in each task; keep commit slices small.

### Task 1: Preserve Stable Message Identity in Conversation Reducer

**Files:**
- Modify: `src/renderer/types/session-conversation.ts`
- Modify: `src/renderer/components/center/sessionConversationState.ts`
- Test: `tests/unit/renderer/center/sessionConversationState.test.ts`

**Step 1: Write failing reducer tests for persisted message append/update behavior**

Add tests that assert:
- Reducer can append an externally supplied message object without generating synthetic IDs.
- Reducer can update an existing message by `id`.
- Duplicate message append events are ignored.

```ts
expect(next.messages[1]).toEqual({
  id: 'agent-msg-42',
  role: 'agent',
  content: 'Spec Updated',
  createdAt: '2026-03-03T10:00:00.000Z'
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/sessionConversationState.test.ts`
Expected: FAIL because reducer currently only appends generated `user-N` / `agent-N` messages.

**Step 3: Implement minimal reducer/event changes**

- Add explicit reducer events for persisted/runtime message objects (append + update).
- In reducer, append message only when `id` is not already present.
- Update in-place when matching `id` exists.

```ts
export type AppendMessageEvent = { type: 'APPEND_MESSAGE'; message: ConversationMessage }
export type UpdateMessageEvent = { type: 'UPDATE_MESSAGE'; message: ConversationMessage }
```

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/sessionConversationState.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/types/session-conversation.ts src/renderer/components/center/sessionConversationState.ts tests/unit/renderer/center/sessionConversationState.test.ts
git commit -m "feat(kat-186): preserve conversation message identity in reducer"
```

### Task 2: Replay Runtime/Persisted Messages with Real IDs and Dedupe in Hook

**Files:**
- Modify: `src/renderer/hooks/useIpcSessionConversation.ts`
- Test: `tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`

**Step 1: Write failing hook tests for replay/runtime identity fidelity**

Add tests that assert:
- `runList` replayed messages keep persisted `id`/`createdAt`.
- `message_appended` dispatch path preserves `id`.
- Duplicate replay/runtime message IDs do not create duplicate rows.

```ts
expect(result.current.state.messages.find((m) => m.id === 'a1')?.createdAt)
  .toBe('2026-03-01T00:00:01Z')
expect(result.current.state.messages.filter((m) => m.id === 'a1')).toHaveLength(1)
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`
Expected: FAIL because replay path currently re-synthesizes message identity through `RUN_SUCCEEDED`/`SUBMIT_PROMPT` events.

**Step 3: Implement hook dispatch updates**

- Replace replay logic that reconstructs messages from prompt/response with explicit append/update events.
- On runtime `message_appended`, dispatch persisted message object.
- On runtime `message_updated`, dispatch update event keyed by message id.

```ts
dispatch({ type: 'APPEND_MESSAGE', message: msg })
dispatch({ type: 'UPDATE_MESSAGE', message: msg })
```

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts tests/unit/renderer/center/sessionConversationState.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/hooks/useIpcSessionConversation.ts tests/unit/renderer/hooks/useIpcSessionConversation.test.ts
git commit -m "fix(kat-186): replay and stream conversation messages with stable ids"
```

### Task 3: Add Conversation Entry Derivation Utility for Sidebar Index

**Files:**
- Create: `src/renderer/components/left/conversation-entry-index.ts`
- Test: `tests/unit/renderer/left/conversation-entry-index.test.ts`

**Step 1: Write failing utility tests**

Cover:
- Heading-first label extraction for agent markdown (`## Spec Updated` -> `Spec Updated`).
- First non-empty line fallback.
- Empty-content fallback label (`Message`).
- Timestamp formatting fallback (`--:--`) for invalid dates.

```ts
expect(entries[0]).toMatchObject({
  messageId: 'm-1',
  label: 'Spec Updated'
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/left/conversation-entry-index.test.ts`
Expected: FAIL because utility file does not exist.

**Step 3: Implement derivation utility**

```ts
export type ConversationEntry = {
  id: string
  messageId: string
  label: string
  timestamp: string
  role: 'user' | 'agent'
}

export function buildConversationEntries(messages: ConversationMessage[]): ConversationEntry[] {
  // derive label + timestamp deterministically
}
```

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/left/conversation-entry-index.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/left/conversation-entry-index.ts tests/unit/renderer/left/conversation-entry-index.test.ts
git commit -m "feat(kat-186): derive sidebar conversation index entries"
```

### Task 4: Build Conversation Entry Index Section UI

**Files:**
- Create: `src/renderer/components/left/ConversationEntryIndexSection.tsx`
- Test: `tests/unit/renderer/left/ConversationEntryIndexSection.test.tsx`

**Step 1: Write failing component tests**

Cover:
- Renders heading and row buttons for entries.
- Emits `onJumpToMessage(messageId)` when row clicked.
- Shows empty state when no entries.

```tsx
fireEvent.click(screen.getByRole('button', { name: /Jump to message: Spec Updated/i }))
expect(onJumpToMessage).toHaveBeenCalledWith('m-1')
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/left/ConversationEntryIndexSection.test.tsx`
Expected: FAIL because component does not exist.

**Step 3: Implement section component**

- Use existing left-panel typography conventions.
- Render rows as buttons with one-line truncation + timestamp.
- Use deterministic empty-state copy: `No conversation entries yet.`

```tsx
<button type="button" onClick={() => onJumpToMessage(entry.messageId)}>
  <span>{entry.label}</span>
  <span>{entry.timestamp}</span>
</button>
```

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/left/ConversationEntryIndexSection.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/left/ConversationEntryIndexSection.tsx tests/unit/renderer/left/ConversationEntryIndexSection.test.tsx
git commit -m "feat(kat-186): add left sidebar conversation entry section"
```

### Task 5: Add Targeted Message Scroll API and Anchors in Center Thread

**Files:**
- Modify: `src/renderer/components/center/MessageList.tsx`
- Modify: `src/renderer/components/center/MessageBubble.tsx`
- Modify: `src/renderer/components/center/ChatPanel.tsx`
- Test: `tests/unit/renderer/center/MessageList.test.tsx`
- Test: `tests/unit/renderer/center/ChatPanel.test.tsx`

**Step 1: Write failing center-panel tests**

Cover:
- Each message row has a stable anchor attribute (`data-message-id`).
- `MessageList` exposes a `scrollToMessage` callback that returns `true` when found and `false` otherwise.
- `ChatPanel` registers jump callback via prop.

```ts
expect(registerScrollToMessage).toHaveBeenCalledWith(expect.any(Function))
expect(scrollResult).toBe(true)
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/MessageList.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx`
Expected: FAIL because no targeted scroll registration exists.

**Step 3: Implement message anchor + scroll registration**

- Add `scrollToMessage` registration prop to `MessageList` and `ChatPanel`.
- Attach anchor metadata on each message row.
- Keep existing auto-scroll-to-bottom behavior.

```ts
type ScrollToMessage = (messageId: string) => boolean
onRegisterScrollToMessage?.((messageId) => {
  const target = viewport.querySelector(`[data-message-id="${messageId}"]`)
  target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return Boolean(target)
})
```

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/MessageList.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/MessageList.tsx src/renderer/components/center/MessageBubble.tsx src/renderer/components/center/ChatPanel.tsx tests/unit/renderer/center/MessageList.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx
git commit -m "feat(kat-186): add jump-to-message anchor scrolling in chat panel"
```

### Task 6: Wire Left Sidebar Index to Center Jump API via AppShell

**Files:**
- Modify: `src/renderer/components/layout/AppShell.tsx`
- Modify: `src/renderer/components/layout/LeftPanel.tsx`
- Test: `tests/unit/renderer/left/LeftPanel.test.tsx`
- Test: `tests/unit/renderer/AppShell.test.tsx`

**Step 1: Write failing wiring tests**

Cover:
- `LeftPanel` receives derived conversation entries and renders section under Agents tab.
- Clicking an index row invokes shell-level jump handler.
- `AppShell` passes jump handler from center registration to left panel.

```tsx
expect(screen.getByText('Spec Updated')).toBeTruthy()
fireEvent.click(screen.getByRole('button', { name: /Jump to message: Spec Updated/i }))
expect(onJumpToMessage).toHaveBeenCalledWith('m-1')
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/AppShell.test.tsx`
Expected: FAIL because left/center callback bridge and new props do not exist.

**Step 3: Implement AppShell bridge and LeftPanel integration**

- In `AppShell`, store:
  - latest `ConversationEntry[]`
  - registered `scrollToMessage` callback
- Pass entries + `onJumpToMessage` into `LeftPanel`.
- Pass registration callbacks into `ChatPanel`.
- In `LeftPanel`, render `ConversationEntryIndexSection` under `AgentsTab` content (build-session path).

```ts
const [scrollToMessage, setScrollToMessage] = useState<((id: string) => boolean) | null>(null)
const handleJumpToMessage = useCallback((id: string) => {
  scrollToMessage?.(id)
}, [scrollToMessage])
```

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/layout/AppShell.tsx src/renderer/components/layout/LeftPanel.tsx tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/AppShell.test.tsx
git commit -m "feat(kat-186): wire sidebar conversation index to center jump api"
```

### Task 7: Regression Pass for Conversation Runtime + Left Sidebar UX

**Files:**
- Modify (if needed): `tests/unit/renderer/center/CenterPanel.test.tsx`
- Modify (if needed): `tests/unit/renderer/center/CenterPanel.callbacks.test.tsx`
- Modify (if needed): `tests/unit/renderer/left/AgentsTab.test.tsx`

**Step 1: Add failing regression tests for behavior interaction edges**

Cover:
- Jump request when target missing does not crash.
- Existing agents tab behavior remains intact with new conversation section present.

**Step 2: Run tests to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/CenterPanel.test.tsx tests/unit/renderer/center/CenterPanel.callbacks.test.tsx tests/unit/renderer/left/AgentsTab.test.tsx`
Expected: FAIL on new edge-case expectations.

**Step 3: Implement minimal hardening changes**

- Guard missing target jump path (`false` return, no throw).
- Ensure conversation index rendering does not alter existing agent grouping logic.

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/CenterPanel.test.tsx tests/unit/renderer/center/CenterPanel.callbacks.test.tsx tests/unit/renderer/left/AgentsTab.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/renderer/center/CenterPanel.test.tsx tests/unit/renderer/center/CenterPanel.callbacks.test.tsx tests/unit/renderer/left/AgentsTab.test.tsx
git commit -m "test(kat-186): add jump navigation regression coverage"
```

### Task 8: Final Verification + Evidence Prep

**Files:**
- Optional evidence notes: `docs/plans/2026-03-03-kat-186-conversation-entry-index-jump-to-message-navigation-design.md`

**Step 1: Run focused unit suites for modified surfaces**

Run:

```bash
npx vitest run \
  tests/unit/renderer/center/sessionConversationState.test.ts \
  tests/unit/renderer/hooks/useIpcSessionConversation.test.ts \
  tests/unit/renderer/center/MessageList.test.tsx \
  tests/unit/renderer/center/ChatPanel.test.tsx \
  tests/unit/renderer/left/ConversationEntryIndexSection.test.tsx \
  tests/unit/renderer/left/conversation-entry-index.test.ts \
  tests/unit/renderer/left/LeftPanel.test.tsx \
  tests/unit/renderer/AppShell.test.tsx
```

Expected: PASS.

**Step 2: Run desktop quality gate**

Run: `npm run test:ci:local`
Expected: PASS.

**Step 3: Capture UI evidence for hard-gate DoD**

- Use `agent-browser` or Playwright to capture a screenshot/video showing:
  - conversation entries visible in left sidebar
  - click on one entry
  - center panel scroll jump to the referenced message

**Step 4: Verify scope boundaries before ticket completion**

Run: `git diff --name-only main...HEAD`
Expected: only KAT-186 related renderer/test/docs files.

**Step 5: Commit any evidence-note updates (optional)**

```bash
git add docs/plans/2026-03-03-kat-186-conversation-entry-index-jump-to-message-navigation-design.md
git commit -m "docs(kat-186): attach verification evidence notes"
```
