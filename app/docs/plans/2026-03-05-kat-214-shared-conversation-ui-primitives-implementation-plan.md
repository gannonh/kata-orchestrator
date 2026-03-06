# KAT-214 Shared Conversation UI Primitives Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize a reusable center-panel conversation primitives package for specs 02/04/06 with deterministic role/status rendering and adapter-based composability.

**Architecture:** Create a renderer-local `center/primitives` layer (`types`, `adapters`, presentational primitives) and migrate current center components to thin wrappers over that contract. Keep all changes within `src/renderer/components/center/*` plus center-focused tests, and avoid shared schema or right-panel edits per KAT-214 ownership boundaries.

**Tech Stack:** React 19, TypeScript, shadcn/ui primitives, Vitest + Testing Library, existing center-panel renderer architecture.

---

**Execution Rules:**
- Apply `@test-driven-development` on every task (red -> green -> refactor).
- Apply `@verification-before-completion` before claiming ticket completion.
- Keep scope inside `src/renderer/components/center/*` and `tests/unit/renderer/center/*`.
- Keep commits small (one commit per task).

### Task 1: Add Canonical Primitive Types + Adapters

**Files:**
- Create: `src/renderer/components/center/primitives/types.ts`
- Create: `src/renderer/components/center/primitives/adapters.ts`
- Test: `tests/unit/renderer/center/primitives/adapters.test.ts`

**Step 1: Write the failing adapter tests**

```ts
import { describe, expect, it } from 'vitest'

import {
  toPrimitiveMessage,
  toPrimitiveRunState
} from '../../../../../src/renderer/components/center/primitives/adapters'

describe('center primitives adapters', () => {
  it('maps ConversationMessage role/content to PrimitiveMessage', () => {
    const mapped = toPrimitiveMessage({
      id: 'agent-1',
      role: 'agent',
      content: 'Draft ready.',
      createdAt: '2026-03-05T00:00:00.000Z'
    })

    expect(mapped.role).toBe('agent')
    expect(mapped.content).toBe('Draft ready.')
  })

  it('maps assistant role to agent primitive role', () => {
    const mapped = toPrimitiveMessage({
      id: 'assistant-1',
      role: 'assistant',
      content: 'Hello',
    })

    expect(mapped.role).toBe('agent')
  })

  it.each([
    ['empty', 'empty'],
    ['pending', 'pending'],
    ['idle', 'idle'],
    ['error', 'error']
  ] as const)('maps run state %s -> %s', (input, output) => {
    expect(toPrimitiveRunState(input)).toBe(output)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/primitives/adapters.test.ts`  
Expected: FAIL with missing primitive adapter module.

**Step 3: Implement minimal primitive types + adapters**

```ts
// primitives/types.ts
export type PrimitiveMessageRole = 'user' | 'agent' | 'system'
export type PrimitiveRunState = 'empty' | 'pending' | 'idle' | 'error'
export type PrimitiveMessageVariant = 'default' | 'collapsed'

export type PrimitiveMessage = {
  id: string
  role: PrimitiveMessageRole
  content: string
  createdAt?: string
  summary?: string
}
```

```ts
// primitives/adapters.ts
import type { ChatMessage } from '../../../types/chat'
import type { ConversationMessage, ConversationRunState } from '../../../types/session-conversation'
import type { PrimitiveMessage, PrimitiveRunState } from './types'

export function toPrimitiveMessage(message: ConversationMessage | ChatMessage): PrimitiveMessage {
  const role = message.role === 'assistant' ? 'agent' : message.role
  return {
    id: message.id,
    role,
    content: message.content,
    createdAt: 'createdAt' in message ? message.createdAt : undefined
  }
}

export function toPrimitiveRunState(runState: ConversationRunState): PrimitiveRunState {
  return runState
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/primitives/adapters.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/primitives/types.ts src/renderer/components/center/primitives/adapters.ts tests/unit/renderer/center/primitives/adapters.test.ts
git commit -m "feat(renderer): add center conversation primitive type and adapter contracts"
```

### Task 2: Extract `ConversationMessage` Primitive and Wrap `MessageBubble`

**Files:**
- Create: `src/renderer/components/center/primitives/ConversationMessage.tsx`
- Modify: `src/renderer/components/center/MessageBubble.tsx`
- Test: `tests/unit/renderer/center/primitives/ConversationMessage.test.tsx`
- Modify: `tests/unit/renderer/center/MessageBubble.test.tsx`

**Step 1: Write the failing primitive message tests**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ConversationMessage } from '../../../../../src/renderer/components/center/primitives/ConversationMessage'

