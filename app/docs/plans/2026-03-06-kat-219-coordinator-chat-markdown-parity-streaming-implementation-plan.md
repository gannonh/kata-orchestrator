# KAT-219 Coordinator Chat Markdown Parity + Streaming-Safe Output Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the center coordinator conversation render assistant markdown with Spec 02 parity while keeping streaming updates readable and stable until the final assistant message lands.

**Architecture:** Keep the existing center-panel composition boundary (`ChatPanel` -> `MessageBubble` -> `ConversationMessage` -> `MarkdownRenderer`) and improve the shared markdown renderer instead of adding a second streaming-specific renderer. Add a tiny render-time normalization helper for partial assistant markdown, thread an explicit render mode only through assistant message paths, and lock behavior with targeted renderer and panel tests.

**Tech Stack:** React 19, TypeScript, `react-markdown`, `remark-gfm`, Vitest, Testing Library, Electron renderer center-panel primitives.

---

**Execution Rules:**
- Apply `@test-driven-development` on every task: red, then green, then refactor.
- Apply `@verification-before-completion` before claiming ticket completion.
- Keep user-authored messages plain/card-like. This ticket does not add markdown authoring to user rows.
- Keep the runtime event pipeline (`src/main/agent-runner.ts`, `src/renderer/hooks/useIpcSessionConversation.ts`) focused on event delivery, not markdown repair.
- Keep commits small: one commit per task.

### Task 1: Add a render-time markdown normalization helper for streaming assistant content

