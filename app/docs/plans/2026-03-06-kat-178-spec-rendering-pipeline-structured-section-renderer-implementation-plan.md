# KAT-178 Spec Rendering Pipeline + Structured Section Renderer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land a deterministic spec markdown parsing and structured rendering pipeline for the right panel, including canonical sections, task blocks, reload/session-restore stability, and parser/renderer regression coverage.

**Architecture:** Keep the existing `KAT-218` substrate as the backbone: `parse-spec-markdown.ts` parses persisted markdown into a `StructuredSpecDocument`, `useSpecDocument.ts` persists and restores it, and `SpecSections.tsx` renders the structured view. Tighten that pipeline rather than replacing it: improve parser fidelity where markdown structure is currently flattened away, route canonical section content through a real markdown renderer, and freeze the owned contract with focused unit and snapshot-style tests.

**Tech Stack:** React 19, TypeScript, `react-markdown` + `remark-gfm`, shadcn/ui cards/checkboxes, Vitest, Testing Library.

---

**Execution Rules:**
- Apply `@test-driven-development` for every task (`red -> green -> refactor`).
- Apply `@verification-before-completion` before marking KAT-178 complete.
- Keep commits small and frequent (one commit per task).
- Stay inside `src/renderer/components/right/*`, `src/renderer/hooks/useSpecDocument.ts`, and directly related unit tests unless a stricter contract test requires a nearby shim change.
- Do not add `KAT-181` ownership: no checkbox persistence semantics, write-conflict policy, or cross-writer sync rules.

### Task 1: Freeze the Owned Parser Contract with Failing Edge-Case Tests

**Files:**
- Modify: `tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts`
- Modify: `tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts`
- Modify: `src/renderer/components/right/primitives/parse-spec-markdown.ts`

**Step 1: Write the failing parser edge-case tests**

Add tests that prove the parser contract from the design doc instead of only the happy path:

```ts
it('preserves deterministic ids for duplicate task titles in source order', () => {
  const markdown = [
    '## Tasks',
    '- [ ] Review draft',
    '- [/] Review draft',
    '- [x] Review draft'
  ].join('\n')

  const parsed = parseSpecMarkdown(markdown)

  expect(parsed.tasks.map((task) => task.id)).toEqual([
    'task-review-draft',
    'task-review-draft-2',
    'task-review-draft-3'
  ])
})

it('returns stable empty defaults for missing sections and malformed headings', () => {
  const parsed = parseSpecMarkdown(['# Not canonical', 'random body'].join('\n'))

  expect(parsed.sections).toEqual({
    goal: '',
    acceptanceCriteria: [],
    nonGoals: [],
    assumptions: [],
    verificationPlan: [],
    rollbackPlan: []
  })
  expect(parsed.tasks).toEqual([])
})

it('preserves multiline section content needed by markdown rendering', () => {
  const markdown = [
    '## Goal',
    'Ship `inline code` support.',
    '',
    '```ts',
    'const stable = true',
    '```'
  ].join('\n')

  const parsed = parseSpecMarkdown(markdown)
  expect(parsed.sections.goal).toContain('```ts')
  expect(parsed.sections.goal).toContain('`inline code`')
})
```

Also extend `spec-primitives.contract.test.ts` so the contract example in the design doc is represented in code, especially canonical section keys and the three allowed task statuses.

**Step 2: Run tests to verify they fail**

Run:
`npx vitest run tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts`

Expected:
- FAIL because multiline markdown content is flattened or discarded by the current parser.
- FAIL if duplicate-task id output does not match the stabilized expectation.

**Step 3: Implement the minimal parser changes**

Update `parse-spec-markdown.ts` so it still returns the same top-level shape, but preserves markdown content needed by the renderer:

```ts
function normalizeTextBlock(lines: IndexedLine[]): string {
  return trimBlankEdges(lines.map((line) => line.content)).join('\n')
}

function normalizeListItems(lines: IndexedLine[]): string[] {
  // Keep one string per canonical list item, but preserve multiline markdown
  // inside that item instead of flattening everything to one plain sentence.
}
```

Implementation rules:
- Keep the existing canonical headings and output shape.
- Preserve fenced code blocks and inline markdown inside section content.
- Keep `markdownLineIndex` stable for tasks.
- Do not introduce new section keys or new persisted fields.

**Step 4: Run tests to verify they pass**

Run:
`npx vitest run tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts`

Expected:
- PASS on both suites.

**Step 5: Commit**

```bash
git add tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts src/renderer/components/right/primitives/parse-spec-markdown.ts
git commit -m "test(renderer): freeze KAT-178 spec parser contract"
```

### Task 2: Route Canonical Sections Through the Markdown Renderer

**Files:**
- Modify: `src/renderer/components/right/primitives/StructuredSectionBlocks.tsx`
- Modify: `src/renderer/components/shared/MarkdownRenderer.tsx`
- Modify: `tests/unit/renderer/right/primitives/StructuredSectionBlocks.test.tsx`

**Step 1: Write the failing renderer tests**

Add tests proving canonical section bodies render markdown, not raw strings:

```ts
it('renders inline code inside the Goal section', () => {
  render(
    <StructuredSectionBlocks
      sections={{
        goal: 'Ship `stable ids` now.',
        acceptanceCriteria: [],
        nonGoals: [],
        assumptions: [],
        verificationPlan: [],
        rollbackPlan: []
      }}
      renderTasks={() => null}
    />
  )

  expect(screen.getByText('stable ids').tagName).toBe('CODE')
})

