# KAT-171 Conversation Message Primitives + Coordinator Status Badges Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the shared center conversation primitives so Spec 02 can render coordinator-style message cards and deterministic coordinator status badges without redefining agent/context contracts.

**Architecture:** Keep the source of truth in `src/renderer/components/center/primitives/` and evolve it with a coordinator-ready card shell plus explicit status-badge adapters. Rewire existing center wrappers (`MessageBubble`, `RunStatusBadge`, mock coordinator presentation) to consume the new primitive API, and prove compatibility with the shared `SessionAgentRecord` contract from `src/shared/types/space.ts`.

**Tech Stack:** React 19, TypeScript, existing center renderer primitives, shared types in `src/shared/types/space.ts`, Vitest, Testing Library.

---

**Execution Rules:**
- Apply `@test-driven-development` on every task: red, then green, then refactor.
- Apply `@verification-before-completion` before claiming ticket completion.
- Keep scope inside `src/renderer/components/center/*`, `src/shared/types/space.ts` consumption, and center-focused tests.
- Do not implement pasted-content interaction, guided workflow UI, or right-panel spec state in this ticket.
- Keep commits small: one commit per task.

### Task 1: Expand the coordinator status-badge contract and adapters

**Files:**
- Modify: `src/renderer/components/center/primitives/types.ts`
- Modify: `src/renderer/components/center/primitives/adapters.ts`
- Modify: `src/renderer/components/center/primitives/ConversationStatusBadge.tsx`
- Modify: `src/renderer/components/center/RunStatusBadge.tsx`
- Test: `tests/unit/renderer/center/primitives/adapters.test.ts`
- Test: `tests/unit/renderer/center/primitives/ConversationStatusBadge.test.tsx`
- Test: `tests/unit/renderer/center/RunStatusBadge.test.tsx`

**Step 1: Write the failing tests**

```ts
import type { SessionAgentRecord } from '../../../../src/shared/types/space'
import {
  toCoordinatorStatusBadgeState,
  toPrimitiveRunState
} from '../../../../../src/renderer/components/center/primitives/adapters'

describe('toCoordinatorStatusBadgeState', () => {
  it.each([
    ['empty', 'ready'],
    ['pending', 'thinking'],
    ['idle', 'stopped'],
    ['error', 'error']
  ] as const)('maps conversation state %s -> %s', (input, output) => {
    expect(toCoordinatorStatusBadgeState({ conversationRunState: input })).toBe(output)
  })

  it('maps active roster lifecycle to running', () => {
    const agent: SessionAgentRecord = {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'Coordinator',
      role: 'Coordinator',
      kind: 'coordinator',
      status: 'running',
      avatarColor: '#60d394',
      sortOrder: 0,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
    }

    expect(toCoordinatorStatusBadgeState({ activeAgent: agent })).toBe('running')
  })
})
```

```tsx
import { render, screen } from '@testing-library/react'

import { ConversationStatusBadge } from '../../../../../src/renderer/components/center/primitives/ConversationStatusBadge'

describe('ConversationStatusBadge', () => {
  it.each([
    ['ready', 'Ready'],
    ['thinking', 'Thinking'],
    ['running', 'Running'],
    ['stopped', 'Stopped'],
    ['error', 'Error']
  ] as const)('renders %s -> %s', (state, label) => {
    render(<ConversationStatusBadge state={state} />)
    expect(screen.getByRole('status', { name: label })).toBeTruthy()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/center/primitives/adapters.test.ts tests/unit/renderer/center/primitives/ConversationStatusBadge.test.tsx tests/unit/renderer/center/RunStatusBadge.test.tsx`

Expected: FAIL because the new adapter function and the expanded badge API do not exist yet.

**Step 3: Write the minimal implementation**

```ts
// src/renderer/components/center/primitives/types.ts
export type CoordinatorStatusBadgeState =
  | 'ready'
  | 'thinking'
  | 'running'
  | 'stopped'
  | 'error'
```

