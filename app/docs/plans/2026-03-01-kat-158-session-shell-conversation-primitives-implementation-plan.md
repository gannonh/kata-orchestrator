# KAT-158 Session Shell + Conversation Primitives Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship minimum Slice A session shell parity by implementing deterministic center-panel conversation states (`empty`, `pending`, `error`, `idle`) with message primitives, tested transitions, and screenshot evidence.

**Architecture:** Keep existing `AppShell`/`LeftPanel`/`RightPanel` composition and replace center-panel behavior with a deterministic state machine (`reducer + hook`) that drives message rendering and run badges. Preserve a clean adapter boundary so `KAT-159` can swap local state for Convex + PI runtime events without rewriting presentational components.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Playwright (Electron), Convex-aligned data contract, PI primitives handoff (`@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`) for next-slice integration.

---

### Task 1: Define Deterministic Session Conversation State (Red)

**Files:**
- Create: `src/renderer/types/session-conversation.ts`
- Create: `src/renderer/components/center/sessionConversationState.ts`
- Test: `tests/unit/renderer/center/sessionConversationState.test.ts`

**Step 1: Write the failing reducer tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  createInitialSessionConversationState,
  sessionConversationReducer
} from '../../../../src/renderer/components/center/sessionConversationState'

describe('sessionConversationReducer', () => {
  it('transitions empty -> pending and appends user message on submit', () => {
    const initial = createInitialSessionConversationState()
    const next = sessionConversationReducer(initial, {
      type: 'SUBMIT_PROMPT',
      prompt: 'Build me a dashboard'
    })

    expect(next.runState).toBe('pending')
    expect(next.messages.at(-1)?.role).toBe('user')
    expect(next.messages.at(-1)?.content).toBe('Build me a dashboard')
  })

  it('transitions pending -> idle on successful completion', () => {
    const pending = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'hello'
    })
    const next = sessionConversationReducer(pending, {
      type: 'RUN_SUCCEEDED',
      response: 'Draft created'
    })

    expect(next.runState).toBe('idle')
    expect(next.messages.at(-1)?.role).toBe('agent')
  })

  it('transitions pending -> error and stores reason on failure', () => {
    const pending = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'hello'
    })
    const next = sessionConversationReducer(pending, {
      type: 'RUN_FAILED',
      error: 'Provider timed out'
    })

    expect(next.runState).toBe('error')
    expect(next.errorMessage).toBe('Provider timed out')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/sessionConversationState.test.ts`  
Expected: FAIL with module/file not found for new reducer/types.

**Step 3: Write minimal state model + reducer**

```ts
export type ConversationRunState = 'empty' | 'pending' | 'error' | 'idle'
export type ConversationMessageRole = 'user' | 'agent'

export type ConversationMessage = {
  id: string
  role: ConversationMessageRole
  content: string
  createdAt: string
}

export type SessionConversationState = {
  runState: ConversationRunState
  messages: ConversationMessage[]
  errorMessage?: string
}
```

```ts
export function createInitialSessionConversationState(): SessionConversationState {
  return { runState: 'empty', messages: [] }
}

export function sessionConversationReducer(
  state: SessionConversationState,
  event: SessionConversationEvent
): SessionConversationState {
  // implement SUBMIT_PROMPT, RUN_SUCCEEDED, RUN_FAILED, RETRY_FROM_ERROR
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/sessionConversationState.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/types/session-conversation.ts src/renderer/components/center/sessionConversationState.ts tests/unit/renderer/center/sessionConversationState.test.ts
git commit -m "feat(renderer): add deterministic conversation reducer states"
```

### Task 2: Add Stateful Hook for Deterministic Run Flow (Red -> Green)

**Files:**
- Create: `src/renderer/hooks/useSessionConversation.ts`
- Test: `tests/unit/renderer/hooks/useSessionConversation.test.ts`

**Step 1: Write the failing hook tests**

```ts
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSessionConversation } from '../../../../src/renderer/hooks/useSessionConversation'