it('renders fenced code blocks inside multiline section content', () => {
  render(
    <StructuredSectionBlocks
      sections={{
        goal: ['Use this snippet:', '', '```ts', 'const value = 1', '```'].join('\n'),
        acceptanceCriteria: [],
        nonGoals: [],
        assumptions: [],
        verificationPlan: [],
        rollbackPlan: []
      }}
      renderTasks={() => null}
    />
  )

  expect(screen.getByText('const value = 1')).toBeTruthy()
})
```

If `MarkdownRenderer` strips the styling you need for inline code readability, add a focused test there too.

**Step 2: Run tests to verify they fail**

Run:
`npx vitest run tests/unit/renderer/right/primitives/StructuredSectionBlocks.test.tsx`

Expected:
- FAIL because section bodies are currently rendered as plain text and list items.

**Step 3: Implement minimal markdown rendering**

Change `StructuredSectionBlocks.tsx` so canonical sections are still displayed in fixed order, but content is rendered with `MarkdownRenderer`:

```tsx
<CardContent>
  {sections.goal ? (
    <MarkdownRenderer content={sections.goal} className="space-y-2" />
  ) : (
    <p className="text-sm text-muted-foreground">No goal yet.</p>
  )}
</CardContent>
```

For list-style sections:
- Keep the card-per-section layout.
- Render each list item through `MarkdownRenderer` rather than raw `<li>{item}</li>`.
- Preserve ordered vs unordered semantics in the outer list.

If needed, tighten `MarkdownRenderer.tsx` with minimal styling for:
- inline `code`
- fenced `pre > code`
- list spacing inside cards

**Step 4: Run tests to verify they pass**

Run:
`npx vitest run tests/unit/renderer/right/primitives/StructuredSectionBlocks.test.tsx`

Expected:
- PASS with canonical headings still in stable order.
- PASS with inline code and fenced code rendering.

**Step 5: Commit**

```bash
git add src/renderer/components/right/primitives/StructuredSectionBlocks.tsx src/renderer/components/shared/MarkdownRenderer.tsx tests/unit/renderer/right/primitives/StructuredSectionBlocks.test.tsx
git commit -m "feat(renderer): render structured spec sections as markdown"
```

### Task 3: Freeze Structured View Parity in SpecSections and SpecTab

**Files:**
- Modify: `tests/unit/renderer/right/SpecSections.test.tsx`
- Modify: `tests/unit/renderer/right/SpecTab.structured.test.tsx`
- Modify: `src/renderer/components/right/SpecSections.tsx`
- Modify: `src/renderer/components/right/SpecTab.tsx`

**Step 1: Write the failing structured-view regression tests**

Add tests that use a realistic Spec 03 fixture rather than tiny placeholder content:

```ts
const markdown = [
  '## Goal',
  'Publish a clear `spec` surface.',
  '',
  '## Acceptance Criteria',
  '1. Render canonical sections.',
  '',
  '## Non-goals',
  '- No persistence redesign.',
  '',
  '## Assumptions',
  '- `main` is the contract.',
  '',
  '## Verification Plan',
  '1. Run renderer tests.',
  '',
  '## Rollback Plan',
  '1. Revert the renderer changes.',
  '',
  '## Tasks',
  '- [ ] Freeze contract',
  '- [/] Render markdown',
  '- [x] Preserve ids'
].join('\n')

expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()
expect(screen.getByText('main')).toBeTruthy()
expect(screen.getByRole('checkbox', { name: 'Render markdown' })).toBeTruthy()
```

Add an inline snapshot or `container.innerHTML` snapshot assertion for the structured section block tree if the suite already uses snapshots comfortably.

**Step 2: Run tests to verify they fail**

Run:
`npx vitest run tests/unit/renderer/right/SpecSections.test.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx`

Expected:
- FAIL if inline markdown is still rendered as plain text.
- FAIL if the structured view does not match the realistic canonical fixture.

**Step 3: Implement the minimal rendering adjustments**

Keep the state machine unchanged, but tighten the structured-view path:

```tsx
return (
  <SpecSections
    document={specState.document}
    taskActivitySnapshot={specState.taskActivitySnapshot}
    onToggleTask={specState.onToggleTask}
    onEditMarkdown={specState.onEditMarkdown}
    commentStatusNote={specState.commentStatusNote}
  />
)
```

Implementation rules:
- Preserve the existing `generating`, `draft_ready`, `editing`, and `structured_view` states.
- Do not reintroduce raw-preview rendering for the structured path.
- Keep task overlay merge behavior in `SpecSections.tsx` deterministic.

If the current implementation already passes structurally, only make the minimal changes needed to support the richer markdown fixture and snapshot parity.

**Step 4: Run tests to verify they pass**

Run:
`npx vitest run tests/unit/renderer/right/SpecSections.test.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx`

Expected:
- PASS on both suites.
- Snapshot or parity assertions are stable on rerun.

**Step 5: Commit**

```bash
git add tests/unit/renderer/right/SpecSections.test.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx src/renderer/components/right/SpecSections.tsx src/renderer/components/right/SpecTab.tsx
git commit -m "test(renderer): freeze structured spec view parity"
```

### Task 4: Prove Reload and Session-Restore Stability Through useSpecDocument

**Files:**
- Modify: `tests/unit/renderer/hooks/useSpecDocument.test.ts`
- Modify: `src/renderer/hooks/useSpecDocument.ts`

**Step 1: Write the failing reload/session-restore tests**

Add tests that prove the parser/renderer contract survives persistence round trips:

```ts
it('restores multiline markdown sections and task ids after specGet reload', async () => {
  mockSpecGet.mockResolvedValueOnce({
    markdown: [
      '## Goal',
      'Ship `stable ids`.',
      '',
      '```ts',
      'const stable = true',
      '```',
      '',
      '## Tasks',
      '- [ ] Freeze contract'
    ].join('\n'),
    updatedAt: '2026-03-06T00:00:00.000Z',
    appliedRunId: 'run-123'
  })

  const { result } = renderHook(() =>
    useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
  )

  await waitFor(() => {
    expect(result.current.document.sections.goal).toContain('```ts')
    expect(result.current.document.tasks[0]).toMatchObject({
      id: 'task-freeze-contract',
      status: 'not_started'
    })
  })
})
```

Also add a round-trip test:
- set markdown
- toggle task
- inspect saved markdown
- reload from `specGet`
- assert same task id and same section content

**Step 2: Run tests to verify they fail**

Run:
`npx vitest run tests/unit/renderer/hooks/useSpecDocument.test.ts`

Expected:
- FAIL if multiline section markdown is lost during parse/buildDocument.
- FAIL if the round-tripped output changes shape after toggle/reload.

**Step 3: Implement the minimal hook changes**

If needed, tighten `useSpecDocument.ts` only enough to preserve the stabilized parser output through its existing flow:

```ts
function buildDocument(markdown: string, appliedRunId?: string, updatedAt?: string): StructuredSpecDocument {
  const parsed = parseSpecMarkdown(markdown)
  return {
    ...parsed,
    appliedRunId,
    updatedAt: updatedAt ?? parsed.updatedAt
  }
}
```

Keep these boundaries:
- no new store semantics
- no new persistence fields
- no task conflict logic

**Step 4: Run tests to verify they pass**

Run:
`npx vitest run tests/unit/renderer/hooks/useSpecDocument.test.ts`

Expected:
- PASS with deterministic reload and round-trip behavior.

**Step 5: Commit**

```bash
git add tests/unit/renderer/hooks/useSpecDocument.test.ts src/renderer/hooks/useSpecDocument.ts
git commit -m "test(renderer): prove spec document reload stability"
```

### Task 5: Run the Focused KAT-178 Verification Pass

**Files:**
- Modify only if needed from prior tasks.

**Step 1: Run the focused right-panel suites**

Run:

```bash
npx vitest run \
  tests/unit/renderer/right/primitives/parse-spec-markdown.test.ts \
  tests/unit/renderer/right/primitives/spec-primitives.contract.test.ts \
  tests/unit/renderer/right/primitives/StructuredSectionBlocks.test.tsx \
  tests/unit/renderer/right/SpecSections.test.tsx \
  tests/unit/renderer/right/SpecTab.structured.test.tsx \
  tests/unit/renderer/hooks/useSpecDocument.test.ts
```

Expected:
- PASS on all targeted KAT-178 suites.

**Step 2: Run the broader renderer safety net**

Run:

```bash
npx vitest run \
  tests/unit/renderer/right \
  tests/unit/renderer/hooks/useSpecDocument.test.ts
```

Expected:
- PASS without regressions in the right-panel renderer surface.

**Step 3: If any test fails, fix minimally and rerun**

Allowed fix areas:
- `src/renderer/components/right/*`
- `src/renderer/components/shared/MarkdownRenderer.tsx`
- `src/renderer/hooks/useSpecDocument.ts`

Do not expand into main/preload/store semantics unless a failing existing contract requires a tiny compatibility fix.

**Step 4: Commit the verification-ready state**

```bash
git add src/renderer/components/right src/renderer/components/shared/MarkdownRenderer.tsx src/renderer/hooks/useSpecDocument.ts tests/unit/renderer/right tests/unit/renderer/hooks/useSpecDocument.test.ts
git commit -m "feat(renderer): complete KAT-178 structured spec rendering pipeline"
```

Plan complete and saved to `docs/plans/2026-03-06-kat-178-spec-rendering-pipeline-structured-section-renderer-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
