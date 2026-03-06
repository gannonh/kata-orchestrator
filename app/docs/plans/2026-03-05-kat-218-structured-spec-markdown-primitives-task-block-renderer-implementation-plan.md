# KAT-218 Structured Spec Markdown Primitives + Task Block Renderer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract reusable structured-spec markdown and task-block rendering primitives from the right panel, preserving current behavior while enabling reuse for verification surfaces.

**Architecture:** Refactor existing right-panel parser/task utilities and section/task UI into explicit primitive modules under `src/renderer/components/right/primitives/`. Keep current entry points (`spec-parser.ts`, `spec-task-markdown.ts`, `TaskList.tsx`, `SpecSections.tsx`) as compatibility shims/wrappers so runtime behavior does not regress during extraction.

**Tech Stack:** React 19, TypeScript, shadcn/ui (`Card`, `Checkbox`), existing shared `TaskActivitySnapshot` overlay model, Vitest + Testing Library.

---

**Execution Rules:**
- Apply `@test-driven-development` for every task (`red -> green -> refactor`).
- Apply `@verification-before-completion` before marking KAT-218 complete.
- Keep commits small and frequent (one commit per task).
- Keep scope inside `src/renderer/components/right/*` unless an integration hook is strictly necessary.

### Task 1: Establish Primitive Contracts with Failing Tests

**Files:**
- Create: `tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts`
- Create: `src/renderer/components/right/primitives/spec-markdown-types.ts`

**Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from 'vitest'
import type {
  ParsedSpecMarkdownDocument,
  ParsedSpecSections,
  ParsedSpecTaskItem,
  ParsedSpecTaskStatus
} from '../../../../../src/renderer/components/right/primitives/spec-markdown-types'

