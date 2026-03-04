# KAT-187 Approval Actions in Conversation (Tech Stack / Plan Decisions) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement inline approval actions in center conversation messages (mock 12/13 parity) so users can approve or redirect a tech-stack proposal directly from the conversation bubble.

**Architecture:** Keep the existing `useIpcSessionConversation -> ChatPanel -> MessageBubble` flow and add a renderer-only decision extraction layer for eligible agent messages. Route action clicks through the existing `submitPrompt` path so user decisions remain part of normal run/message history. Derive action resolution from message order instead of adding new persisted schema.

**Tech Stack:** React 19, TypeScript, shadcn/ui `Button`, Vitest + Testing Library, Playwright Electron e2e.

---

**Execution Rules:**
- Apply `@test-driven-development` on every task (red -> green -> refactor).
- Apply `@verification-before-completion` before marking KAT-187 complete.
- Keep commits small and frequent (one commit per task).

### Task 1: Add Decision Parsing Domain for Mock-12/13 Agent Messages

**Files:**
- Create: `src/renderer/components/center/message-decision-parser.ts`
- Test: `tests/unit/renderer/center/message-decision-parser.test.ts`

**Step 1: Write the failing parser tests**

```ts
import { describe, expect, it } from 'vitest'

import {
  extractInlineDecisionCard,
  isDecisionResolved
} from '../../../../src/renderer/components/center/message-decision-parser'
import type { ConversationMessage } from '../../../../src/renderer/types/session-conversation'

const proposal = [
  '## Why',
  '- Electron + TypeScript keeps desktop iteration stable',
  '',
  '## How to keep Tech stable later',
  '- Keep provider adapter boundaries explicit',
  '',
  'Approve this plan with 1 check? Clarifications',
  '- Approve the plan...',
  '- Keep the last switch...'
].join('\n')

describe('message-decision-parser', () => {
  it('extracts an inline decision card from mock-12/13 shaped agent content', () => {
    const card = extractInlineDecisionCard({
      id: 'agent-1',
      role: 'agent',
      content: proposal,
      createdAt: '2026-03-03T00:00:01.000Z'
    })

    expect(card?.sourceMessageId).toBe('agent-1')
    expect(card?.actions.map((action) => action.id)).toEqual([
      'approve_tech_stack_plan',
      'keep_last_stack_switch',
      'ask_for_clarification'
    ])
  })

  it('returns undefined for non-decision messages', () => {
    const card = extractInlineDecisionCard({
      id: 'agent-2',
      role: 'agent',
      content: 'General planning update with no approval prompt.',
      createdAt: '2026-03-03T00:00:01.000Z'
    })

    expect(card).toBeUndefined()
  })

  it('derives resolved state when a later user message matches action follow-up prompt', () => {
    const messages: ConversationMessage[] = [
      {
        id: 'agent-1',
        role: 'agent',
        content: proposal,
        createdAt: '2026-03-03T00:00:01.000Z'
      },
      {
        id: 'user-1',
        role: 'user',
        content: 'Approve the plan and continue with this tech stack.',
        createdAt: '2026-03-03T00:00:02.000Z'
      }
    ]

    const card = extractInlineDecisionCard(messages[0]!)
    expect(card).toBeTruthy()
    expect(isDecisionResolved(messages, card!)).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/message-decision-parser.test.ts`  
Expected: FAIL with missing parser module.

**Step 3: Implement minimal parser and resolution helpers**