describe('ConversationMessage', () => {
  it('renders user role as plain text with You label', () => {
    render(<ConversationMessage message={{ id: 'u1', role: 'user', content: 'Ship slice A' }} />)
    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('Ship slice A')).toBeTruthy()
  })

  it('renders agent role via markdown with Kata label', () => {
    render(<ConversationMessage message={{ id: 'a1', role: 'agent', content: '## Summary' }} />)
    expect(screen.getByText('Kata')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Summary', level: 2 })).toBeTruthy()
  })

  it('renders collapsed variant summary when provided', () => {
    render(
      <ConversationMessage
        message={{ id: 'u2', role: 'user', content: 'Long content', summary: 'Short summary' }}
        variant="collapsed"
      />
    )

    expect(screen.getByText('Short summary')).toBeTruthy()
    expect(screen.queryByText('Long content')).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationMessage.test.tsx`  
Expected: FAIL with missing primitive component.

**Step 3: Implement primitive and adapt `MessageBubble` into wrapper**

```tsx
// primitives/ConversationMessage.tsx
import { MarkdownRenderer } from '../../shared/MarkdownRenderer'
import { cn } from '../../../lib/cn'
import type { PrimitiveMessage, PrimitiveMessageVariant } from './types'

type Props = {
  message: PrimitiveMessage
  variant?: PrimitiveMessageVariant
}

export function ConversationMessage({ message, variant = 'default' }: Props) {
  const isUser = message.role === 'user'
  const isCollapsed = variant === 'collapsed' && Boolean(message.summary?.trim())
  const content = isCollapsed ? message.summary ?? '' : message.content

  return (
    <article className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{isUser ? 'You' : 'Kata'}</span>
      <div className={cn('max-w-[85%] rounded-xl border px-4 py-3', isUser ? 'border-primary/20 bg-primary/10 text-foreground' : 'bg-card text-muted-foreground')}>
        {isUser ? <p className="m-0 whitespace-pre-wrap text-sm leading-6">{content}</p> : <MarkdownRenderer content={content} />}
      </div>
    </article>
  )
}
```

```tsx
// MessageBubble.tsx (wrapper intent)
import { ConversationMessage } from './primitives/ConversationMessage'
import { toPrimitiveMessage } from './primitives/adapters'
```

**Step 4: Run updated tests**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationMessage.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/primitives/ConversationMessage.tsx src/renderer/components/center/MessageBubble.tsx tests/unit/renderer/center/primitives/ConversationMessage.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx
git commit -m "refactor(renderer): extract conversation message primitive and wrap MessageBubble"
```

### Task 3: Extract `ConversationStatusBadge` Primitive and Wrap `RunStatusBadge`

**Files:**
- Create: `src/renderer/components/center/primitives/ConversationStatusBadge.tsx`
- Modify: `src/renderer/components/center/RunStatusBadge.tsx`
- Create: `tests/unit/renderer/center/primitives/ConversationStatusBadge.test.tsx`
- Modify: `tests/unit/renderer/center/RunStatusBadge.test.tsx`

**Step 1: Write failing primitive badge tests**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ConversationStatusBadge } from '../../../../../src/renderer/components/center/primitives/ConversationStatusBadge'

describe('ConversationStatusBadge', () => {
  it.each([
    ['empty', 'Ready'],
    ['pending', 'Thinking'],
    ['idle', 'Stopped'],
    ['error', 'Error']
  ] as const)('renders %s -> %s', (runState, label) => {
    render(<ConversationStatusBadge runState={runState} />)
    expect(screen.getByRole('status', { name: label })).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationStatusBadge.test.tsx`  
Expected: FAIL with missing primitive module.

**Step 3: Implement primitive and convert wrapper**

```tsx
// primitives/ConversationStatusBadge.tsx
import type { PrimitiveRunState } from './types'

const STATUS_MAP = {
  empty: { label: 'Ready', dotClass: 'bg-muted-foreground' },
  pending: { label: 'Thinking', dotClass: 'bg-primary motion-safe:animate-pulse' },
  idle: { label: 'Stopped', dotClass: 'bg-muted-foreground' },
  error: { label: 'Error', dotClass: 'bg-destructive' }
} as const

export function ConversationStatusBadge({ runState }: { runState: PrimitiveRunState }) {
  const status = STATUS_MAP[runState]
  return (
    <div role="status" aria-live="polite" aria-label={status.label} className="inline-flex w-fit items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground">
      <span aria-hidden="true" className={`inline-flex h-2 w-2 rounded-full ${status.dotClass}`} />
      <span>{status.label}</span>
    </div>
  )
}
```

**Step 4: Run updated tests**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationStatusBadge.test.tsx tests/unit/renderer/center/RunStatusBadge.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/primitives/ConversationStatusBadge.tsx src/renderer/components/center/RunStatusBadge.tsx tests/unit/renderer/center/primitives/ConversationStatusBadge.test.tsx tests/unit/renderer/center/RunStatusBadge.test.tsx
git commit -m "refactor(renderer): extract conversation status badge primitive"
```

### Task 4: Extract `ConversationStream` Primitive and Wrap `MessageList`

**Files:**
- Create: `src/renderer/components/center/primitives/ConversationStream.tsx`
- Modify: `src/renderer/components/center/MessageList.tsx`
- Create: `tests/unit/renderer/center/primitives/ConversationStream.test.tsx`
- Modify: `tests/unit/renderer/center/MessageList.test.tsx`

**Step 1: Write failing stream primitive tests**

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConversationStream } from '../../../../../src/renderer/components/center/primitives/ConversationStream'

describe('ConversationStream', () => {
  it('registers scrollToMessage callback', () => {
    const onRegisterScrollToMessage = vi.fn()
    render(
      <ConversationStream onRegisterScrollToMessage={onRegisterScrollToMessage}>
        <div data-message-id="m-1">Message</div>
      </ConversationStream>
    )

    expect(onRegisterScrollToMessage).toHaveBeenCalledWith(expect.any(Function))
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationStream.test.tsx`  
Expected: FAIL with missing primitive module.

**Step 3: Implement primitive and wrapper**

```tsx
// primitives/ConversationStream.tsx
import { type ReactNode } from 'react'
import { ScrollArea } from '../../ui/scroll-area'

export type ScrollToMessage = (messageId: string) => boolean

export function ConversationStream({ children }: { children: ReactNode }) {
  return (
    <ScrollArea data-testid="message-list" className="min-h-0 flex-1 px-0">
      <div className="space-y-5 p-4">{children}</div>
    </ScrollArea>
  )
}
```

```tsx
// MessageList.tsx wrapper keeps existing scroll helper API, delegates render container to ConversationStream
```

**Step 4: Run updated tests**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationStream.test.tsx tests/unit/renderer/center/MessageList.test.tsx tests/unit/renderer/center/MessageList.null-ref.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/primitives/ConversationStream.tsx src/renderer/components/center/MessageList.tsx tests/unit/renderer/center/primitives/ConversationStream.test.tsx tests/unit/renderer/center/MessageList.test.tsx tests/unit/renderer/center/MessageList.null-ref.test.tsx
git commit -m "refactor(renderer): extract conversation stream primitive and preserve scroll helpers"
```

### Task 5: Normalize Inline Actions and Block Rendering Primitives

**Files:**
- Create: `src/renderer/components/center/primitives/ConversationMessageActions.tsx`
- Create: `src/renderer/components/center/primitives/ConversationBlocks.tsx`
- Modify: `src/renderer/components/center/MessageActionRow.tsx`
- Modify: `src/renderer/components/center/ToolCallResult.tsx`
- Create: `tests/unit/renderer/center/primitives/ConversationMessageActions.test.tsx`
- Create: `tests/unit/renderer/center/primitives/ConversationBlocks.test.tsx`

**Step 1: Write failing tests for actions + blocks**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConversationMessageActions } from '../../../../../src/renderer/components/center/primitives/ConversationMessageActions'

describe('ConversationMessageActions', () => {
  it('renders actions and calls onAction', () => {
    const onAction = vi.fn()
    render(
      <ConversationMessageActions
        actions={[{ id: 'approve', label: 'Approve', variant: 'default' }]}
        onAction={onAction}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onAction).toHaveBeenCalledWith('approve')
  })
})
```

**Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationMessageActions.test.tsx tests/unit/renderer/center/primitives/ConversationBlocks.test.tsx`  
Expected: FAIL with missing primitives.

**Step 3: Implement primitives and wrap existing action/tool components**

```tsx
// ConversationMessageActions delegates button rendering and preserves disabled semantics
// ConversationBlocks renders context-chip rows + tool-call blocks using existing ToolCallResult behavior
```

**Step 4: Run tests for updated behavior**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationMessageActions.test.tsx tests/unit/renderer/center/primitives/ConversationBlocks.test.tsx tests/unit/renderer/center/MessageActionRow.test.tsx tests/unit/renderer/center/ToolCallResult.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/primitives/ConversationMessageActions.tsx src/renderer/components/center/primitives/ConversationBlocks.tsx src/renderer/components/center/MessageActionRow.tsx src/renderer/components/center/ToolCallResult.tsx tests/unit/renderer/center/primitives/ConversationMessageActions.test.tsx tests/unit/renderer/center/primitives/ConversationBlocks.test.tsx
git commit -m "refactor(renderer): add shared conversation action and block primitives"
```

### Task 6: Migrate `ChatPanel` and `MockChatPanel` to Primitive APIs

**Files:**
- Modify: `src/renderer/components/center/ChatPanel.tsx`
- Modify: `src/renderer/components/center/MockChatPanel.tsx`
- Modify: `src/renderer/components/center/mockChatPresentation.ts`
- Test: `tests/unit/renderer/center/ChatPanel.test.tsx`
- Test: `tests/unit/renderer/center/MockChatPanel.test.tsx`
- Test: `tests/unit/renderer/center/mockChatPresentation.test.ts`

**Step 1: Write failing integration assertions for primitive-backed rendering**

```tsx
it('renders conversation via primitive wrappers while preserving decision actions', () => {
  // existing hook mock + eligible decision message
  // assert action buttons still render and submit callback behavior unchanged
})

it('preserves deterministic pending -> stopped status flow in MockChatPanel', () => {
  // send prompt, advance fake timers, verify Thinking then Stopped
})
```

**Step 2: Run tests to verify failures**

Run: `npx vitest run tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/center/MockChatPanel.test.tsx tests/unit/renderer/center/mockChatPresentation.test.ts`  
Expected: FAIL after primitive API switch until panel call sites are updated.

**Step 3: Implement panel migration**

```ts
// ChatPanel: map incoming message/run state through adapters, render primitive wrappers only
// MockChatPanel: same primitive path to ensure spec-02 deterministic preview parity
```

**Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/center/MockChatPanel.test.tsx tests/unit/renderer/center/mockChatPresentation.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/ChatPanel.tsx src/renderer/components/center/MockChatPanel.tsx src/renderer/components/center/mockChatPresentation.ts tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/center/MockChatPanel.test.tsx tests/unit/renderer/center/mockChatPresentation.test.ts
git commit -m "refactor(renderer): migrate center chat panels to shared conversation primitives"
```

### Task 7: Barrel Export, Regression Sweep, and Evidence Prep

**Files:**
- Create: `src/renderer/components/center/primitives/index.ts`
- Modify: `src/renderer/components/center/MessageBubble.tsx`
- Modify: `src/renderer/components/center/RunStatusBadge.tsx`
- Modify: `src/renderer/components/center/MessageList.tsx`
- Modify: `docs/plans/2026-03-05-kat-214-shared-conversation-ui-primitives-design.md` (optional short implementation note)

**Step 1: Write failing contract test for primitive barrel exports**

```ts
import { describe, expect, it } from 'vitest'
import * as primitives from '../../../../../src/renderer/components/center/primitives'

describe('center primitives index', () => {
  it('exports the canonical primitive API', () => {
    expect(typeof primitives.ConversationMessage).toBe('function')
    expect(typeof primitives.ConversationStatusBadge).toBe('function')
    expect(typeof primitives.toPrimitiveMessage).toBe('function')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/primitives/index.test.ts`  
Expected: FAIL with missing barrel.

**Step 3: Add barrel exports and run full center unit suite**

Run:

```bash
npx vitest run tests/unit/renderer/center/**/*.test.ts tests/unit/renderer/center/*.test.tsx
```

Expected: PASS across center suite with no regressions.

**Step 4: Run targeted app quality checks relevant to ticket**

Run:

```bash
npm run lint
npm run test -- tests/unit/renderer/center
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/primitives/index.ts src/renderer/components/center/MessageBubble.tsx src/renderer/components/center/RunStatusBadge.tsx src/renderer/components/center/MessageList.tsx tests/unit/renderer/center/primitives/index.test.ts
git commit -m "chore(renderer): finalize shared conversation primitives package exports and regression coverage"
```

## Final Verification Checklist

- Primitive API is centralized under `src/renderer/components/center/primitives/*`.
- `ChatPanel` and `MockChatPanel` consume primitive wrappers, not divergent rendering paths.
- Deterministic run-state rendering (`Ready`, `Thinking`, `Stopped`, `Error`) remains intact.
- All center unit tests pass.
- No edits to `src/shared/types/*` or `src/renderer/components/right/*`.