```ts
// src/renderer/components/center/primitives/adapters.ts
import type { SessionAgentRecord } from '../../../../shared/types/space'

export function toCoordinatorStatusBadgeState(input: {
  conversationRunState?: ConversationRunState
  activeAgent?: SessionAgentRecord
}): CoordinatorStatusBadgeState {
  if (input.activeAgent && ['queued', 'delegating', 'running'].includes(input.activeAgent.status)) {
    return 'running'
  }

  switch (input.conversationRunState) {
    case 'pending':
      return 'thinking'
    case 'idle':
      return 'stopped'
    case 'error':
      return 'error'
    case 'empty':
    default:
      return 'ready'
  }
}
```

```tsx
// src/renderer/components/center/primitives/ConversationStatusBadge.tsx
const STATUS_MAP = {
  ready: { label: 'Ready', dotClass: 'bg-muted-foreground' },
  thinking: { label: 'Thinking', dotClass: 'bg-primary motion-safe:animate-pulse' },
  running: { label: 'Running', dotClass: 'bg-primary' },
  stopped: { label: 'Stopped', dotClass: 'bg-muted-foreground' },
  error: { label: 'Error', dotClass: 'bg-destructive' }
} as const
```

```tsx
// src/renderer/components/center/RunStatusBadge.tsx
export function RunStatusBadge({ runState }: { runState: ConversationRunState }) {
  return <ConversationStatusBadge state={toCoordinatorStatusBadgeState({ conversationRunState: runState })} />
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/renderer/center/primitives/adapters.test.ts tests/unit/renderer/center/primitives/ConversationStatusBadge.test.tsx tests/unit/renderer/center/RunStatusBadge.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/primitives/types.ts src/renderer/components/center/primitives/adapters.ts src/renderer/components/center/primitives/ConversationStatusBadge.tsx src/renderer/components/center/RunStatusBadge.tsx tests/unit/renderer/center/primitives/adapters.test.ts tests/unit/renderer/center/primitives/ConversationStatusBadge.test.tsx tests/unit/renderer/center/RunStatusBadge.test.tsx
git commit -m "feat(renderer): expand coordinator status badge contract"
```

### Task 2: Add a coordinator-ready `ConversationMessageCard` primitive

**Files:**
- Create: `src/renderer/components/center/primitives/ConversationMessageCard.tsx`
- Modify: `src/renderer/components/center/primitives/index.ts`
- Test: `tests/unit/renderer/center/primitives/ConversationMessageCard.test.tsx`

**Step 1: Write the failing tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConversationMessageCard } from '../../../../../src/renderer/components/center/primitives/ConversationMessageCard'

