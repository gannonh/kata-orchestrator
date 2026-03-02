# KAT-160 Structured Spec Panel Rendering + Interactive Task Toggles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Spec 03 minimum parity in the right panel: apply latest run draft into spec content, render structured sections, and support persisted interactive task toggles.

**Architecture:** Keep the current `AppShell -> RightPanel -> SpecTab` composition, then add a focused structured-spec domain layer (parser + markdown task updater + storage) under the right panel. Extend deterministic session runtime output so the latest run exposes a draft payload the right panel can apply without reworking center-panel chat composition.

**Tech Stack:** React 19, TypeScript, Tailwind/shadcn (`Checkbox`, `Card`), Vitest + Testing Library, Playwright Electron e2e screenshots, localStorage-backed session document persistence.

---

**Execution Rules:**
- Apply `@test-driven-development` on every task (red -> green -> refactor).
- Apply `@verification-before-completion` before marking KAT-160 complete.
- Keep commits small and frequent (one commit per task).

### Task 1: Define Structured Spec Domain Types and Run-Draft Contract

**Files:**
- Create: `src/renderer/types/spec-document.ts`
- Modify: `src/renderer/types/session-conversation.ts`
- Test: `tests/unit/renderer/types/spec-document.test.ts`

**Step 1: Write failing type-contract tests**

```ts
import { describe, expect, it } from 'vitest'
import type {
  SpecTaskStatus,
  StructuredSpecDocument,
  StructuredSpecSections
} from '../../../../src/renderer/types/spec-document'

describe('spec-document contracts', () => {
  it('supports required section keys', () => {
    const sections: StructuredSpecSections = {
      goal: '',
      acceptanceCriteria: [],
      nonGoals: [],
      assumptions: [],
      verificationPlan: [],
      rollbackPlan: []
    }

    expect(Object.keys(sections)).toEqual([
      'goal',
      'acceptanceCriteria',
      'nonGoals',
      'assumptions',
      'verificationPlan',
      'rollbackPlan'
    ])
  })

  it('supports three-state task lifecycle', () => {
    const statuses: SpecTaskStatus[] = ['not_started', 'in_progress', 'complete']
    expect(statuses).toHaveLength(3)
  })

  it('tracks applied run metadata on structured spec docs', () => {
    const doc: StructuredSpecDocument = {
      markdown: '## Goal\nShip KAT-160',
      sections: {
        goal: 'Ship KAT-160',
        acceptanceCriteria: [],
        nonGoals: [],
        assumptions: [],
        verificationPlan: [],
        rollbackPlan: []
      },
      tasks: [],
      updatedAt: new Date(0).toISOString(),
      appliedRunId: 'run-1'
    }

    expect(doc.appliedRunId).toBe('run-1')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/types/spec-document.test.ts`  
Expected: FAIL with missing type module.

**Step 3: Implement minimal shared types**

```ts
export type SpecTaskStatus = 'not_started' | 'in_progress' | 'complete'

export type StructuredSpecSections = {
  goal: string
  acceptanceCriteria: string[]
  nonGoals: string[]
  assumptions: string[]
  verificationPlan: string[]
  rollbackPlan: string[]
}

export type SpecTaskItem = {
  id: string
  title: string
  status: SpecTaskStatus
  markdownLineIndex: number
}

export type StructuredSpecDocument = {
  markdown: string
  sections: StructuredSpecSections
  tasks: SpecTaskItem[]
  updatedAt: string
  appliedRunId?: string
}

export type LatestRunDraft = {
  runId: string
  generatedAt: string
  content: string
}
```

Also extend `SessionConversationState` with optional `latestDraft?: LatestRunDraft`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/types/spec-document.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/types/spec-document.ts src/renderer/types/session-conversation.ts tests/unit/renderer/types/spec-document.test.ts
git commit -m "feat(renderer): add structured spec domain contracts"
```

### Task 2: Build Structured Spec Parser for Required Section Rendering

**Files:**
- Create: `src/renderer/components/right/spec-parser.ts`
- Test: `tests/unit/renderer/right/spec-parser.test.ts`

**Step 1: Write failing parser tests for section extraction and ordering**

```ts
import { describe, expect, it } from 'vitest'
import { parseStructuredSpec } from '../../../../src/renderer/components/right/spec-parser'