```ts
import type { ConversationMessage } from '../../types/session-conversation'

export type InlineDecisionActionId =
  | 'approve_tech_stack_plan'
  | 'keep_last_stack_switch'
  | 'ask_for_clarification'

export type InlineDecisionAction = {
  id: InlineDecisionActionId
  label: string
  followUpPrompt: string
  variant: 'default' | 'secondary' | 'outline'
}

export type InlineDecisionCard = {
  sourceMessageId: string
  promptLabel: string
  actions: InlineDecisionAction[]
}

const BASE_ACTIONS: InlineDecisionAction[] = [
  {
    id: 'approve_tech_stack_plan',
    label: 'Approve the plan...',
    followUpPrompt: 'Approve the plan and continue with this tech stack.',
    variant: 'default'
  },
  {
    id: 'keep_last_stack_switch',
    label: 'Keep the last switch...',
    followUpPrompt: 'Keep the last switch and apply the revised views.',
    variant: 'secondary'
  },
  {
    id: 'ask_for_clarification',
    label: 'Clarifications',
    followUpPrompt: 'I need clarifications before approving this plan.',
    variant: 'outline'
  }
]

export function extractInlineDecisionCard(
  message: Pick<ConversationMessage, 'id' | 'role' | 'content'>
): InlineDecisionCard | undefined {
  if (message.role !== 'agent') return undefined

  const content = message.content.toLowerCase()
  const hasPrompt = content.includes('approve this plan')
  const hasApproveLabel = content.includes('approve the plan')
  const hasSwitchLabel = content.includes('keep the last switch')
  if (!hasPrompt || !hasApproveLabel || !hasSwitchLabel) return undefined

  return {
    sourceMessageId: message.id,
    promptLabel: 'Approve this plan with 1 check? Clarifications',
    actions: BASE_ACTIONS
  }
}

export function isDecisionResolved(
  messages: ConversationMessage[],
  card: InlineDecisionCard
): boolean {
  const sourceIndex = messages.findIndex((message) => message.id === card.sourceMessageId)
  if (sourceIndex < 0) return false

  const userFollowUps = new Set(card.actions.map((action) => action.followUpPrompt))
  return messages
    .slice(sourceIndex + 1)
    .some((message) => message.role === 'user' && userFollowUps.has(message.content))
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/message-decision-parser.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/message-decision-parser.ts tests/unit/renderer/center/message-decision-parser.test.ts
git commit -m "feat(renderer): add inline decision parser for tech-stack proposal messages"
```

### Task 2: Add Reusable Message Action Row UI

**Files:**
- Create: `src/renderer/components/center/MessageActionRow.tsx`
- Test: `tests/unit/renderer/center/MessageActionRow.test.tsx`

**Step 1: Write the failing component tests**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MessageActionRow } from '../../../../src/renderer/components/center/MessageActionRow'