describe('useSessionConversation', () => {
  it('moves to pending on submit and to idle after success', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSessionConversation())

    act(() => result.current.submitPrompt('Create spec'))
    expect(result.current.state.runState).toBe('pending')

    act(() => vi.runAllTimers())
    expect(result.current.state.runState).toBe('idle')
    vi.useRealTimers()
  })

  it('moves to error when deterministic error trigger is sent', () => {
    const { result } = renderHook(() => useSessionConversation())
    act(() => result.current.submitPrompt('/error provider timeout'))
    expect(result.current.state.runState).toBe('error')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/hooks/useSessionConversation.test.ts`  
Expected: FAIL with missing hook.

**Step 3: Implement the hook using reducer + timer**

```ts
export function useSessionConversation() {
  const [state, dispatch] = useReducer(sessionConversationReducer, undefined, createInitialSessionConversationState)

  const submitPrompt = useCallback((prompt: string) => {
    dispatch({ type: 'SUBMIT_PROMPT', prompt })
    if (prompt.trim().startsWith('/error')) {
      dispatch({ type: 'RUN_FAILED', error: 'Deterministic error state for shell testing.' })
      return
    }
    window.setTimeout(() => {
      dispatch({ type: 'RUN_SUCCEEDED', response: 'Draft ready for review.' })
    }, 900)
  }, [])

  const retry = useCallback(() => dispatch({ type: 'RETRY_FROM_ERROR' }), [])
  return { state, submitPrompt, retry }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/hooks/useSessionConversation.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/hooks/useSessionConversation.ts tests/unit/renderer/hooks/useSessionConversation.test.ts
git commit -m "feat(renderer): add deterministic session conversation hook"
```

### Task 3: Add Run Status Badge Primitive (Red -> Green)

**Files:**
- Create: `src/renderer/components/center/RunStatusBadge.tsx`
- Test: `tests/unit/renderer/center/RunStatusBadge.test.tsx`

**Step 1: Write failing badge rendering tests**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RunStatusBadge } from '../../../../src/renderer/components/center/RunStatusBadge'

describe('RunStatusBadge', () => {
  it('renders pending as Thinking', () => {
    render(<RunStatusBadge runState="pending" />)
    expect(screen.getByText('Thinking')).toBeTruthy()
  })

  it('renders error state copy', () => {
    render(<RunStatusBadge runState="error" />)
    expect(screen.getByText('Error')).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/RunStatusBadge.test.tsx`  
Expected: FAIL with missing component.

**Step 3: Implement badge with explicit mapping**

```tsx
const STATUS_MAP = {
  empty: { label: 'Ready', dotClass: 'bg-muted-foreground' },
  pending: { label: 'Thinking', dotClass: 'bg-primary animate-pulse' },
  idle: { label: 'Stopped', dotClass: 'bg-muted-foreground' },
  error: { label: 'Error', dotClass: 'bg-destructive' }
} as const
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/RunStatusBadge.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/RunStatusBadge.tsx tests/unit/renderer/center/RunStatusBadge.test.tsx
git commit -m "feat(renderer): add run status badge primitive"
```

### Task 4: Upgrade Input Bar for State-Aware Submit/Retry (Red -> Green)

**Files:**
- Modify: `src/renderer/components/center/ChatInput.tsx`
- Test: `tests/unit/renderer/center/ChatInput.test.tsx`

**Step 1: Add failing tests for pending and error behavior**

```tsx
it('locks submit while pending', () => {
  render(<ChatInput onSend={vi.fn()} runState="pending" />)
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
})

it('shows retry affordance when in error state', () => {
  const onRetry = vi.fn()
  render(<ChatInput onSend={vi.fn()} runState="error" onRetry={onRetry} />)
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(onRetry).toHaveBeenCalled()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/ChatInput.test.tsx`  
Expected: FAIL because new props/behavior are missing.

**Step 3: Implement `runState` + `onRetry` props**

```tsx
type ChatInputProps = {
  onSend: (message: string) => void
  disabled?: boolean
  runState?: 'empty' | 'pending' | 'error' | 'idle'
  onRetry?: () => void
}
```

```tsx
const isPending = runState === 'pending'
const canSend = !disabled && !isPending && value.trim().length > 0
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/ChatInput.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/ChatInput.tsx tests/unit/renderer/center/ChatInput.test.tsx
git commit -m "feat(renderer): make prompt input deterministic for pending and error states"
```

### Task 5: Integrate State Machine Into Center Conversation Panel (Red -> Green)

**Files:**
- Modify: `src/renderer/components/center/MockChatPanel.tsx`
- Modify: `src/renderer/components/center/MessageBubble.tsx`
- Test: `tests/unit/renderer/center/MockChatPanel.test.tsx`

**Step 1: Replace inference-oriented tests with deterministic state tests**

```tsx
it('renders empty pre-run state', () => {
  render(<MockChatPanel />)
  expect(screen.getByText('Ready')).toBeTruthy()
})

it('renders pending immediately after submit', () => {
  render(<MockChatPanel />)
  fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'Ship slice A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(screen.getByText('Thinking')).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/MockChatPanel.test.tsx`  
Expected: FAIL due old mocked `useMockChat` assumptions.

**Step 3: Implement integration**

```tsx
const { state, submitPrompt, retry } = useSessionConversation()

return (
  <div className="flex h-full min-h-0 flex-col">
    <MessageList>{state.messages.map((message) => <MessageBubble key={message.id} message={message} />)}</MessageList>
    <RunStatusBadge runState={state.runState} />
    <ChatInput onSend={submitPrompt} onRetry={retry} runState={state.runState} />
  </div>
)
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/MockChatPanel.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/center/MessageList.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/MockChatPanel.tsx src/renderer/components/center/MessageBubble.tsx tests/unit/renderer/center/MockChatPanel.test.tsx
git commit -m "feat(renderer): wire deterministic conversation states into center panel"
```

### Task 6: Add Runtime Adapter Boundary for Convex + PI Handoff (Red -> Green)

**Files:**
- Create: `src/renderer/types/session-runtime-adapter.ts`
- Test: `tests/unit/renderer/center/sessionRuntimeAdapter.contract.test.ts`

**Step 1: Write failing contract test**

```ts
import { describe, expect, it } from 'vitest'
import type { SessionRuntimeAdapter } from '../../../../src/renderer/types/session-runtime-adapter'

describe('SessionRuntimeAdapter contract', () => {
  it('supports subscribe + submit + retry signatures required by KAT-159', () => {
    const adapter = {} as SessionRuntimeAdapter
    expect(typeof adapter.subscribe).toBe('function')
    expect(typeof adapter.submitPrompt).toBe('function')
    expect(typeof adapter.retry).toBe('function')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/sessionRuntimeAdapter.contract.test.ts`  
Expected: FAIL with missing type/module.

**Step 3: Implement adapter interface (type-only)**

```ts
export type SessionRuntimeEvent =
  | { type: 'run_state_changed'; runState: 'empty' | 'pending' | 'error' | 'idle'; errorMessage?: string }
  | { type: 'message_appended'; message: ConversationMessage }

export type SessionRuntimeAdapter = {
  subscribe: (onEvent: (event: SessionRuntimeEvent) => void) => () => void
  submitPrompt: (prompt: string) => Promise<void> | void
  retry: () => Promise<void> | void
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/sessionRuntimeAdapter.contract.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/types/session-runtime-adapter.ts tests/unit/renderer/center/sessionRuntimeAdapter.contract.test.ts
git commit -m "chore(renderer): add runtime adapter contract for convex and pi handoff"
```

### Task 7: Capture Required State Screenshots (Evidence)

**Files:**
- Create: `tests/e2e/kat-158-session-shell-states.spec.ts`
- Create: `test-results/kat-158/` (generated output)

**Step 1: Write failing e2e evidence test**

```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

test('captures empty/pending/error/idle screenshots for KAT-158', async ({ appWindow }) => {
  await ensureWorkspaceShell(appWindow)
  const out = path.resolve(process.cwd(), 'test-results/kat-158')
  await fs.mkdir(out, { recursive: true })

  await appWindow.screenshot({ path: path.join(out, 'state-empty.png') })
  await appWindow.getByLabel('Message input').fill('Ship shell')
  await appWindow.getByRole('button', { name: 'Send' }).click()
  await expect(appWindow.getByText('Thinking')).toBeVisible()
  await appWindow.screenshot({ path: path.join(out, 'state-pending.png') })

  await appWindow.getByLabel('Message input').fill('/error force')
  await appWindow.getByRole('button', { name: 'Send' }).click()
  await expect(appWindow.getByText('Error')).toBeVisible()
  await appWindow.screenshot({ path: path.join(out, 'state-error.png') })

  await appWindow.getByRole('button', { name: 'Retry' }).click()
  await expect(appWindow.getByText('Thinking')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run build && npx playwright test tests/e2e/kat-158-session-shell-states.spec.ts`  
Expected: FAIL initially until UI/test selectors are aligned.

**Step 3: Fix selectors and timing until stable**

```ts
await expect(appWindow.getByText('Stopped')).toBeVisible({ timeout: 10_000 })
await appWindow.screenshot({ path: path.join(out, 'state-idle.png') })
```

**Step 4: Run test to verify it passes**

Run: `npm run build && npx playwright test tests/e2e/kat-158-session-shell-states.spec.ts`  
Expected: PASS and PNG files under `test-results/kat-158`.

**Step 5: Commit**

```bash
git add tests/e2e/kat-158-session-shell-states.spec.ts test-results/kat-158
git commit -m "test(e2e): capture kat-158 shell state evidence screenshots"
```

### Task 8: Full Verification and Evidence Summary

**Files:**
- Modify: `docs/plans/2026-03-01-kat-158-session-shell-conversation-primitives-design.md` (optional evidence links)
- Optional: Linear issue comment body (outside repo file)

**Step 1: Run renderer lint gate**

Run: `npm run lint`  
Expected: PASS.

**Step 2: Run focused unit suite for touched renderer modules**

Run: `npx vitest run tests/unit/renderer/center tests/unit/renderer/hooks/useSessionConversation.test.ts`  
Expected: PASS.

**Step 3: Run full unit suite**

Run: `npm run test`  
Expected: PASS.

**Step 4: Prepare completion evidence summary**

```md
## Completion Evidence
- Unit tests: PASS (center primitives + state transitions + input)
- E2E screenshots:
  - test-results/kat-158/state-empty.png
  - test-results/kat-158/state-pending.png
  - test-results/kat-158/state-error.png
  - test-results/kat-158/state-idle.png
- Demo checkpoint:
  - prompt submit observed
  - deterministic pre-run and run-pending states verified
```

**Step 5: Commit verification artifacts**

```bash
git add -A
git commit -m "test(renderer): verify kat-158 deterministic shell states and evidence"
```

## Notes for KAT-159 (Do Not Implement in KAT-158)

- Swap local reducer event source with Convex-backed runtime adapter implementation.
- Use Convex query/mutation/action boundaries for thread/message persistence and external LLM calls.
- Plug PI primitives behind adapter:
  - `@mariozechner/pi-ai` for provider/model abstraction
  - `@mariozechner/pi-agent-core` for streamed runtime events