**Files:**
- Create: `src/renderer/components/shared/normalize-markdown-for-render.ts`
- Test: `tests/unit/renderer/shared/normalize-markdown-for-render.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import {
  normalizeMarkdownForRender
} from '../../../../src/renderer/components/shared/normalize-markdown-for-render'

describe('normalizeMarkdownForRender', () => {
  it('returns settled markdown unchanged', () => {
    const content = ['## Summary', '', '> stable quote', '', '```ts', 'const ready = true', '```'].join('\n')

    expect(normalizeMarkdownForRender(content, 'settled')).toBe(content)
  })

  it('closes an unterminated fenced block only for streaming mode', () => {
    const content = ['## Summary', '', '```ts', 'const ready = true'].join('\n')

    expect(normalizeMarkdownForRender(content, 'streaming')).toBe(
      ['## Summary', '', '```ts', 'const ready = true', '```'].join('\n')
    )
  })

  it('preserves blockquote line breaks while streaming', () => {
    const content = ['> first line', '> second line'].join('\n')

    expect(normalizeMarkdownForRender(content, 'streaming')).toBe(content)
  })

  it('does not append a closing fence when the markdown is already balanced', () => {
    const content = ['```md', '- item', '```'].join('\n')

    expect(normalizeMarkdownForRender(content, 'streaming')).toBe(content)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/shared/normalize-markdown-for-render.test.ts`

Expected: FAIL because `normalize-markdown-for-render.ts` does not exist yet.

**Step 3: Write the minimal implementation**

```ts
export type MarkdownRenderMode = 'settled' | 'streaming'

const FENCE_PATTERN = /^```/gm

export function normalizeMarkdownForRender(
  content: string,
  mode: MarkdownRenderMode
): string {
  if (mode === 'settled') {
    return content
  }

  const fenceCount = content.match(FENCE_PATTERN)?.length ?? 0
  if (fenceCount % 2 === 1) {
    return `${content}\n\`\`\``
  }

  return content
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/shared/normalize-markdown-for-render.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/shared/normalize-markdown-for-render.ts tests/unit/renderer/shared/normalize-markdown-for-render.test.ts
git commit -m "test(renderer): add streaming markdown normalization contract"
```

### Task 2: Extend the shared markdown renderer for blockquotes, GFM checklist items, and render mode support

**Files:**
- Modify: `src/renderer/components/shared/MarkdownRenderer.tsx`
- Modify: `tests/unit/renderer/shared/MarkdownRenderer.test.tsx`
- Modify: `package.json`

**Step 1: Write the failing test**

Append tests like these to `tests/unit/renderer/shared/MarkdownRenderer.test.tsx`:

```tsx
it('renders blockquotes with readable structure', () => {
  render(
    <MarkdownRenderer
      content={['> Review the current spec draft.', '>', '> Keep the layout stable.'].join('\n')}
    />
  )

  const quote = screen.getByText('Review the current spec draft.').closest('blockquote')
  expect(quote).toBeTruthy()
  expect(quote?.className).toContain('border-l')
})

it('renders GFM checklist items as disabled checkboxes', () => {
  render(
    <MarkdownRenderer
      content={['- [x] Capture screenshot evidence', '- [ ] Verify streaming readability'].join('\n')}
    />
  )

  const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
  expect(checkboxes).toHaveLength(2)
  expect(checkboxes[0]?.checked).toBe(true)
  expect(checkboxes[1]?.checked).toBe(false)
  expect(checkboxes[0]?.disabled).toBe(true)
  expect(checkboxes[1]?.disabled).toBe(true)
})

it('normalizes unterminated fences when renderMode is streaming', () => {
  render(
    <MarkdownRenderer
      renderMode="streaming"
      content={['```ts', 'const ready = true'].join('\n')}
    />
  )

  expect(
    screen.getByText((_, node) => node?.tagName === 'CODE' && node.textContent?.includes('const ready = true') === true)
  ).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/shared/MarkdownRenderer.test.tsx`

Expected: FAIL because `MarkdownRenderer` does not yet accept `renderMode` and does not define explicit blockquote/checkbox rendering.

**Step 3: Write the minimal implementation**

Update `src/renderer/components/shared/MarkdownRenderer.tsx` to:

```tsx
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '../../lib/cn'
import {
  normalizeMarkdownForRender,
  type MarkdownRenderMode
} from './normalize-markdown-for-render'

type MarkdownRendererProps = {
  content: string
  className?: string
  renderMode?: MarkdownRenderMode
}

const MD_COMPONENTS: Components = {
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border/80 pl-4 text-foreground/90">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => <ul className="list-inside list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-inside list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-6 marker:text-muted-foreground">{children}</li>,
  input: ({ type, checked }) => {
    if (type !== 'checkbox') {
      return <input type={type} checked={checked} readOnly />
    }

    return (
      <input
        type="checkbox"
        checked={checked}
        disabled
        readOnly
        aria-label={checked ? 'Completed task' : 'Incomplete task'}
        className="mr-2 translate-y-[1px]"
      />
    )
  }
}

export function MarkdownRenderer({
  content,
  className,
  renderMode = 'settled'
}: MarkdownRendererProps) {
  const normalizedContent = normalizeMarkdownForRender(content, renderMode)

  return (
    <div className={cn('space-y-3 text-sm text-muted-foreground', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}
```

If TypeScript complains about `input` props, add the narrowest local type annotation needed rather than weakening the whole file.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/shared/MarkdownRenderer.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/shared/MarkdownRenderer.tsx tests/unit/renderer/shared/MarkdownRenderer.test.tsx package.json
git commit -m "feat(renderer): extend shared markdown renderer for coordinator parity"
```

### Task 3: Thread render mode through center primitives and keep user rows plain

**Files:**
- Modify: `src/renderer/components/center/primitives/ConversationMessage.tsx`
- Modify: `src/renderer/components/center/MessageBubble.tsx`
- Modify: `tests/unit/renderer/center/primitives/ConversationMessage.test.tsx`
- Modify: `tests/unit/renderer/center/MessageBubble.test.tsx`

**Step 1: Write the failing test**

Add tests like these:

```tsx
it('keeps user markdown markers as plain text', () => {
  render(
    <MessageBubble
      message={{
        id: 'user-markdown',
        role: 'user',
        content: '## Do not render this as a heading'
      }}
    />
  )

  expect(screen.getByText('## Do not render this as a heading')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Do not render this as a heading' })).toBeNull()
})

it('passes streaming render mode to assistant markdown content', () => {
  render(
    <ConversationMessage
      message={{
        id: 'agent-stream',
        role: 'agent',
        content: ['```ts', 'const ready = true'].join('\n')
      }}
      renderMode="streaming"
    />
  )

  expect(
    screen.getByText((_, node) => node?.tagName === 'CODE' && node.textContent?.includes('const ready = true') === true)
  ).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationMessage.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx`

Expected: FAIL because `ConversationMessage` does not yet accept `renderMode`.

**Step 3: Write the minimal implementation**

Update `src/renderer/components/center/primitives/ConversationMessage.tsx`:

```tsx
import type { MarkdownRenderMode } from '../../shared/normalize-markdown-for-render'

type ConversationMessageProps = {
  message: PrimitiveMessage
  variant?: PrimitiveMessageVariant
  agentLabel?: string
  renderMode?: MarkdownRenderMode
}

export function ConversationMessage({
  message,
  variant = 'default',
  agentLabel = 'Kata',
  renderMode = 'settled'
}: ConversationMessageProps) {
  const isUser = message.role === 'user'
  const content = variant === 'collapsed' && message.summary?.trim() ? message.summary : message.content

  return isUser ? (
    <p className="m-0 whitespace-pre-wrap text-sm leading-6">{content}</p>
  ) : (
    <MarkdownRenderer content={content} renderMode={renderMode} />
  )
}
```

Update `src/renderer/components/center/MessageBubble.tsx`:

```tsx
import type { MarkdownRenderMode } from '../shared/normalize-markdown-for-render'

type MessageBubbleProps = {
  message: BubbleMessage
  variant?: 'default' | 'collapsed'
  renderMode?: MarkdownRenderMode
  // existing props...
}

<ConversationMessageCard
  message={displayMessage}
  variant={variant}
  renderMode={primitiveMessage.role === 'user' ? 'settled' : renderMode}
  // existing props...
/>
```

If `ConversationMessageCard` needs a new optional prop, add it there and forward it to `ConversationMessage`. Keep the default value `settled`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/primitives/ConversationMessage.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/primitives/ConversationMessage.tsx src/renderer/components/center/MessageBubble.tsx tests/unit/renderer/center/primitives/ConversationMessage.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx
git commit -m "feat(renderer): thread markdown render mode through center messages"
```

### Task 4: Make `ChatPanel` mark only the active assistant message as streaming and prove stream-to-final convergence

**Files:**
- Modify: `src/renderer/components/center/ChatPanel.tsx`
- Modify: `tests/unit/renderer/center/ChatPanel.test.tsx`

**Step 1: Write the failing test**

Add tests like these to `tests/unit/renderer/center/ChatPanel.test.tsx`:

```tsx
it('renders the latest pending assistant message in streaming mode', () => {
  mockHook.mockReturnValue({
    state: idleState({
      runState: 'pending',
      messages: [
        { id: 'm1', role: 'user', content: 'Show me progress', createdAt: '2026-03-01T00:00:00Z' },
        { id: 'm2', role: 'agent', content: ['```ts', 'const ready = true'].join('\n'), createdAt: '2026-03-01T00:00:01Z' }
      ]
    }),
    submitPrompt: vi.fn(),
    retry: vi.fn()
  })

  render(<ChatPanel sessionId="sess-1" />)

  expect(screen.getByRole('status', { name: 'Thinking' })).toBeTruthy()
  expect(
    screen.getByText((_, node) => node?.tagName === 'CODE' && node.textContent?.includes('const ready = true') === true)
  ).toBeTruthy()
})