describe('MessageActionRow', () => {
  afterEach(() => cleanup())

  it('renders all provided actions as buttons', () => {
    render(
      <MessageActionRow
        actions={[
          { id: 'a', label: 'Approve', variant: 'default' },
          { id: 'b', label: 'Keep switch', variant: 'secondary' }
        ]}
        disabled={false}
        onAction={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep switch' })).toBeTruthy()
  })

  it('calls onAction with the selected action id', () => {
    const onAction = vi.fn()
    render(
      <MessageActionRow
        actions={[{ id: 'a', label: 'Approve', variant: 'default' }]}
        disabled={false}
        onAction={onAction}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onAction).toHaveBeenCalledWith('a')
  })

  it('disables all buttons when disabled is true', () => {
    render(
      <MessageActionRow
        actions={[{ id: 'a', label: 'Approve', variant: 'default' }]}
        disabled
        onAction={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/MessageActionRow.test.tsx`  
Expected: FAIL with missing component module.

**Step 3: Implement minimal action-row component**

```tsx
import { Button } from '../ui/button'

type MessageAction = {
  id: string
  label: string
  variant: 'default' | 'secondary' | 'outline'
}

type MessageActionRowProps = {
  actions: MessageAction[]
  disabled: boolean
  onAction: (actionId: string) => void
}

export function MessageActionRow({ actions, disabled, onAction }: MessageActionRowProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          size="sm"
          variant={action.variant}
          disabled={disabled}
          onClick={() => onAction(action.id)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/MessageActionRow.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/MessageActionRow.tsx tests/unit/renderer/center/MessageActionRow.test.tsx
git commit -m "feat(renderer): add reusable inline message action row"
```

### Task 3: Render Decision Actions in MessageBubble

**Files:**
- Modify: `src/renderer/components/center/MessageBubble.tsx`
- Modify: `tests/unit/renderer/center/MessageBubble.test.tsx`

**Step 1: Add failing tests for decision-row rendering and disabled state**

```tsx
it('renders decision actions under agent message when decision card is provided', () => {
  render(
    <MessageBubble
      message={{
        id: 'agent-1',
        role: 'agent',
        content: 'Tech proposal content',
        createdAt: '2026-03-03T00:00:01.000Z'
      }}
      decisionCard={{
        sourceMessageId: 'agent-1',
        promptLabel: 'Approve this plan with 1 check? Clarifications',
        actions: [
          {
            id: 'approve_tech_stack_plan',
            label: 'Approve the plan...',
            followUpPrompt: 'Approve the plan and continue with this tech stack.',
            variant: 'default'
          }
        ]
      }}
      decisionState="available"
      onDecisionAction={() => {}}
    />
  )

  expect(screen.getByRole('button', { name: 'Approve the plan...' })).toBeTruthy()
})

it('disables decision actions when decision state is pending', () => {
  render(
    <MessageBubble
      message={{
        id: 'agent-1',
        role: 'agent',
        content: 'Tech proposal content',
        createdAt: '2026-03-03T00:00:01.000Z'
      }}
      decisionCard={{
        sourceMessageId: 'agent-1',
        promptLabel: 'Approve this plan with 1 check? Clarifications',
        actions: [
          {
            id: 'approve_tech_stack_plan',
            label: 'Approve the plan...',
            followUpPrompt: 'Approve the plan and continue with this tech stack.',
            variant: 'default'
          }
        ]
      }}
      decisionState="pending"
      onDecisionAction={() => {}}
    />
  )

  expect(screen.getByRole('button', { name: 'Approve the plan...' })).toBeDisabled()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/MessageBubble.test.tsx`  
Expected: FAIL because `MessageBubble` does not accept decision props.

**Step 3: Implement MessageBubble decision rendering**

```tsx
import { MessageActionRow } from './MessageActionRow'
import type { InlineDecisionCard } from './message-decision-parser'

type DecisionState = 'available' | 'pending' | 'resolved'

type MessageBubbleProps = {
  message: BubbleMessage
  variant?: 'default' | 'collapsed'
  summary?: string
  decisionCard?: InlineDecisionCard
  decisionState?: DecisionState
  onDecisionAction?: (actionId: string) => void
}

// Inside agent-message render path:
{decisionCard ? (
  <>
    <p className="mt-3 text-xs text-muted-foreground">{decisionCard.promptLabel}</p>
    <MessageActionRow
      actions={decisionCard.actions}
      disabled={decisionState === 'pending' || decisionState === 'resolved'}
      onAction={(actionId) => {
        onDecisionAction?.(actionId)
      }}
    />
    {decisionState === 'resolved' ? (
      <p className="mt-2 text-xs text-muted-foreground">Decision sent</p>
    ) : null}
  </>
) : null}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/MessageBubble.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/MessageBubble.tsx tests/unit/renderer/center/MessageBubble.test.tsx
git commit -m "feat(renderer): render inline decision actions in agent message bubbles"
```

### Task 4: Wire Decision Extraction and Action Submission in ChatPanel

**Files:**
- Modify: `src/renderer/components/center/ChatPanel.tsx`
- Modify: `tests/unit/renderer/center/ChatPanel.test.tsx`

**Step 1: Add failing ChatPanel tests for action click and resolved state**

```tsx
it('renders inline decision actions for eligible agent messages', () => {
  mockHook.mockReturnValue({
    state: idleState({
      messages: [
        {
          id: 'agent-1',
          role: 'agent',
          createdAt: '2026-03-03T00:00:01.000Z',
          content: [
            'Approve this plan with 1 check? Clarifications',
            '- Approve the plan...',
            '- Keep the last switch...'
          ].join('\n')
        }
      ]
    }),
    submitPrompt: vi.fn(),
    retry: vi.fn()
  })

  render(<ChatPanel sessionId="sess-1" />)
  expect(screen.getByRole('button', { name: 'Approve the plan...' })).toBeTruthy()
})

it('clicking an inline decision action submits the mapped follow-up prompt', () => {
  const submitPrompt = vi.fn()
  mockHook.mockReturnValue({
    state: idleState({
      messages: [
        {
          id: 'agent-1',
          role: 'agent',
          createdAt: '2026-03-03T00:00:01.000Z',
          content: [
            'Approve this plan with 1 check? Clarifications',
            '- Approve the plan...',
            '- Keep the last switch...'
          ].join('\n')
        }
      ]
    }),
    submitPrompt,
    retry: vi.fn()
  })

  render(<ChatPanel sessionId="sess-1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Approve the plan...' }))

  expect(submitPrompt).toHaveBeenCalledWith('Approve the plan and continue with this tech stack.')
})

it('disables action buttons while run state is pending', () => {
  mockHook.mockReturnValue({
    state: idleState({
      runState: 'pending',
      messages: [
        {
          id: 'agent-1',
          role: 'agent',
          createdAt: '2026-03-03T00:00:01.000Z',
          content: [
            'Approve this plan with 1 check? Clarifications',
            '- Approve the plan...',
            '- Keep the last switch...'
          ].join('\n')
        }
      ]
    }),
    submitPrompt: vi.fn(),
    retry: vi.fn()
  })

  render(<ChatPanel sessionId="sess-1" />)
  expect(screen.getByRole('button', { name: 'Approve the plan...' })).toBeDisabled()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/ChatPanel.test.tsx`  
Expected: FAIL because `ChatPanel` does not render decision actions.

**Step 3: Implement ChatPanel decision wiring**

```tsx
import {
  extractInlineDecisionCard,
  isDecisionResolved
} from './message-decision-parser'

// For each message in render map:
const decisionCard = message.role === 'agent' ? extractInlineDecisionCard(message) : undefined
const decisionState =
  decisionCard == null
    ? undefined
    : state.runState === 'pending'
      ? 'pending'
      : isDecisionResolved(state.messages, decisionCard)
        ? 'resolved'
        : 'available'

<MessageBubble
  message={message}
  decisionCard={decisionCard}
  decisionState={decisionState}
  onDecisionAction={(actionId) => {
    if (!decisionCard) return
    const action = decisionCard.actions.find((item) => item.id === actionId)
    if (!action) return
    submitPrompt(action.followUpPrompt)
  }}
/>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/ChatPanel.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/ChatPanel.tsx tests/unit/renderer/center/ChatPanel.test.tsx
git commit -m "feat(renderer): wire conversation decision actions through chat panel"
```

### Task 5: Add Hook Replay Contract Coverage for Resolved Decisions

**Files:**
- Modify: `tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`

**Step 1: Add failing replay-contract test**

```ts
it('replay keeps decision follow-up prompt as a normal persisted user message', async () => {
  mockRunList.mockResolvedValue([
    {
      id: 'run-1',
      sessionId: 's-1',
      prompt: 'Initial planning request',
      status: 'completed',
      model: 'm',
      provider: 'p',
      createdAt: '2026-03-03T00:00:00.000Z',
      messages: [
        {
          id: 'agent-1',
          role: 'agent',
          content: 'Approve this plan with 1 check? Clarifications\n- Approve the plan...\n- Keep the last switch...',
          createdAt: '2026-03-03T00:00:01.000Z'
        },
        {
          id: 'user-1',
          role: 'user',
          content: 'Approve the plan and continue with this tech stack.',
          createdAt: '2026-03-03T00:00:02.000Z'
        }
      ]
    }
  ])

  const { useIpcSessionConversation } = await import(
    '../../../../src/renderer/hooks/useIpcSessionConversation'
  )
  const { result } = renderHook(() => useIpcSessionConversation('s-1'))

  await act(async () => {
    await Promise.resolve()
  })

  expect(result.current.state.messages.map((message) => message.id)).toEqual(['agent-1', 'user-1'])
  expect(result.current.state.messages[1]?.content).toBe(
    'Approve the plan and continue with this tech stack.'
  )
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`  
Expected: FAIL until replay ordering/expectations are aligned with existing event reducer semantics.

**Step 3: Apply minimal hook/reducer adjustments if needed**

```ts
// Keep replay append/update semantics id-stable.
// Ensure APPEND_MESSAGE events are idempotent and preserve persisted order by createdAt.
// Do not introduce any decision-specific persistence fields.
```

If current hook behavior already satisfies this contract, keep production code unchanged and retain the test as guard coverage.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/renderer/hooks/useIpcSessionConversation.test.ts src/renderer/hooks/useIpcSessionConversation.ts src/renderer/components/center/sessionConversationState.ts
git commit -m "test(renderer): lock replay contract for inline decision follow-up prompts"
```

### Task 6: Capture KAT-187 UI Evidence for Mock-12/13 Inline Decision Actions

**Files:**
- Create: `tests/e2e/kat-187-approval-actions.spec.ts`

**Step 1: Write failing e2e evidence test**

```ts
import { expect, test } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

test.describe('KAT-187 approval actions parity @uat', () => {
  test('shows inline approval actions and captures post-click state', async ({ appWindow }) => {
    await ensureWorkspaceShell(appWindow)

    // Seed a planning prompt so an agent response appears.
    await appWindow.getByLabel('Message input').fill('Propose a stable tech stack for this desktop app.')
    await appWindow.getByRole('button', { name: 'Send' }).click()
    await expect(appWindow.getByRole('status', { name: 'Stopped' })).toBeVisible({ timeout: 20_000 })

    // Approval action row should be visible on eligible message.
    await expect(appWindow.getByRole('button', { name: 'Approve the plan...' })).toBeVisible()
    await expect(appWindow.getByRole('button', { name: 'Keep the last switch...' })).toBeVisible()

    await appWindow.screenshot({ path: 'test-results/kat-187/mock12-actions-visible.png', fullPage: true })

    await appWindow.getByRole('button', { name: 'Approve the plan...' }).click()
    await expect(appWindow.getByRole('status', { name: 'Thinking' })).toBeVisible()
    await expect(appWindow.getByRole('status', { name: 'Stopped' })).toBeVisible({ timeout: 20_000 })

    await appWindow.screenshot({ path: 'test-results/kat-187/mock13-actions-post-click.png', fullPage: true })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/kat-187-approval-actions.spec.ts`  
Expected: FAIL before inline action UI exists.

**Step 3: Implement selector/fixture refinements for deterministic evidence**

```ts
// Harden selectors to avoid ambiguous matches:
// - Scope button queries to the latest agent message bubble when needed.
// - Add wait conditions for run status idle before each screenshot.
// - Keep evidence output paths stable under test-results/kat-187/.
```

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/e2e/kat-187-approval-actions.spec.ts`  
Expected: PASS with PNG artifacts created.

**Step 5: Commit**

```bash
git add tests/e2e/kat-187-approval-actions.spec.ts test-results/kat-187/mock12-actions-visible.png test-results/kat-187/mock13-actions-post-click.png
git commit -m "test(e2e): add KAT-187 inline approval action evidence capture"
```

### Task 7: Final Verification Gate and Evidence Checklist

**Files:**
- Modify: `docs/plans/2026-03-03-kat-187-approval-actions-conversation-implementation-plan.md` (verification notes section only)

**Step 1: Run targeted unit/integration suite**

Run:
`npx vitest run tests/unit/renderer/center/message-decision-parser.test.ts tests/unit/renderer/center/MessageActionRow.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`  
Expected: PASS.

**Step 2: Run e2e evidence test**

Run: `npx playwright test tests/e2e/kat-187-approval-actions.spec.ts`  
Expected: PASS.

**Step 3: Verify acceptance checklist**

Checklist:

- Inline action row appears only for eligible tech-stack proposal messages.
- Clicking each action submits the canonical follow-up prompt via standard run flow.
- Buttons are disabled during pending runs and after resolution.
- Replay preserves decision follow-up as normal conversation history.
- Evidence screenshots exist in `test-results/kat-187/`.

**Step 4: Prepare Linear evidence comment**

Include:

- Test command outputs (unit + e2e)
- Screenshot artifact paths
- Explicit note that KAT-188 task parity remains out-of-scope and unmodified

**Step 5: Commit verification notes**

```bash
git add docs/plans/2026-03-03-kat-187-approval-actions-conversation-implementation-plan.md
git commit -m "docs(app): finalize KAT-187 verification checklist"
```

## Verification Notes (2026-03-03)

- Unit/integration verification passed:
  - `npm exec vitest run tests/unit/renderer/center/message-decision-parser.test.ts tests/unit/renderer/center/MessageActionRow.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`
  - Result: `5` files passed, `53` tests passed.
- E2E evidence verification passed:
  - `npm exec playwright test tests/e2e/kat-187-approval-actions.spec.ts`
  - Result: `1` test passed.
- Screenshot artifacts generated:
  - `test-results/kat-187/mock12-actions-visible.png`
  - `test-results/kat-187/mock13-actions-post-click.png`
- Deterministic e2e note:
  - The e2e test conditionally stubs `run:submit` IPC in-process, restores the previous handler in `finally`, and injects a seeded `run:event` (`message_appended`) to avoid external provider/auth dependencies while validating inline decision action UI behavior.
- Follow-up hardening:
  - Inline decision parsing now requires exact semantic action-line matches for the known decisions, preventing prefix-only matches from mapping changed wording to an unintended follow-up action.