describe('spec primitives contract', () => {
  it('defines normalized section and task contracts for reusable renderers', () => {
    const sections: ParsedSpecSections = {
      goal: '',
      acceptanceCriteria: [],
      nonGoals: [],
      assumptions: [],
      verificationPlan: [],
      rollbackPlan: []
    }

    const task: ParsedSpecTaskItem = {
      id: 'task-1',
      title: 'Example',
      status: 'not_started',
      markdownLineIndex: 0
    }

    const doc: ParsedSpecMarkdownDocument = {
      markdown: '',
      sections,
      tasks: [task],
      updatedAt: new Date(0).toISOString()
    }

    const statuses: ParsedSpecTaskStatus[] = ['not_started', 'in_progress', 'complete']

    expect(doc.tasks).toHaveLength(1)
    expect(statuses).toEqual(['not_started', 'in_progress', 'complete'])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts`  
Expected: FAIL with missing module `spec-markdown-types`.

**Step 3: Implement minimal primitive type module**

```ts
export type ParsedSpecTaskStatus = 'not_started' | 'in_progress' | 'complete'

export type ParsedSpecSections = {
  goal: string
  acceptanceCriteria: string[]
  nonGoals: string[]
  assumptions: string[]
  verificationPlan: string[]
  rollbackPlan: string[]
}

export type ParsedSpecTaskItem = {
  id: string
  title: string
  status: ParsedSpecTaskStatus
  markdownLineIndex: number
}

export type ParsedSpecMarkdownDocument = {
  markdown: string
  sections: ParsedSpecSections
  tasks: ParsedSpecTaskItem[]
  updatedAt: string
  appliedRunId?: string
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts src/renderer/components/right/primitives/spec-markdown-types.ts
git commit -m "test(renderer): add KAT-218 primitive contract guards"
```

### Task 2: Extract Structured Markdown Parser Primitive with Compatibility Shim

**Files:**
- Create: `src/renderer/components/right/primitives/parse-spec-markdown.ts`
- Modify: `src/renderer/components/right/spec-parser.ts`
- Modify: `tests/unit/renderer/right/spec-parser.test.ts`
- Create: `tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts`

**Step 1: Write failing primitive parser test**

```ts
import { describe, expect, it } from 'vitest'
import { parseSpecMarkdown } from '../../../../../src/renderer/components/right/primitives/parse-spec-markdown'

describe('parseSpecMarkdown', () => {
  it('extracts normalized sections and task markers deterministically', () => {
    const markdown = [
      '## Goal',
      'Ship reusable parser primitives.',
      '',
      '## Acceptance Criteria',
      '- Parser works',
      '',
      '## Tasks',
      '- [ ] Task A',
      '- [/] Task B',
      '- [x] Task C'
    ].join('\n')

    const parsed = parseSpecMarkdown(markdown)

    expect(parsed.sections.goal).toContain('reusable parser')
    expect(parsed.sections.acceptanceCriteria).toEqual(['Parser works'])
    expect(parsed.tasks.map((task) => task.status)).toEqual(['not_started', 'in_progress', 'complete'])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts`  
Expected: FAIL with missing primitive parser module.

**Step 3: Implement primitive parser and preserve old API**

```ts
// parse-spec-markdown.ts
export function parseSpecMarkdown(markdown: string): ParsedSpecMarkdownDocument {
  // move current parse logic from spec-parser.ts here unchanged in behavior
}

// spec-parser.ts
export { parseSpecMarkdown as parseStructuredSpec } from './primitives/parse-spec-markdown'
```

Keep behavior identical to current tests: list normalization, task checkbox parsing, deterministic task IDs.

**Step 4: Run tests to verify pass + compatibility**

Run:  
`npx vitest run tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts tests/unit/renderer/right/spec-parser.test.ts`

Expected: PASS on both suites.

**Step 5: Commit**

```bash
git add src/renderer/components/right/primitives/parse-spec-markdown.ts src/renderer/components/right/spec-parser.ts tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts tests/unit/renderer/right/spec-parser.test.ts
git commit -m "refactor(renderer): extract structured spec parser primitive"
```

### Task 3: Extract Task-Block Markdown Primitive with Compatibility Shim

**Files:**
- Create: `src/renderer/components/right/primitives/task-block-markdown.ts`
- Modify: `src/renderer/components/right/spec-task-markdown.ts`
- Modify: `tests/unit/renderer/right/spec-task-markdown.test.ts`
- Create: `tests/unit/renderer/right/primitives/task-block-markdown.test.ts`

**Step 1: Write failing task-block primitive tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  cycleTaskBlockStatus,
  markerForTaskBlockStatus,
  updateTaskBlockLineInMarkdown
} from '../../../../../src/renderer/components/right/primitives/task-block-markdown'

describe('task-block-markdown primitives', () => {
  it('cycles not_started -> in_progress -> complete -> not_started', () => {
    expect(cycleTaskBlockStatus('not_started')).toBe('in_progress')
    expect(cycleTaskBlockStatus('in_progress')).toBe('complete')
    expect(cycleTaskBlockStatus('complete')).toBe('not_started')
  })

  it('maps markers and rewrites only target task line', () => {
    const markdown = ['## Tasks', '- [ ] A', '- [x] B'].join('\n')
    const updated = updateTaskBlockLineInMarkdown(markdown, 1, 'in_progress')

    expect(markerForTaskBlockStatus('in_progress')).toBe('[/]')
    expect(updated).toContain('- [/] A')
    expect(updated).toContain('- [x] B')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/primitives/task-block-markdown.test.ts`  
Expected: FAIL with missing primitive module.

**Step 3: Implement primitive utility module and shim**

```ts
// task-block-markdown.ts
export function cycleTaskBlockStatus(status: ParsedSpecTaskStatus): ParsedSpecTaskStatus { ... }
export function markerForTaskBlockStatus(status: ParsedSpecTaskStatus): string { ... }
export function updateTaskBlockLineInMarkdown(markdown: string, lineIndex: number, next: ParsedSpecTaskStatus): string { ... }

// spec-task-markdown.ts
export {
  cycleTaskBlockStatus as cycleTaskStatus,
  markerForTaskBlockStatus as markerForStatus,
  updateTaskBlockLineInMarkdown as updateTaskLineInMarkdown
} from './primitives/task-block-markdown'
```

**Step 4: Run tests for primitive + shim compatibility**

Run:  
`npx vitest run tests/unit/renderer/right/primitives/task-block-markdown.test.ts tests/unit/renderer/right/spec-task-markdown.test.ts`

Expected: PASS on both suites.

**Step 5: Commit**

```bash
git add src/renderer/components/right/primitives/task-block-markdown.ts src/renderer/components/right/spec-task-markdown.ts tests/unit/renderer/right/primitives/task-block-markdown.test.ts tests/unit/renderer/right/spec-task-markdown.test.ts
git commit -m "refactor(renderer): extract task block markdown primitive"
```

### Task 4: Build Reusable Task Block Renderer Primitive

**Files:**
- Create: `src/renderer/components/right/primitives/TaskBlockList.tsx`
- Modify: `src/renderer/components/right/TaskList.tsx`
- Create: `tests/unit/renderer/right/primitives/TaskBlockList.test.tsx`
- Modify: `tests/unit/renderer/right/TaskList.test.tsx`

**Step 1: Write failing TaskBlockList tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskBlockList } from '../../../../../src/renderer/components/right/primitives/TaskBlockList'

describe('TaskBlockList', () => {
  it('renders structured tasks with status badges', () => {
    render(
      <TaskBlockList
        tasks={[{ id: 't1', title: 'Task 1', status: 'not_started', markdownLineIndex: 0 }]}
      />
    )

    expect(screen.getByText('Task 1')).toBeTruthy()
    expect(screen.getByText('Not Started')).toBeTruthy()
  })

  it('invokes toggle callback when interactive checkbox is clicked', () => {
    const onToggleTask = vi.fn()
    render(
      <TaskBlockList
        tasks={[{ id: 't1', title: 'Task 1', status: 'not_started', markdownLineIndex: 0 }]}
        onToggleTask={onToggleTask}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Task 1' }))
    expect(onToggleTask).toHaveBeenCalledWith('t1')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/primitives/TaskBlockList.test.tsx`  
Expected: FAIL with missing component.

**Step 3: Implement primitive and adapt TaskList wrapper**

```tsx
// TaskBlockList.tsx
export function TaskBlockList({ tasks, onToggleTask, mode = 'interactive' }: Props) {
  // reuse current structured-task branch from TaskList.tsx
}

// TaskList.tsx
// keep ProjectTask rendering branch intact
// delegate structured task rendering branch to <TaskBlockList />
```

**Step 4: Run tests to verify pass + regression coverage**

Run:  
`npx vitest run tests/unit/renderer/right/primitives/TaskBlockList.test.tsx tests/unit/renderer/right/TaskList.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/right/primitives/TaskBlockList.tsx src/renderer/components/right/TaskList.tsx tests/unit/renderer/right/primitives/TaskBlockList.test.tsx tests/unit/renderer/right/TaskList.test.tsx
git commit -m "refactor(renderer): add reusable task block list primitive"
```

### Task 5: Build Reusable Structured Section Block Primitive

**Files:**
- Create: `src/renderer/components/right/primitives/StructuredSectionBlocks.tsx`
- Modify: `src/renderer/components/right/SpecSections.tsx`
- Create: `tests/unit/renderer/right/primitives/StructuredSectionBlocks.test.tsx`
- Modify: `tests/unit/renderer/right/SpecSections.test.tsx`

**Step 1: Write failing tests for section primitive**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StructuredSectionBlocks } from '../../../../../src/renderer/components/right/primitives/StructuredSectionBlocks'

describe('StructuredSectionBlocks', () => {
  it('renders all canonical section headings in stable order', () => {
    render(
      <StructuredSectionBlocks
        sections={{
          goal: 'Goal text',
          acceptanceCriteria: ['AC1'],
          nonGoals: ['NG1'],
          assumptions: ['A1'],
          verificationPlan: ['V1'],
          rollbackPlan: ['R1']
        }}
        renderTasks={() => null}
      />
    )

    expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Acceptance Criteria' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Non-goals' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Assumptions' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Verification Plan' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Rollback Plan' })).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/primitives/StructuredSectionBlocks.test.tsx`  
Expected: FAIL with missing component.

**Step 3: Implement primitive and migrate SpecSections composition**

```tsx
// StructuredSectionBlocks.tsx
export function StructuredSectionBlocks({ sections, renderTasks }: Props) {
  // move reusable section-card rendering from SpecSections.tsx
}

// SpecSections.tsx
// keep snapshot merge + top metadata controls
// delegate section card rendering to <StructuredSectionBlocks />
// render task area via primitive slot callback
```

**Step 4: Run tests for primitive + existing SpecSections behavior**

Run:  
`npx vitest run tests/unit/renderer/right/primitives/StructuredSectionBlocks.test.tsx tests/unit/renderer/right/SpecSections.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/right/primitives/StructuredSectionBlocks.tsx src/renderer/components/right/SpecSections.tsx tests/unit/renderer/right/primitives/StructuredSectionBlocks.test.tsx tests/unit/renderer/right/SpecSections.test.tsx
git commit -m "refactor(renderer): extract structured section block primitive"
```

### Task 6: Add Verification-Oriented Adapter Using Shared Primitives (Right Scope Proof)

**Files:**
- Create: `src/renderer/components/right/VerificationTaskBlockSummary.tsx`
- Create: `tests/unit/renderer/right/VerificationTaskBlockSummary.test.tsx`
- Modify: `src/renderer/components/right/index.ts` (if export barrel exists; otherwise skip)

**Step 1: Write failing adapter tests**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VerificationTaskBlockSummary } from '../../../../src/renderer/components/right/VerificationTaskBlockSummary'

describe('VerificationTaskBlockSummary', () => {
  it('renders readonly task blocks using shared primitive contracts', () => {
    render(
      <VerificationTaskBlockSummary
        title="Wave 1 Verification"
        tasks={[
          { id: 'a', title: 'Run tests', status: 'complete', markdownLineIndex: 0 },
          { id: 'b', title: 'Review blockers', status: 'in_progress', markdownLineIndex: 1 }
        ]}
      />
    )

    expect(screen.getByText('Wave 1 Verification')).toBeTruthy()
    expect(screen.getByText('Run tests')).toBeTruthy()
    expect(screen.getByText('Complete')).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'Run tests' })).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/VerificationTaskBlockSummary.test.tsx`  
Expected: FAIL with missing component.

**Step 3: Implement minimal readonly adapter**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { TaskBlockList } from './primitives/TaskBlockList'

export function VerificationTaskBlockSummary({ title, tasks }: Props) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <TaskBlockList tasks={tasks} mode="readonly" />
      </CardContent>
    </Card>
  )
}
```

Do not wire this into center/final-verification routes in this ticket.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/right/VerificationTaskBlockSummary.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/right/VerificationTaskBlockSummary.tsx tests/unit/renderer/right/VerificationTaskBlockSummary.test.tsx
git commit -m "feat(renderer): add verification task block summary adapter"
```

### Task 7: Keep RightPanel Behavior Stable After Extraction

**Files:**
- Modify: `src/renderer/hooks/useSpecDocument.ts`
- Modify: `src/renderer/components/layout/RightPanel.tsx` (only if import path updates are needed)
- Modify: `tests/unit/renderer/hooks/useSpecDocument.test.ts`
- Modify: `tests/unit/renderer/right/RightPanel.draft-flow.test.tsx`
- Modify: `tests/unit/renderer/right/SpecTab.structured.test.tsx`

**Step 1: Add failing regression assertions around extraction paths**

```ts
it('still toggles task status and rewrites markdown through primitive utility imports', async () => {
  // extend existing useSpecDocument test to assert marker changes persist post-refactor
})

it('keeps draft apply -> structured view flow unchanged after primitive extraction', async () => {
  // extend existing RightPanel.draft-flow spec
})
```

**Step 2: Run tests to verify failures**

Run:  
`npx vitest run tests/unit/renderer/hooks/useSpecDocument.test.ts tests/unit/renderer/right/RightPanel.draft-flow.test.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx`

Expected: FAIL until imports/composition are updated.

**Step 3: Update integration imports and wrappers minimally**

- Move `useSpecDocument` imports to primitive module paths.
- Keep public behavior unchanged.
- Avoid changing app state/store contracts.

**Step 4: Run tests to verify pass**

Run:  
`npx vitest run tests/unit/renderer/hooks/useSpecDocument.test.ts tests/unit/renderer/right/RightPanel.draft-flow.test.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/hooks/useSpecDocument.ts src/renderer/components/layout/RightPanel.tsx tests/unit/renderer/hooks/useSpecDocument.test.ts tests/unit/renderer/right/RightPanel.draft-flow.test.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx
git commit -m "refactor(renderer): preserve right panel flows after primitive extraction"
```

### Task 8: Final Verification and Evidence for KAT-218

**Files:**
- Modify: `docs/plans/2026-03-05-kat-218-structured-spec-markdown-primitives-task-block-renderer-implementation-plan.md` (verification notes section)

**Step 1: Run focused unit suites**

Run:
`npx vitest run tests/unit/renderer/right/spec-parser.test.ts tests/unit/renderer/right/spec-task-markdown.test.ts tests/unit/renderer/right/TaskList.test.tsx tests/unit/renderer/right/SpecSections.test.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx tests/unit/renderer/right/RightPanel.draft-flow.test.tsx tests/unit/renderer/hooks/useSpecDocument.test.ts tests/unit/renderer/right/primitives/*.test.ts* tests/unit/renderer/right/VerificationTaskBlockSummary.test.tsx`

Expected: PASS.

**Step 2: Run renderer CI-equivalent checks**

Run: `npm run -w app test:ci:local`  
Expected: PASS.

**Step 3: Validate acceptance checklist**

Checklist:
- Shared parser primitive exists and is consumed via compatibility shim.
- Shared task-block markdown primitive exists and is consumed via compatibility shim.
- Shared task-block renderer and section-block renderer primitives are in place.
- Right panel spec/draft/toggle behavior remains unchanged.
- Verification adapter proves reuse without center/state cross-scope edits.

**Step 4: Prepare Linear evidence summary**

Include:
- Test command outputs
- List of new primitive modules
- Explicit statement confirming no edits in `center/*`, `src/shared/types/*`, or `src/main/state-store.ts`.

**Step 5: Commit verification notes**

```bash
git add docs/plans/2026-03-05-kat-218-structured-spec-markdown-primitives-task-block-renderer-implementation-plan.md
git commit -m "docs(app): finalize KAT-218 verification checklist"
```

## Verification Notes

### Execution Evidence (2026-03-05)

Completed commits (one per task):
- `feca15e` — `test(renderer): add KAT-218 primitive contract guards`
- `03df8c2` — `refactor(renderer): extract structured spec parser primitive`
- `3d9236c` — `refactor(renderer): extract task block markdown primitive`
- `afd475b` — `refactor(renderer): add reusable task block list primitive`
- `4d689d7` — `refactor(renderer): extract structured section block primitive`
- `d1a8b49` — `feat(renderer): add verification task block summary adapter`
- `d005ab6` — `refactor(renderer): preserve right panel flows after primitive extraction`

Focused KAT-218 suite:

`npx vitest run tests/unit/renderer/right/spec-parser.test.ts tests/unit/renderer/right/spec-task-markdown.test.ts tests/unit/renderer/right/TaskList.test.tsx tests/unit/renderer/right/SpecSections.test.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx tests/unit/renderer/right/RightPanel.draft-flow.test.tsx tests/unit/renderer/hooks/useSpecDocument.test.ts tests/unit/renderer/right/primitives/*.test.ts* tests/unit/renderer/right/VerificationTaskBlockSummary.test.tsx`

Result:
- Test Files: `13 passed (13)`
- Tests: `61 passed (61)`

Task 7 regression suite:

`npx vitest run tests/unit/renderer/hooks/useSpecDocument.test.ts tests/unit/renderer/right/RightPanel.draft-flow.test.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx`

Result:
- Test Files: `3 passed (3)`
- Tests: `25 passed (25)`

Renderer CI-equivalent command:

`npm run -w app test:ci:local`

Result:
- Failed at lint/typecheck due missing external modules unrelated to KAT-218 scope:
  - `@mariozechner/pi-agent-core`
  - `@mariozechner/pi-ai`
  - `proper-lockfile`
- Error surfaced from `src/main/agent-runner.ts` and `src/main/auth-storage.ts`.

### Acceptance Checklist

- [x] Shared parser primitive exists and is consumed via compatibility shim.
- [x] Shared task-block markdown primitive exists and is consumed via compatibility shim.
- [x] Shared task-block renderer and section-block renderer primitives are in place.
- [x] Right panel spec/draft/toggle behavior remains unchanged (covered by regression suites above).
- [x] Verification adapter proves reuse without center/state cross-scope edits.

### New Primitive Modules

- `src/renderer/components/right/primitives/spec-markdown-types.ts`
- `src/renderer/components/right/primitives/parse-spec-markdown.ts`
- `src/renderer/components/right/primitives/task-block-markdown.ts`
- `src/renderer/components/right/primitives/TaskBlockList.tsx`
- `src/renderer/components/right/primitives/StructuredSectionBlocks.tsx`
- `src/renderer/components/right/VerificationTaskBlockSummary.tsx`

### Scope Confirmation

No edits were made in:
- `src/renderer/components/center/*`
- `src/shared/types/*`
- `src/main/state-store.ts`
