# KAT-66 Center Column Fidelity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver center-column UI fidelity parity for typography, spacing rhythm, message bubbles, tool chrome, and conversation-state visuals (initial, pasted context, context reading, analyzing) using center-only component changes.

**Architecture:** Add a center-local presentation adapter that maps mock-chat inputs into explicit render blocks and view states, then render those blocks through updated center components (`MockChatPanel`, `MessageBubble`, `ToolCallResult`, `MessageList`, `ChatInput`). Keep global app layout/state unchanged and preserve existing send behavior while tightening visual hierarchy and cadence.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, Playwright (existing E2E), Tailwind/shadcn UI primitives.

---

Skill references:
- `@test-driven-development`
- `@verification-before-completion`

### Task 1: Add Presentation Adapter Tests (Failing First)

**Files:**
- Create: `src/renderer/components/center/mockChatPresentation.ts`
- Create: `tests/unit/renderer/center/mockChatPresentation.test.ts`
- Test: `tests/unit/renderer/center/mockChatPresentation.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { deriveMockChatPresentation } from '../../../../src/renderer/components/center/mockChatPresentation'

describe('deriveMockChatPresentation', () => {
  it('maps to contextReading when message includes context markers and streaming is active', () => {
    const result = deriveMockChatPresentation({
      messages: [{ id: 'm1', role: 'user', content: 'Read ## Context now' }],
      isStreaming: true
    })

    expect(result.viewState).toBe('contextReading')
    expect(result.blocks.some((block) => block.type === 'contextChipRow')).toBe(true)
    expect(result.statusBadge?.variant).toBe('thinking')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/mockChatPresentation.test.ts`
Expected: FAIL with module/file-not-found for `mockChatPresentation`.

**Step 3: Write minimal implementation scaffold**

```ts
export function deriveMockChatPresentation() {
  return { viewState: 'initial', blocks: [], statusBadge: null }
}
```

**Step 4: Run test to verify it still fails for behavior**

Run: `npx vitest run tests/unit/renderer/center/mockChatPresentation.test.ts`
Expected: FAIL on `viewState` and missing blocks/status variant.

**Step 5: Commit scaffold + failing test**

```bash
git add src/renderer/components/center/mockChatPresentation.ts tests/unit/renderer/center/mockChatPresentation.test.ts
git commit -m "test(app): add failing presentation adapter tests for KAT-66 center states"
```

### Task 2: Implement Presentation Adapter State Mapping

**Files:**
- Modify: `src/renderer/components/center/mockChatPresentation.ts`
- Modify: `tests/unit/renderer/center/mockChatPresentation.test.ts`
- Test: `tests/unit/renderer/center/mockChatPresentation.test.ts`

**Step 1: Expand failing tests for all target states**

```ts
it('maps pastedContext with pasted-lines badge metadata', () => {
  const result = deriveMockChatPresentation({
    messages: [{ id: 'u1', role: 'user', content: 'Pasted 205 lines\n\nspec text' }],
    isStreaming: false
  })
  expect(result.viewState).toBe('pastedContext')
  expect(result.blocks.some((block) => block.type === 'statusBadge' && block.variant === 'stopped')).toBe(true)
})

it('maps analyzing to collapsedSummary block', () => {
  const result = deriveMockChatPresentation({
    messages: [{ id: 'u2', role: 'user', content: 'I would like to build the following product...' }],
    isStreaming: true,
    forceAnalyzing: true
  })
  expect(result.viewState).toBe('analyzing')
  expect(result.blocks.some((block) => block.type === 'collapsedSummary')).toBe(true)
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/center/mockChatPresentation.test.ts`
Expected: FAIL on missing state transitions and block variants.

**Step 3: Implement minimal adapter behavior**

```ts
type ViewState = 'initial' | 'pastedContext' | 'contextReading' | 'analyzing'

export function deriveMockChatPresentation(input: {
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>
  isStreaming: boolean
  forceAnalyzing?: boolean
}) {
  // choose viewState from message content and flags
  // emit ordered blocks: message -> chips -> status/tool/collapsed summary
  // map streaming to thinking/stopped variants
}
```

**Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/renderer/center/mockChatPresentation.test.ts`
Expected: PASS.

**Step 5: Commit adapter implementation**

```bash
git add src/renderer/components/center/mockChatPresentation.ts tests/unit/renderer/center/mockChatPresentation.test.ts
git commit -m "feat(app): add center presentation adapter for KAT-66 conversation states"
```

### Task 3: Integrate Adapter Rendering into MockChatPanel

**Files:**
- Modify: `src/renderer/components/center/MockChatPanel.tsx`
- Modify: `tests/unit/renderer/center/MockChatPanel.test.tsx`
- Test: `tests/unit/renderer/center/MockChatPanel.test.tsx`

**Step 1: Add failing integration tests**

```tsx
it('renders context chips and thinking status in contextReading state', () => {
  render(<MockChatPanel />)
  expect(screen.getByText('# Kata Cloud (Kata V2)')).toBeTruthy()
  expect(screen.getByText('Thinking')).toBeTruthy()
})

it('renders stopped badge variant when streaming ends', () => {
  render(<MockChatPanel />)
  expect(screen.getByText('Stopped')).toBeTruthy()
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/center/MockChatPanel.test.tsx`
Expected: FAIL on missing chip/status/collapsed-summary rendering.

**Step 3: Implement adapter-driven render pipeline**

```tsx
const presentation = deriveMockChatPresentation({ messages, isStreaming })

return (
  <div className="flex h-full min-h-0 flex-col">
    <MessageList>{/* render ordered presentation.blocks */}</MessageList>
    <ChatInput onSend={sendMessage} disabled={isStreaming} />
  </div>
)
```

**Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/renderer/center/MockChatPanel.test.tsx`
Expected: PASS.

**Step 5: Commit panel integration**

```bash
git add src/renderer/components/center/MockChatPanel.tsx tests/unit/renderer/center/MockChatPanel.test.tsx
git commit -m "feat(app): render KAT-66 center states via mock chat presentation adapter"
```

### Task 4: Implement Message Bubble Fidelity Variants

**Files:**
- Modify: `src/renderer/components/center/MessageBubble.tsx`
- Modify: `tests/unit/renderer/center/MessageBubble.test.tsx`
- Test: `tests/unit/renderer/center/MessageBubble.test.tsx`

**Step 1: Add failing tests for collapsed and cadence variants**

```tsx
it('renders collapsed summary variant for analyzing mode', () => {
  render(
    <MessageBubble
      message={{ id: 'u1', role: 'user', content: 'Long content' }}
      variant="collapsed"
      summary="I would like to build the following product..."
    />
  )

  expect(screen.getByText('I would like to build the following product...')).toBeTruthy()
  expect(screen.queryByText('Long content')).toBeNull()
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/center/MessageBubble.test.tsx`
Expected: FAIL due to unsupported props/variant behavior.

**Step 3: Implement minimal variant support**

```tsx
type MessageBubbleVariant = 'default' | 'collapsed'

export function MessageBubble({ message, variant = 'default', summary }: Props) {
  const display = variant === 'collapsed' && summary ? summary : message.content
  // apply tightened spacing/typography classes per user/assistant + variant
}
```

**Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/renderer/center/MessageBubble.test.tsx`
Expected: PASS.

**Step 5: Commit message bubble updates**

```bash
git add src/renderer/components/center/MessageBubble.tsx tests/unit/renderer/center/MessageBubble.test.tsx
git commit -m "feat(app): add KAT-66 collapsed message bubble variant and typography rhythm"
```

### Task 5: Align Input + Tool Block + List Rhythm to Mock Cadence

**Files:**
- Modify: `src/renderer/components/center/ChatInput.tsx`
- Modify: `src/renderer/components/center/ToolCallResult.tsx`
- Modify: `src/renderer/components/center/MessageList.tsx`
- Modify: `tests/unit/renderer/center/ChatInput.test.tsx`
- Modify: `tests/unit/renderer/center/ToolCallResult.test.tsx`
- Modify: `tests/unit/renderer/center/MessageList.test.tsx`

**Step 1: Add failing structure/style-hook tests**

```tsx
it('renders model/meta strip and action row affordances', () => {
  render(<ChatInput onSend={() => {}} />)
  expect(screen.getByText('orchestrator@kata.local')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy()
})

it('renders tool output chrome in conversation stream style', () => {
  render(<ToolCallResult toolCall={{ id: 't1', name: 'read_file', args: {}, output: 'ok' }} />)
  expect(screen.getByRole('button', { name: 'Tool: read_file' })).toBeTruthy()
})
```

**Step 2: Run tests to verify they fail**

Run:
- `npx vitest run tests/unit/renderer/center/ChatInput.test.tsx`
- `npx vitest run tests/unit/renderer/center/ToolCallResult.test.tsx`
- `npx vitest run tests/unit/renderer/center/MessageList.test.tsx`

Expected: FAIL on new structural parity expectations.

**Step 3: Implement minimal visual hierarchy updates**

```tsx
// ChatInput: preserve send logic, adjust section structure/classes for mock cadence
// ToolCallResult: keep collapsible behavior, update wrapper chrome + spacing tokens
// MessageList: update vertical rhythm and panel padding classes
```

**Step 4: Run tests to verify pass**

Run:
- `npx vitest run tests/unit/renderer/center/ChatInput.test.tsx`
- `npx vitest run tests/unit/renderer/center/ToolCallResult.test.tsx`
- `npx vitest run tests/unit/renderer/center/MessageList.test.tsx`

Expected: PASS.

**Step 5: Commit center cadence refinements**

```bash
git add src/renderer/components/center/ChatInput.tsx src/renderer/components/center/ToolCallResult.tsx src/renderer/components/center/MessageList.tsx tests/unit/renderer/center/ChatInput.test.tsx tests/unit/renderer/center/ToolCallResult.test.tsx tests/unit/renderer/center/MessageList.test.tsx
git commit -m "feat(app): refine center input tool and list cadence for KAT-66 parity"
```

### Task 6: Verification and Evidence Capture for Completion Gate

**Files:**
- Modify if needed: `tests/unit/renderer/center/*.test.tsx`
- Reference: `_plans/design/mocks/04-coordinator-session-initial-state.png`
- Reference: `_plans/design/mocks/05-coordinator-session-pasted-context.png`
- Reference: `_plans/design/mocks/06-coordinator-session-spec-context-reading.png`
- Reference: `_plans/design/mocks/07-coordinator-session-spec-analyzing.png`
- Reference: `_plans/design/mocks/20-wave1-architecture-decisions.png`

**Step 1: Run targeted center suite**

```bash
npx vitest run tests/unit/renderer/center/mockChatPresentation.test.ts \
  tests/unit/renderer/center/MockChatPanel.test.tsx \
  tests/unit/renderer/center/MessageBubble.test.tsx \
  tests/unit/renderer/center/ChatInput.test.tsx \
  tests/unit/renderer/center/ToolCallResult.test.tsx \
  tests/unit/renderer/center/MessageList.test.tsx
```

Expected: PASS.

**Step 2: Run broader desktop unit gate**

Run: `npm run test`
Expected: PASS.

**Step 3: Run lint gate**

Run: `npm run lint`
Expected: PASS.

**Step 4: Capture parity evidence against referenced mocks**

Run:
- `npm run dev:web`
- Validate center-column behavior and visual cadence for mock states 04/05/06/07/20

Expected: screenshot-comparable hierarchy and readable message rhythm.

**Step 5: Commit final test/evidence touch-ups**

```bash
git add tests/unit/renderer/center
git commit -m "test(app): finalize KAT-66 center-column parity coverage and gate verification"
```
