# KAT-89 New Tab Dropdown + Note Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement center/right panel `+` tab dropdown fidelity with functional `New Note` creation, rename, and close behaviors scoped to KAT-89.

**Architecture:** Introduce a shared dynamic tab-strip component that encapsulates tab rendering, `+` dropdown actions, inline rename, and close affordances. Keep tab state local to each panel (center and right) and render panel-specific base content plus shared note scaffold content for dynamic note tabs. Defer global pane/tab graph and non-note tab creation to follow-up tickets.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, shadcn/Radix tabs + dropdown-menu, lucide-react icons.

---

Skill references:
- `@test-driven-development`
- `@verification-before-completion`

### Task 1: Add Shared Dynamic Tab Primitive Tests (Failing First)

**Files:**
- Create: `tests/unit/renderer/shared/DynamicPanelTabs.test.tsx`
- Test: `tests/unit/renderer/shared/DynamicPanelTabs.test.tsx`

**Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DynamicPanelTabs } from '../../../../src/renderer/components/shared/DynamicPanelTabs'

describe('DynamicPanelTabs', () => {
  it('creates a New Note tab and calls onCreateNote for the owning panel', () => {
    const onCreateNote = vi.fn()
    render(
      <DynamicPanelTabs
        ariaLabel="Center tabs"
        tabs={[{ id: 'base', label: 'Coordinator', kind: 'base', closable: false, renamable: false }]}
        activeTabId="base"
        onActiveTabChange={() => {}}
        onCreateNote={onCreateNote}
        onCloseTab={() => {}}
        onRenameTab={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Note' }))

    expect(onCreateNote).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/shared/DynamicPanelTabs.test.tsx`
Expected: FAIL with module/file-not-found for `DynamicPanelTabs`.

**Step 3: Write minimal implementation scaffold**

```tsx
// src/renderer/components/shared/DynamicPanelTabs.tsx
export function DynamicPanelTabs() {
  return null
}
```

**Step 4: Run test to verify it still fails for behavior**

Run: `npx vitest run tests/unit/renderer/shared/DynamicPanelTabs.test.tsx`
Expected: FAIL with missing UI elements (`New tab` button/menu item).

**Step 5: Commit scaffold + failing test**

```bash
git add tests/unit/renderer/shared/DynamicPanelTabs.test.tsx src/renderer/components/shared/DynamicPanelTabs.tsx
git commit -m "test(app): add failing tests for dynamic panel tabs new-note action"
```

### Task 2: Implement Shared Dynamic Tab Primitive

**Files:**
- Modify: `src/renderer/components/shared/DynamicPanelTabs.tsx`
- Test: `tests/unit/renderer/shared/DynamicPanelTabs.test.tsx`

**Step 1: Expand tests for no-op and close/rename affordances**

```tsx
it('keeps non-note menu items enabled but does not create tabs', () => {
  // click New Agent/New Terminal/New Browser
  // assert onCreateNote not called
})

it('renders close button only for closable tabs', () => {
  // base tab has no close button, note tab has close button
})

it('supports double-click rename lifecycle with Enter, blur, and Escape', () => {
  // double click label -> input shown
  // Enter commits, Escape cancels
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/shared/DynamicPanelTabs.test.tsx`
Expected: FAIL on missing behavior assertions.

**Step 3: Implement minimal behavior in shared component**

```tsx
// include local editing state + dropdown actions
// menu actions:
// - New Note => onCreateNote()
// - others => no-op
// double-click label => inline input
// Enter/blur => onRenameTab(tabId, value)
// Escape => cancel
// close button => onCloseTab(tabId)
```

**Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/renderer/shared/DynamicPanelTabs.test.tsx`
Expected: PASS.

**Step 5: Commit shared component implementation**

```bash
git add src/renderer/components/shared/DynamicPanelTabs.tsx tests/unit/renderer/shared/DynamicPanelTabs.test.tsx
git commit -m "feat(app): add reusable dynamic panel tab strip with dropdown and rename"
```

### Task 3: Integrate Dynamic Tabs into Center Panel

**Files:**
- Modify: `src/renderer/components/center/CenterPanel.tsx`
- Modify: `tests/unit/renderer/center/CenterPanel.test.tsx`

**Step 1: Write failing center integration tests**

```tsx
it('creates and activates New Note tab in center panel via + menu', () => {
  // open menu, click New Note, assert active note tab + scaffold content
})

it('allows closing center note tabs and falls back to nearest tab', () => {
  // create two notes, close active, assert expected fallback active tab
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/center/CenterPanel.test.tsx`
Expected: FAIL due to missing center panel tab/dropdown behaviors.

**Step 3: Implement center panel state wiring**

```tsx
// maintain panel-local tabs with base Coordinator tab
// onCreateNote => append { label: 'New Note', kind: 'note' } and activate
// render existing children for base tab
// render note scaffold for note tabs
```

**Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/renderer/center/CenterPanel.test.tsx`
Expected: PASS.

**Step 5: Commit center integration**

```bash
git add src/renderer/components/center/CenterPanel.tsx tests/unit/renderer/center/CenterPanel.test.tsx
git commit -m "feat(app): wire center panel new-note tabs with create close and rename"
```

### Task 4: Integrate Dynamic Tabs into Right Panel

**Files:**
- Modify: `src/renderer/components/layout/RightPanel.tsx`
- Modify: `tests/unit/renderer/right/RightPanel.test.tsx`

**Step 1: Write failing right integration tests**

```tsx
it('creates and activates New Note tab in right panel via + menu', () => {
  // open right menu, click New Note, assert note tab active
})

it('keeps base Spec tab non-closable and non-renamable', () => {
  // assert no close action for Spec and rename not entered
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/right/RightPanel.test.tsx`
Expected: FAIL due to old static Spec/Notes tabs implementation.

**Step 3: Implement right panel state wiring**

```tsx
// replace static TabBar with DynamicPanelTabs
// base tab: Spec
// dynamic notes use New Note scaffold content
// keep collapse/expand behavior unchanged
```

**Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/renderer/right/RightPanel.test.tsx`
Expected: PASS.

**Step 5: Commit right integration**

```bash
git add src/renderer/components/layout/RightPanel.tsx tests/unit/renderer/right/RightPanel.test.tsx
git commit -m "feat(app): add right panel new-note tab dropdown parity"
```

### Task 5: Add Shared Note Scaffold Content Component

**Files:**
- Create: `src/renderer/components/shared/NewNoteScaffold.tsx`
- Modify: `src/renderer/components/center/CenterPanel.tsx`
- Modify: `src/renderer/components/layout/RightPanel.tsx`
- Test: `tests/unit/renderer/center/CenterPanel.test.tsx`
- Test: `tests/unit/renderer/right/RightPanel.test.tsx`

**Step 1: Add failing assertions for scaffold copy**

```tsx
expect(screen.getByText(/Start drafting a specification for what you want to build\./i)).toBeTruthy()
```

**Step 2: Run tests to verify they fail**

Run:
- `npx vitest run tests/unit/renderer/center/CenterPanel.test.tsx`
- `npx vitest run tests/unit/renderer/right/RightPanel.test.tsx`

Expected: FAIL on missing scaffold text in one or both panels.

**Step 3: Implement shared scaffold component and consume it**

```tsx
// NewNoteScaffold renders consistent heading/body style text used by both panels
```

**Step 4: Run tests to verify pass**

Run:
- `npx vitest run tests/unit/renderer/center/CenterPanel.test.tsx`
- `npx vitest run tests/unit/renderer/right/RightPanel.test.tsx`

Expected: PASS.

**Step 5: Commit scaffold reuse**

```bash
git add src/renderer/components/shared/NewNoteScaffold.tsx src/renderer/components/center/CenterPanel.tsx src/renderer/components/layout/RightPanel.tsx tests/unit/renderer/center/CenterPanel.test.tsx tests/unit/renderer/right/RightPanel.test.tsx
git commit -m "refactor(app): share new-note scaffold content across center and right panels"
```

### Task 6: Verification, Quality Gate, and Evidence

**Files:**
- Modify if needed: `tests/unit/renderer/shared/DynamicPanelTabs.test.tsx`
- Modify if needed: `tests/unit/renderer/center/CenterPanel.test.tsx`
- Modify if needed: `tests/unit/renderer/right/RightPanel.test.tsx`

**Step 1: Run targeted unit suite first**

```bash
npx vitest run tests/unit/renderer/shared/DynamicPanelTabs.test.tsx \
  tests/unit/renderer/center/CenterPanel.test.tsx \
  tests/unit/renderer/right/RightPanel.test.tsx
```

Expected: PASS.

**Step 2: Run full app unit tests**

Run: `npm run test`
Expected: PASS.

**Step 3: Run lint/type gate**

Run: `npm run lint`
Expected: PASS.

**Step 4: Capture screenshot evidence against updated KAT-89 mocks**

Run:
- `npm run dev:web`
- verify center/right `+` affordance, dropdown styling, new note create/rename/close behavior

Expected: visual parity credibility with the attached screenshots.

**Step 5: Commit verification touch-ups**

```bash
git add tests/unit/renderer/shared/DynamicPanelTabs.test.tsx tests/unit/renderer/center/CenterPanel.test.tsx tests/unit/renderer/right/RightPanel.test.tsx
git commit -m "test(app): finalize KAT-89 tab dropdown and note-tab interaction coverage"
```