it('stabilizes the same assistant message when the final append arrives', () => {
  let currentState = idleState({
    runState: 'pending',
    messages: [
      { id: 'm1', role: 'user', content: 'Show me progress', createdAt: '2026-03-01T00:00:00Z' },
      { id: 'm2', role: 'agent', content: ['## Summary', '', '```ts', 'const ready = true'].join('\n'), createdAt: '2026-03-01T00:00:01Z' }
    ]
  })

  mockHook.mockImplementation(() => ({
    state: currentState,
    submitPrompt: vi.fn(),
    retry: vi.fn()
  }))

  const { rerender } = render(<ChatPanel sessionId="sess-1" />)
  expect(document.querySelector('[data-message-id=\"m2\"]')).toBeTruthy()

  currentState = idleState({
    runState: 'idle',
    messages: [
      { id: 'm1', role: 'user', content: 'Show me progress', createdAt: '2026-03-01T00:00:00Z' },
      { id: 'm2', role: 'agent', content: ['## Summary', '', '```ts', 'const ready = true', '```'].join('\n'), createdAt: '2026-03-01T00:00:01Z' }
    ]
  })

  rerender(<ChatPanel sessionId="sess-1" />)

  expect(screen.getByRole('status', { name: 'Stopped' })).toBeTruthy()
  expect(document.querySelector('[data-message-id=\"m2\"]')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Summary', level: 2 })).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/center/ChatPanel.test.tsx`

Expected: FAIL because `ChatPanel` does not yet compute or pass the streaming render mode.

**Step 3: Write the minimal implementation**

Update `src/renderer/components/center/ChatPanel.tsx` to compute the active streaming assistant message:

```tsx
const streamingMessageId = useMemo(() => {
  if (state.runState !== 'pending') {
    return null
  }

  for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
    const message = visibleMessages[index]
    if (message?.role === 'agent') {
      return message.id
    }
  }

  return null
}, [state.runState, visibleMessages])
```

Then pass the mode into `MessageBubble`:

```tsx
<MessageBubble
  message={message}
  renderMode={message.role === 'agent' && message.id === streamingMessageId ? 'streaming' : 'settled'}
  // existing props...
/>
```

Do not special-case user rows here beyond the existing role check.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/center/ChatPanel.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/center/ChatPanel.tsx tests/unit/renderer/center/ChatPanel.test.tsx
git commit -m "feat(renderer): make coordinator markdown streaming-safe in chat panel"
```

### Task 5: Run the focused verification suite and prepare screenshot evidence instructions

**Files:**
- Modify: `docs/plans/2026-03-06-kat-219-coordinator-chat-markdown-parity-streaming-design.md`
- Modify: `docs/plans/2026-03-06-kat-219-coordinator-chat-markdown-parity-streaming-implementation-plan.md`

**Step 1: Add the exact verification checklist to the plan/design docs**

Append a short checklist like this:

```md
## Verification Commands

- `npx vitest run tests/unit/renderer/shared/normalize-markdown-for-render.test.ts tests/unit/renderer/shared/MarkdownRenderer.test.tsx tests/unit/renderer/center/primitives/ConversationMessage.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx`
- `npm test`
- `npm run dev -- --remote-debugging-port=9222`
```

```md
## Screenshot Evidence Targets

- Pending coordinator response with markdown blockquote + checklist
- Final/stopped coordinator response with heading + fenced code block
```

**Step 2: Save docs and verify the markdown renders cleanly**

Run: `npx vitest run tests/unit/renderer/shared/normalize-markdown-for-render.test.ts tests/unit/renderer/shared/MarkdownRenderer.test.tsx tests/unit/renderer/center/primitives/ConversationMessage.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx`

Expected: PASS after Tasks 1-4 are complete.

**Step 3: Capture manual evidence**

Run these from `app/`:

```bash
npm run dev -- --remote-debugging-port=9222
```

In a second terminal:

```bash
npx agent-browser close
npx agent-browser connect 9222
npx agent-browser tab
npx agent-browser tab 0
npx agent-browser snapshot -i
```

Use a seeded or manually entered assistant response that includes:

```md
## Summary

> Review the current plan before implementation.

- [x] Renderer contract locked
- [ ] Screenshot evidence captured

```ts
const ready = true
```
```

Then capture screenshots:

```bash
npx agent-browser screenshot /tmp/kat-219-streaming-pending.png
npx agent-browser screenshot /tmp/kat-219-streaming-final.png
```

**Step 4: Run the broader renderer suite**

Run: `npm test`

Expected: PASS.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-06-kat-219-coordinator-chat-markdown-parity-streaming-design.md docs/plans/2026-03-06-kat-219-coordinator-chat-markdown-parity-streaming-implementation-plan.md
git commit -m "docs(renderer): add verification checklist for KAT-219"
```

## Final Verification Before Closing KAT-219

- Run `npx vitest run tests/unit/renderer/shared/normalize-markdown-for-render.test.ts tests/unit/renderer/shared/MarkdownRenderer.test.tsx tests/unit/renderer/center/primitives/ConversationMessage.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx`
- Run `npm test`
- Confirm user rows still render raw markdown markers as plain text
- Confirm assistant rows render headings, lists, inline code, fenced code, blockquotes, and checklists
- Confirm pending assistant output stays readable while streaming and converges cleanly to final output
- Capture screenshot evidence for the pending and final markdown-heavy coordinator states

## Verification Commands

- `npx vitest run tests/unit/renderer/shared/normalize-markdown-for-render.test.ts tests/unit/renderer/shared/MarkdownRenderer.test.tsx tests/unit/renderer/center/primitives/ConversationMessage.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx`
- `npm test`
- `npm run dev -- --remote-debugging-port=9222`

## Screenshot Evidence Targets

- Pending coordinator response with markdown blockquote + checklist
- Final/stopped coordinator response with heading + fenced code block