describe('ConversationMessageCard', () => {
  it('renders timestamp, body, and footer content', () => {
    render(
      <ConversationMessageCard
        message={{ id: 'u1', role: 'user', content: 'Ship coordinator UI' }}
        timestampLabel="Just now"
        footer={<span>Pasted 205 lines</span>}
      />
    )

    expect(screen.getByText('Just now')).toBeTruthy()
    expect(screen.getByText('Ship coordinator UI')).toBeTruthy()
    expect(screen.getByText('Pasted 205 lines')).toBeTruthy()
  })

  it('renders dismiss button when onDismiss is supplied', () => {
    const onDismiss = vi.fn()
    render(
      <ConversationMessageCard
        message={{ id: 'u1', role: 'user', content: 'Dismiss me' }}
        onDismiss={onDismiss}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders collapsed summary instead of full content', () => {
    render(
      <ConversationMessageCard
        message={{ id: 'u2', role: 'user', content: 'Long content', summary: 'Short summary' }}
        variant="collapsed"
        metadata={<span>2 notes context text</span>}
      />
    )

    expect(screen.getByText('Short summary')).toBeTruthy()
    expect(screen.queryByText('Long content')).toBeNull()
    expect(screen.getByText('2 notes context text')).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationMessageCard.test.tsx`

Expected: FAIL with missing `ConversationMessageCard` export/module.

**Step 3: Write the minimal implementation**

```tsx
import type { ReactNode } from 'react'

import { ConversationMessage } from './ConversationMessage'
import type { PrimitiveMessage, PrimitiveMessageVariant } from './types'

type ConversationMessageCardProps = {
  message: PrimitiveMessage
  variant?: PrimitiveMessageVariant
  timestampLabel?: string
  agentLabel?: string
  onDismiss?: () => void
  metadata?: ReactNode
  footer?: ReactNode
}

export function ConversationMessageCard({
  message,
  variant = 'default',
  timestampLabel,
  agentLabel,
  onDismiss,
  metadata,
  footer
}: ConversationMessageCardProps) {
  return (
    <article className="rounded-xl border border-border/70 bg-card/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-2">
          {timestampLabel ? <p className="text-xs text-muted-foreground">{timestampLabel}</p> : null}
          <ConversationMessage message={message} variant={variant} agentLabel={agentLabel} />
          {metadata ? <div className="text-xs text-muted-foreground">{metadata}</div> : null}
          {footer ? <div className="pt-1">{footer}</div> : null}
        </div>
        {onDismiss ? (
          <button type="button" aria-label="Dismiss message" onClick={onDismiss}>x</button>
        ) : null}
      </div>
    </article>
  )
}
```

```ts
// src/renderer/components/center/primitives/index.ts
export { ConversationMessageCard } from './ConversationMessageCard'
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationMessageCard.test.tsx tests/unit/renderer/center/primitives/index.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/primitives/ConversationMessageCard.tsx src/renderer/components/center/primitives/index.ts tests/unit/renderer/center/primitives/ConversationMessageCard.test.tsx tests/unit/renderer/center/primitives/index.test.ts
git commit -m "feat(renderer): add coordinator conversation message card primitive"
```

### Task 3: Rewire `MessageBubble` to use the message-card shell

**Files:**
- Modify: `src/renderer/components/center/MessageBubble.tsx`
- Modify: `tests/unit/renderer/center/MessageBubble.test.tsx`
- Modify: `tests/unit/renderer/center/primitives/ConversationMessage.test.tsx`

**Step 1: Write the failing wrapper tests**

```tsx
import { render, screen } from '@testing-library/react'

import { MessageBubble } from '../../../../src/renderer/components/center/MessageBubble'

describe('MessageBubble', () => {
  it('renders through ConversationMessageCard for a user message', () => {
    render(
      <MessageBubble
        message={{ id: 'u1', role: 'user', content: 'Ship coordinator UI', createdAt: '2026-03-06T00:00:00.000Z' }}
      />
    )

    expect(screen.getByText('Ship coordinator UI')).toBeTruthy()
  })

  it('renders collapsed summary when variant is collapsed', () => {
    render(
      <MessageBubble
        message={{ id: 'u2', role: 'user', content: 'Long content', createdAt: '2026-03-06T00:00:00.000Z' }}
        variant="collapsed"
        summary="Short summary"
      />
    )

    expect(screen.getByText('Short summary')).toBeTruthy()
    expect(screen.queryByText('Long content')).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/MessageBubble.test.tsx`

Expected: FAIL because `MessageBubble` still renders the older primitive layout directly.

**Step 3: Write the minimal implementation**

```tsx
import { ConversationMessageCard, toPrimitiveMessage } from './primitives'

const messageWithSummary = summary
  ? { ...primitiveMessage, summary }
  : primitiveMessage

return (
  <div className="flex flex-col gap-2">
    <ConversationMessageCard
      message={displayMessage}
      variant={variant}
    />
    {shouldRenderDecisionCard ? /* existing action row */ null : null}
  </div>
)
```

Keep the decision-card/action-row logic unchanged except for the message-card wrapper replacement.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/center/primitives/ConversationMessage.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/MessageBubble.tsx tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/center/primitives/ConversationMessage.test.tsx
git commit -m "refactor(renderer): route message bubbles through coordinator card primitive"
```

### Task 4: Update mock coordinator presentation for analyzing and metadata rows

**Files:**
- Modify: `src/renderer/components/center/mockChatPresentation.ts`
- Modify: `src/renderer/components/center/MockChatPanel.tsx`
- Modify: `tests/unit/renderer/center/mockChatPresentation.test.ts`
- Modify: `tests/unit/renderer/center/MockChatPanel.test.tsx`

**Step 1: Write the failing presentation tests**

```ts
import { deriveMockChatPresentation } from '../../../../src/renderer/components/center/mockChatPresentation'

describe('deriveMockChatPresentation', () => {
  it('emits collapsed summary block for analyzing state', () => {
    const presentation = deriveMockChatPresentation({
      messages: [
        {
          id: 'u1',
          role: 'user',
          content: 'I would like to build the following product for which I have created an overview document.'
        }
      ],
      isStreaming: true,
      forceAnalyzing: true
    })

    expect(presentation.viewState).toBe('analyzing')
    expect(presentation.blocks.some((block) => block.type === 'collapsedSummary')).toBe(true)
  })

  it('adds context chip row when context-reading or analyzing', () => {
    const presentation = deriveMockChatPresentation({
      messages: [{ id: 'u1', role: 'user', content: '# Kata Cloud (Kata V2)' }],
      isStreaming: true
    })

    expect(presentation.blocks.some((block) => block.type === 'contextChipRow')).toBe(true)
  })
})
```

```tsx
import { render, screen } from '@testing-library/react'

import { MockChatPanel } from '../../../../src/renderer/components/center/MockChatPanel'

describe('MockChatPanel', () => {
  it('renders collapsed analyzing summary and a thinking badge', () => {
    render(<MockChatPanel forceAnalyzing />)

    expect(screen.getByRole('status', { name: 'Thinking' })).toBeTruthy()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/center/mockChatPresentation.test.ts tests/unit/renderer/center/MockChatPanel.test.tsx`

Expected: FAIL because the current mock presentation does not yet route through the expanded coordinator card/badge contract.

**Step 3: Write the minimal implementation**

```ts
// mockChatPresentation.ts
export type MockChatPresentationBlock =
  | { id: string; type: 'message'; message: PrimitiveMessage }
  | { id: string; type: 'collapsedSummary'; summary: string }
  | { id: string; type: 'contextChipRow'; chips: string[] }
  | { id: string; type: 'statusBadge'; variant: PrimitiveRunState }
```

```tsx
// MockChatPanel.tsx
{block.type === 'collapsedSummary' ? (
  <ConversationMessageCard
    message={{ id: block.id, role: 'user', content: block.summary, summary: block.summary }}
    variant="collapsed"
    metadata={<span>Pasted content text</span>}
  />
) : null}
```

Keep the existing heuristics in `deriveMockChatPresentation` and only adapt the render path to the new primitive contract.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/renderer/center/mockChatPresentation.test.ts tests/unit/renderer/center/MockChatPanel.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/mockChatPresentation.ts src/renderer/components/center/MockChatPanel.tsx tests/unit/renderer/center/mockChatPresentation.test.ts tests/unit/renderer/center/MockChatPanel.test.tsx
git commit -m "feat(renderer): align mock coordinator presentation with card and badge primitives"
```

### Task 5: Add integration proof with the shared `SessionAgentRecord` contract and run focused regression

**Files:**
- Create: `tests/unit/renderer/center/primitives/coordinator-contract-integration.test.tsx`
- Modify: `tests/unit/renderer/center/ChatPanel.test.tsx`

**Step 1: Write the failing integration tests**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { SessionAgentRecord } from '../../../../../src/shared/types/space'
import {
  ConversationMessageCard
} from '../../../../../src/renderer/components/center/primitives/ConversationMessageCard'
import {
  toCoordinatorStatusBadgeState
} from '../../../../../src/renderer/components/center/primitives/adapters'
import { ConversationStatusBadge } from '../../../../../src/renderer/components/center/primitives/ConversationStatusBadge'

describe('coordinator primitive contract integration', () => {
  it('renders using a real SessionAgentRecord-derived label', () => {
    const coordinator: SessionAgentRecord = {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'Coordinator',
      role: 'Coordinator',
      kind: 'coordinator',
      status: 'running',
      avatarColor: '#60d394',
      sortOrder: 0,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
    }

    render(
      <ConversationMessageCard
        message={{ id: 'm1', role: 'agent', content: 'Draft ready.' }}
        agentLabel={coordinator.name}
      />
    )

    expect(screen.getByText('Coordinator')).toBeTruthy()
  })

  it('maps running SessionAgentRecord status to running badge state', () => {
    const coordinator: SessionAgentRecord = {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'Coordinator',
      role: 'Coordinator',
      kind: 'coordinator',
      status: 'running',
      avatarColor: '#60d394',
      sortOrder: 0,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
    }

    render(<ConversationStatusBadge state={toCoordinatorStatusBadgeState({ activeAgent: coordinator })} />)

    expect(screen.getByRole('status', { name: 'Running' })).toBeTruthy()
  })
})
```

Also add a `ChatPanel` test that still expects the visible status badge and message list after the wrapper changes.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/center/primitives/coordinator-contract-integration.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx`

Expected: FAIL until the new exports and render paths are fully wired.

**Step 3: Write the minimal implementation**

No new production module should be added here unless a test exposes a missing export. Prefer small export or wrapper fixes only:

```ts
// src/renderer/components/center/primitives/index.ts
export { ConversationMessageCard } from './ConversationMessageCard'
export { toCoordinatorStatusBadgeState } from './adapters'
```

If `ChatPanel` needs an adjustment, keep it minimal and preserve current behavior:

```tsx
<ConversationStatusBadge state={toCoordinatorStatusBadgeState({ conversationRunState: state.runState })} />
```

**Step 4: Run the focused regression suite**

Run:

```bash
npx vitest run \
  tests/unit/renderer/center/primitives/adapters.test.ts \
  tests/unit/renderer/center/primitives/ConversationStatusBadge.test.tsx \
  tests/unit/renderer/center/primitives/ConversationMessageCard.test.tsx \
  tests/unit/renderer/center/primitives/coordinator-contract-integration.test.tsx \
  tests/unit/renderer/center/RunStatusBadge.test.tsx \
  tests/unit/renderer/center/MessageBubble.test.tsx \
  tests/unit/renderer/center/MockChatPanel.test.tsx \
  tests/unit/renderer/center/mockChatPresentation.test.ts \
  tests/unit/renderer/center/ChatPanel.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/renderer/center/primitives/coordinator-contract-integration.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx src/renderer/components/center/primitives/index.ts src/renderer/components/center/ChatPanel.tsx
git commit -m "test(renderer): prove coordinator primitives against shared agent contract"
```

### Task 6: Final verification and evidence capture

**Files:**
- Modify: none unless a regression appears
- Evidence target: Linear comment/PR notes later, outside this plan's file edits

**Step 1: Run lint**

Run: `npm run lint`

Expected: PASS.

**Step 2: Run the full unit suite**

Run: `npm run test`

Expected: PASS with no new failing renderer tests.

**Step 3: Run the desktop coverage gate if time allows**

Run: `npm run test:coverage`

Expected: PASS, or capture any pre-existing unrelated failures explicitly.

**Step 4: Collect closure notes**

Record:

- which primitive files changed
- which tests prove `thinking`, `running`, and `stopped`
- which test proves `SessionAgentRecord` compatibility
- which follow-on work remains owned by `KAT-172`, `KAT-175`, and `KAT-176`

**Step 5: Commit if any verification-only fix was needed**

```bash
git add <only-files-changed-during-verification>
git commit -m "test(renderer): finalize KAT-171 primitive verification"
```