const markdown = `## Goal\nShip desktop parity\n\n## Acceptance Criteria\n1. Works\n\n## Non-goals\n- Do not ship comments\n\n## Assumptions\n- Repo is clean\n\n## Verification Plan\n1. Run tests\n\n## Rollback Plan\n1. Use git restore\n\n## Tasks\n- [ ] Build parser\n- [/] Wire UI\n- [x] Add tests`

describe('parseStructuredSpec', () => {
  it('extracts all required sections', () => {
    const parsed = parseStructuredSpec(markdown)

    expect(parsed.sections.goal).toBe('Ship desktop parity')
    expect(parsed.sections.acceptanceCriteria).toEqual(['Works'])
    expect(parsed.sections.nonGoals).toEqual(['Do not ship comments'])
    expect(parsed.sections.assumptions).toEqual(['Repo is clean'])
    expect(parsed.sections.verificationPlan).toEqual(['Run tests'])
    expect(parsed.sections.rollbackPlan).toEqual(['Use git restore'])
  })

  it('maps task markers to task statuses', () => {
    const parsed = parseStructuredSpec(markdown)
    expect(parsed.tasks.map((task) => task.status)).toEqual(['not_started', 'in_progress', 'complete'])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/spec-parser.test.ts`  
Expected: FAIL with missing parser module.

**Step 3: Implement minimal parser**

```ts
export function parseStructuredSpec(markdown: string): StructuredSpecDocument {
  // 1. split lines
  // 2. walk heading blocks by ##
  // 3. normalize ordered/bullet list items
  // 4. map task markers [ ], [/], [x] under Tasks
  // 5. return fully-populated document with safe defaults
}
```

Default empty-state behavior:
- Missing sections return empty strings/arrays.
- Missing `Tasks` section returns `[]`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/right/spec-parser.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/right/spec-parser.ts tests/unit/renderer/right/spec-parser.test.ts
git commit -m "feat(renderer): parse structured spec sections and task states"
```

### Task 3: Add Task Toggle Markdown Updater (Round-Trip)

**Files:**
- Create: `src/renderer/components/right/spec-task-markdown.ts`
- Test: `tests/unit/renderer/right/spec-task-markdown.test.ts`

**Step 1: Write failing tests for task toggle cycling and line updates**

```ts
import { describe, expect, it } from 'vitest'
import { cycleTaskStatus, updateTaskLineInMarkdown } from '../../../../src/renderer/components/right/spec-task-markdown'

describe('spec-task-markdown', () => {
  it('cycles task status not_started -> in_progress -> complete -> not_started', () => {
    expect(cycleTaskStatus('not_started')).toBe('in_progress')
    expect(cycleTaskStatus('in_progress')).toBe('complete')
    expect(cycleTaskStatus('complete')).toBe('not_started')
  })

  it('rewrites checkbox marker for the targeted task line only', () => {
    const markdown = '## Tasks\n- [ ] Task A\n- [x] Task B'
    const updated = updateTaskLineInMarkdown(markdown, 1, 'in_progress')
    expect(updated).toContain('- [/] Task A')
    expect(updated).toContain('- [x] Task B')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/spec-task-markdown.test.ts`  
Expected: FAIL with missing utility module.

**Step 3: Implement status cycling and markdown line writer**

```ts
export function cycleTaskStatus(status: SpecTaskStatus): SpecTaskStatus {
  if (status === 'not_started') return 'in_progress'
  if (status === 'in_progress') return 'complete'
  return 'not_started'
}

export function markerForStatus(status: SpecTaskStatus): string {
  if (status === 'not_started') return '[ ]'
  if (status === 'in_progress') return '[/]'
  return '[x]'
}

export function updateTaskLineInMarkdown(markdown: string, lineIndex: number, next: SpecTaskStatus): string {
  // replace only the marker token on the requested line
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/right/spec-task-markdown.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/right/spec-task-markdown.ts tests/unit/renderer/right/spec-task-markdown.test.ts
git commit -m "feat(renderer): add task toggle markdown round-trip utilities"
```

### Task 4: Add Session-Scoped Spec Document Storage Hook

**Files:**
- Create: `src/renderer/hooks/useSpecDocument.ts`
- Test: `tests/unit/renderer/hooks/useSpecDocument.test.ts`

**Step 1: Write failing tests for load/save semantics and keying**

```ts
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSpecDocument } from '../../../../src/renderer/hooks/useSpecDocument'

describe('useSpecDocument', () => {
  it('loads existing document from session key', () => {
    window.localStorage.setItem('kata.spec-panel.v1:space-a:session-a', JSON.stringify({ markdown: '## Goal\nA' }))
    const { result } = renderHook(() => useSpecDocument({ spaceId: 'space-a', sessionId: 'session-a' }))
    expect(result.current.document.markdown).toContain('## Goal')
  })

  it('persists updates back to the same key', () => {
    const { result } = renderHook(() => useSpecDocument({ spaceId: 'space-a', sessionId: 'session-a' }))
    act(() => result.current.setMarkdown('## Goal\nUpdated'))
    expect(window.localStorage.getItem('kata.spec-panel.v1:space-a:session-a')).toContain('Updated')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/hooks/useSpecDocument.test.ts`  
Expected: FAIL with missing hook.

**Step 3: Implement hook with parse-on-write behavior**

```ts
export function useSpecDocument({ spaceId, sessionId }: { spaceId: string; sessionId: string }) {
  // load from localStorage key kata.spec-panel.v1:<spaceId>:<sessionId>
  // setMarkdown() -> parseStructuredSpec + persist
  // applyDraft() -> replace markdown + set appliedRunId + persist
  // toggleTask(taskId) -> cycle status + rewrite markdown + parse + persist
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/hooks/useSpecDocument.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/hooks/useSpecDocument.ts tests/unit/renderer/hooks/useSpecDocument.test.ts
git commit -m "feat(renderer): persist structured spec document by session"
```

### Task 5: Extend Session Conversation Hook to Publish Latest Draft Payload

**Files:**
- Modify: `src/renderer/hooks/useSessionConversation.ts`
- Test: `tests/unit/renderer/hooks/useSessionConversation.test.ts`

**Step 1: Add failing tests asserting latest draft metadata on successful run**

```ts
it('publishes latestDraft on successful completion', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useSessionConversation())

  act(() => result.current.submitPrompt('Build a chat-first spec panel'))
  act(() => vi.runAllTimers())

  expect(result.current.state.latestDraft?.runId).toBeTruthy()
  expect(result.current.state.latestDraft?.generatedAt).toBeTruthy()
  expect(result.current.state.latestDraft?.content).toContain('## Goal')
  expect(result.current.state.latestDraft?.content).toContain('## Tasks')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/hooks/useSessionConversation.test.ts`  
Expected: FAIL because `latestDraft` is not set.

**Step 3: Implement deterministic draft generation in hook success path**

```ts
function buildDeterministicDraft(prompt: string, runId: string): LatestRunDraft {
  return {
    runId,
    generatedAt: new Date().toISOString(),
    content: `## Goal\n${prompt}\n\n## Acceptance Criteria\n1. ...\n\n## Non-goals\n- ...\n\n## Assumptions\n- ...\n\n## Verification Plan\n1. ...\n\n## Rollback Plan\nRevert the latest changes safely.\n\n## Tasks\n- [ ] Parse spec sections\n- [ ] Render structured spec\n- [ ] Support task toggles`
    content: `## Goal\n${prompt}\n\n## Acceptance Criteria\n1. ...\n\n## Non-goals\n- ...\n\n## Assumptions\n- ...\n\n## Verification Plan\n1. ...\n\n## Rollback Plan\n1. Revert the latest changes safely.\n\n## Tasks\n- [ ] Parse spec sections\n- [ ] Render structured spec\n- [ ] Support task toggles`
  }
}
```

On `RUN_SUCCEEDED`, append agent message and set `state.latestDraft`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/hooks/useSessionConversation.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/hooks/useSessionConversation.ts tests/unit/renderer/hooks/useSessionConversation.test.ts
git commit -m "feat(renderer): publish latest deterministic draft from session runs"
```

### Task 6: Implement Structured Spec UI in SpecTab (Render + Edit + Toggles)

**Files:**
- Modify: `src/renderer/components/right/SpecTab.tsx`
- Modify: `src/renderer/components/right/TaskList.tsx`
- Create: `src/renderer/components/right/SpecOnboardingState.tsx`
- Create: `src/renderer/components/right/SpecSections.tsx`
- Test: `tests/unit/renderer/right/SpecTab.structured.test.tsx`

**Step 1: Write failing component tests for required states**

```tsx
it('shows onboarding copy when no applied spec exists', () => {
  render(<SpecTab project={mockProject} specState={{ mode: 'generating' }} />)
  expect(screen.getByText('Creating Spec')).toBeTruthy()
})

it('renders all required section headings after draft apply', () => {
  render(<SpecTab project={mockProject} specState={appliedState} />)
  expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Acceptance Criteria' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Non-goals' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Assumptions' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Verification Plan' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Rollback Plan' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Tasks' })).toBeTruthy()
})

it('cycles checkbox state when task row is toggled', () => {
  render(<SpecTab project={mockProject} specState={appliedState} />)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Parse spec sections' }))
  expect(screen.getByText('In Progress')).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/SpecTab.structured.test.tsx`  
Expected: FAIL because new `specState` rendering path does not exist.

**Step 3: Implement structured-state-driven SpecTab**

Implementation requirements:
- Add `mode`: `generating | draft_ready | structured_view | editing`
- Render onboarding panel in `generating`
- Render apply card when `latestDraft` exists and doc has not been applied
- Render section cards in structured mode
- Provide `Edit markdown` / `Save` controls
- Replace static status badges with real checkbox-driven task state (`Checkbox`)

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/right/SpecTab.structured.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/right/SpecTab.tsx src/renderer/components/right/TaskList.tsx src/renderer/components/right/SpecOnboardingState.tsx src/renderer/components/right/SpecSections.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx
git commit -m "feat(renderer): render structured spec states with interactive task toggles"
```

### Task 7: Wire RightPanel Draft-Apply Flow Without Regressing Tab Behavior

**Files:**
- Modify: `src/renderer/components/layout/AppShell.tsx`
- Modify: `src/renderer/components/center/MockChatPanel.tsx`
- Modify: `src/renderer/components/layout/RightPanel.tsx`
- Test: `tests/unit/renderer/right/RightPanel.test.tsx`
- Test: `tests/unit/renderer/right/RightPanel.draft-flow.test.tsx`

**Step 1: Write failing integration tests for latest-run apply flow and tab regressions**

```tsx
it('applies latest run draft into structured spec content', async () => {
  render(<AppShell />)

  fireEvent.change(screen.getByLabelText('Message input'), { target: { value: 'Build a prompt-to-spec demo' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  act(() => vi.advanceTimersByTime(900))

  fireEvent.click(screen.getByRole('button', { name: 'Apply Draft to Spec' }))
  expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()
  expect(screen.getByText('Build a prompt-to-spec demo')).toBeTruthy()
})

it('keeps right note tab create/rename/close behavior intact', () => {
  // existing regression assertions copied from RightPanel.test.tsx
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/RightPanel.test.tsx tests/unit/renderer/right/RightPanel.draft-flow.test.tsx`  
Expected: FAIL because right panel does not consume runtime draft state.

**Step 3: Implement runtime-to-right-panel wiring**

Implementation contract:
- Lift `useSessionConversation()` to `AppShell`.
- Pass runtime state + handlers into `MockChatPanel` as props.
- Pass `latestDraft`, `activeSpaceId`, and `sessionId` into `RightPanel`.
- `RightPanel` composes `useSpecDocument()` and `SpecTab` state transitions.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/right/RightPanel.test.tsx tests/unit/renderer/right/RightPanel.draft-flow.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/layout/AppShell.tsx src/renderer/components/center/MockChatPanel.tsx src/renderer/components/layout/RightPanel.tsx tests/unit/renderer/right/RightPanel.test.tsx tests/unit/renderer/right/RightPanel.draft-flow.test.tsx
git commit -m "feat(renderer): wire latest run draft apply flow into right spec panel"
```

### Task 8: Capture KAT-160 Screenshot Parity Evidence (Mock-08 / Mock-09)

**Files:**
- Create: `tests/e2e/kat-160-spec-panel-parity.spec.ts`
- Modify: `tests/e2e/navigation.spec.ts` (only if shared helper extraction is needed)

**Step 1: Write failing e2e test for required screenshots**

```ts
test.describe('KAT-160 spec panel parity evidence @uat', () => {
  test('captures generating and structured states', async ({ appWindow }) => {
    await ensureWorkspaceShell(appWindow)

    await appWindow.screenshot({ path: 'test-results/kat-160/state-generating.png', fullPage: true })

    await appWindow.getByLabel('Message input').fill('Draft a build-session spec for the desktop app')
    await appWindow.getByRole('button', { name: 'Send' }).click()
    await expect(appWindow.getByRole('status', { name: 'Stopped' })).toBeVisible()

    await appWindow.getByRole('button', { name: 'Apply Draft to Spec' }).click()
    await appWindow.screenshot({ path: 'test-results/kat-160/state-structured.png', fullPage: true })
  })
})
```

**Step 2: Run test to verify it fails initially**

Run: `npx playwright test tests/e2e/kat-160-spec-panel-parity.spec.ts`  
Expected: FAIL before UI flow is implemented.

**Step 3: Update selectors/assertions after UI is complete**

Add robust assertions before screenshot capture:
- `Creating Spec` visible for generating state
- structured section headings visible for applied state

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/e2e/kat-160-spec-panel-parity.spec.ts`  
Expected: PASS and image artifacts created under `test-results/kat-160/`.

**Step 5: Commit**

```bash
git add tests/e2e/kat-160-spec-panel-parity.spec.ts test-results/kat-160/state-generating.png test-results/kat-160/state-structured.png
git commit -m "test(e2e): add KAT-160 spec panel parity evidence capture"
```

### Task 9: Final Verification Gate and Evidence Checklist

**Files:**
- Modify: `docs/plans/2026-03-02-kat-160-structured-spec-panel-rendering-task-toggles-implementation-plan.md` (verification notes section only)

**Step 1: Run lint + targeted unit suites**

Run: `npm run lint && npx vitest run tests/unit/renderer/right/spec-parser.test.ts tests/unit/renderer/right/spec-task-markdown.test.ts tests/unit/renderer/hooks/useSpecDocument.test.ts tests/unit/renderer/right/SpecTab.structured.test.tsx tests/unit/renderer/right/RightPanel.test.tsx tests/unit/renderer/hooks/useSessionConversation.test.ts`  
Expected: PASS.

**Step 2: Run quality-gate e2e plus KAT-160 evidence test**

Run: `npm run test:e2e:quality-gate && npx playwright test tests/e2e/kat-160-spec-panel-parity.spec.ts`  
Expected: PASS.

**Step 3: Confirm acceptance criteria checklist**

Checklist:
- Structured sections render with correct headings
- Latest run draft can be applied into editable spec content
- Task toggles cycle and persist via markdown mapping
- Right panel note-tab behavior unchanged
- Screenshot evidence exists for generating + structured states

**Step 4: Prepare Linear evidence note**

Include:
- unit test command outputs
- e2e command outputs
- paths to `test-results/kat-160/*.png`
- concise rationale for comment/thread deferment

**Step 5: Commit verification notes**

```bash
git add docs/plans/2026-03-02-kat-160-structured-spec-panel-rendering-task-toggles-implementation-plan.md
git commit -m "docs(app): finalize KAT-160 verification checklist"
```
