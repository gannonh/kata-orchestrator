# KAT-65 Home/Spaces Top-Level Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-screen Home/Spaces UI that replaces the workspace shell and supports local representational interactions for space management.

**Architecture:** Introduce an app-level view switch (`workspace | home`) in the renderer root. Keep the existing `AppShell` intact for workspace mode, and render a new `HomeSpacesScreen` in home mode. Home screen behavior uses in-memory mock state only (no persistence/IPC mutation) and returns to workspace on "open space".

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, Vitest + Testing Library, Playwright (Electron E2E).

---

Implementation guidance:
- Apply @test-driven-development on each task.
- Apply @verification-before-completion before marking this ticket done.
- Keep commits small and frequent.

### Task 1: Add top-level app view state and Home screen mount point

**Files:**
- Create: `src/renderer/components/home/HomeSpacesScreen.tsx`
- Test: `tests/unit/renderer/App.test.tsx`
- Modify: `src/renderer/App.tsx`

**Step 1: Write the failing test**

```tsx
it('switches from workspace shell to home view and back', async () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Orchestrator Chat' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Open Home spaces view' }))
  expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Orchestrator Chat' })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
  expect(screen.getByRole('heading', { name: 'Orchestrator Chat' })).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/renderer/App.test.tsx -t "switches from workspace shell to home view and back"`  
Expected: FAIL (missing Home trigger and/or missing Home view heading).

**Step 3: Write minimal implementation**

```tsx
// src/renderer/App.tsx
export function App() {
  const [appView, setAppView] = useState<'workspace' | 'home'>('workspace')
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)

  if (appView === 'home') {
    return (
      <HomeSpacesScreen
        onOpenSpace={(spaceId) => {
          setActiveSpaceId(spaceId)
          setAppView('workspace')
        }}
      />
    )
  }

  return <AppShell onOpenHome={() => setAppView('home')} activeSpaceId={activeSpaceId} />
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/renderer/App.test.tsx`  
Expected: PASS for new and existing App tests.

**Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/home/HomeSpacesScreen.tsx tests/unit/renderer/App.test.tsx
git commit -m "feat(app): add top-level workspace/home view switching"
```

### Task 2: Add Home entry action in workspace shell

**Files:**
- Modify: `src/renderer/components/layout/AppShell.tsx`
- Modify: `src/renderer/components/layout/LeftPanel.tsx`
- Test: `tests/unit/renderer/left/LeftPanel.test.tsx`
- Test: `tests/unit/renderer/AppShell.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders a home action and calls onOpenHome when clicked', () => {
  const onOpenHome = vi.fn()
  render(<LeftPanel onOpenHome={onOpenHome} />)

  fireEvent.click(screen.getByRole('button', { name: 'Open Home spaces view' }))
  expect(onOpenHome).toHaveBeenCalledTimes(1)
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/renderer/left/LeftPanel.test.tsx -t "home action"`  
Expected: FAIL (prop/action not implemented).

**Step 3: Write minimal implementation**

```tsx
// LeftPanel props
type LeftPanelProps = {
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  onOpenHome?: () => void
}

// Add button in left rail/header
<Button aria-label="Open Home spaces view" onClick={onOpenHome}>
  <House className="h-4 w-4" />
</Button>
```

```tsx
// AppShell passthrough
type AppShellProps = { onOpenHome?: () => void; activeSpaceId?: string | null }
<LeftPanel collapsed={leftCollapsed} onCollapsedChange={setLeftCollapsed} onOpenHome={onOpenHome} />
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/AppShell.test.tsx`  
Expected: PASS with prior behavior unchanged.

**Step 5: Commit**

```bash
git add src/renderer/components/layout/AppShell.tsx src/renderer/components/layout/LeftPanel.tsx tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/AppShell.test.tsx
git commit -m "feat(app): add workspace home entry action"
```

### Task 3: Build Home layout and representational create panel interactions

**Files:**
- Create: `src/renderer/components/home/CreateSpacePanel.tsx`
- Modify: `src/renderer/components/home/HomeSpacesScreen.tsx`
- Test: `tests/unit/renderer/home/HomeSpacesScreen.test.tsx`

**Step 1: Write the failing test**

```tsx
it('toggles create panel active visuals and mode selections', () => {
  render(<HomeSpacesScreen onOpenSpace={() => {}} />)

  fireEvent.click(screen.getByRole('textbox', { name: 'Space prompt' }))
  expect(screen.getByTestId('create-space-panel')).toHaveAttribute('data-active', 'true')

  fireEvent.click(screen.getByRole('button', { name: 'Select single-agent mode' }))
  expect(screen.getByRole('button', { name: 'Select single-agent mode' })).toHaveAttribute('aria-pressed', 'true')
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/renderer/home/HomeSpacesScreen.test.tsx -t "create panel active visuals"`  
Expected: FAIL (component/state not fully wired).

**Step 3: Write minimal implementation**

```tsx
const [isCreatePanelActive, setIsCreatePanelActive] = useState(false)
const [spacePrompt, setSpacePrompt] = useState('')
const [selectedMode, setSelectedMode] = useState<'team' | 'single'>('team')
const [rapidFire, setRapidFire] = useState(false)
```

```tsx
<section data-testid="create-space-panel" data-active={isCreatePanelActive ? 'true' : 'false'}>
  <textarea aria-label="Space prompt" value={spacePrompt} onFocus={() => setIsCreatePanelActive(true)} />
  <button aria-label="Select team mode" aria-pressed={selectedMode === 'team'} onClick={() => setSelectedMode('team')} />
  <button aria-label="Select single-agent mode" aria-pressed={selectedMode === 'single'} onClick={() => setSelectedMode('single')} />
  <button aria-label="Toggle rapid fire mode" aria-pressed={rapidFire} onClick={() => setRapidFire((v) => !v)} />
</section>
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/renderer/home/HomeSpacesScreen.test.tsx`  
Expected: PASS for create-panel interaction specs.

**Step 5: Commit**

```bash
git add src/renderer/components/home/HomeSpacesScreen.tsx src/renderer/components/home/CreateSpacePanel.tsx tests/unit/renderer/home/HomeSpacesScreen.test.tsx
git commit -m "feat(app): implement home create-space panel interactive states"
```

### Task 4: Build Spaces list panel grouping/filter/search/selection behavior

**Files:**
- Create: `src/renderer/mock/spaces.ts`
- Create: `src/renderer/components/home/SpacesListPanel.tsx`
- Modify: `src/renderer/components/home/HomeSpacesScreen.tsx`
- Test: `tests/unit/renderer/home/HomeSpacesScreen.test.tsx`

**Step 1: Write the failing test**

```tsx
it('filters spaces by search and archived toggle, and supports row selection', () => {
  render(<HomeSpacesScreen onOpenSpace={() => {}} />)

  fireEvent.change(screen.getByLabelText('Search spaces'), { target: { value: 'Wave 1' } })
  expect(screen.getByText('Unblock Wave 1 verification')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Show archived spaces' }))
  expect(screen.getByText('Archived migration notes')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Select space Unblock Wave 1 verification' }))
  expect(screen.getByRole('button', { name: 'Select space Unblock Wave 1 verification' })).toHaveAttribute('aria-pressed', 'true')
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/renderer/home/HomeSpacesScreen.test.tsx -t "filters spaces"`  
Expected: FAIL (filter/group/selection behavior missing).

**Step 3: Write minimal implementation**

```tsx
const [groupByRepo, setGroupByRepo] = useState(true)
const [showArchived, setShowArchived] = useState(false)
const [searchQuery, setSearchQuery] = useState('')
const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(initialSpaces[0]?.id ?? null)

const visibleSpaces = useMemo(() => {
  return initialSpaces
    .filter((space) => showArchived || !space.archived)
    .filter((space) => space.name.toLowerCase().includes(searchQuery.toLowerCase()))
}, [initialSpaces, showArchived, searchQuery])
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/renderer/home/HomeSpacesScreen.test.tsx`  
Expected: PASS for list interaction and empty/no-result states.

**Step 5: Commit**

```bash
git add src/renderer/mock/spaces.ts src/renderer/components/home/SpacesListPanel.tsx src/renderer/components/home/HomeSpacesScreen.tsx tests/unit/renderer/home/HomeSpacesScreen.test.tsx
git commit -m "feat(app): add home spaces list filtering grouping and selection"
```

### Task 5: Wire "open selected space" transition back to workspace

**Files:**
- Modify: `src/renderer/components/home/HomeSpacesScreen.tsx`
- Modify: `src/renderer/App.tsx`
- Test: `tests/unit/renderer/App.test.tsx`

**Step 1: Write the failing test**

```tsx
it('returns to workspace when opening the selected space', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Open Home spaces view' }))
  fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
  expect(screen.getByRole('heading', { name: 'Orchestrator Chat' })).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/renderer/App.test.tsx -t "returns to workspace"`  
Expected: FAIL if callback wiring is incomplete.

**Step 3: Write minimal implementation**

```tsx
// HomeSpacesScreen
<button
  type="button"
  aria-label="Open selected space"
  disabled={!selectedSpaceId}
  onClick={() => selectedSpaceId && onOpenSpace(selectedSpaceId)}
>
  Open space
</button>
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/renderer/App.test.tsx tests/unit/renderer/home/HomeSpacesScreen.test.tsx`  
Expected: PASS with stable behavior in both directions.

**Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/home/HomeSpacesScreen.tsx tests/unit/renderer/App.test.tsx tests/unit/renderer/home/HomeSpacesScreen.test.tsx
git commit -m "feat(app): wire home space open action to workspace view"
```

### Task 6: Add E2E quality-gate scenario for Home takeover flow

**Files:**
- Modify: `tests/e2e/navigation.spec.ts`

**Step 1: Write the failing test**

```ts
test('opens home screen, hides workspace content, and returns on open space @uat @ci @quality-gate', async ({ appWindow }) => {
  await appWindow.getByRole('button', { name: 'Open Home spaces view' }).click()
  await expect(appWindow.getByRole('heading', { name: 'Home' })).toBeVisible()
  await expect(appWindow.getByRole('heading', { name: 'Orchestrator Chat' })).toHaveCount(0)

  await appWindow.getByRole('button', { name: 'Open selected space' }).click()
  await expect(appWindow.getByRole('heading', { name: 'Orchestrator Chat' })).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:e2e:quality-gate -- --grep "opens home screen, hides workspace content, and returns on open space"`  
Expected: FAIL before feature wiring is complete.

**Step 3: Write minimal implementation**

```tsx
// Ensure role/label contracts are stable for E2E:
// - "Open Home spaces view"
// - "Open selected space"
// - "Home" heading in HomeSpacesScreen
```

**Step 4: Run test to verify it passes**

Run: `npm run test:e2e:quality-gate -- --grep "opens home screen, hides workspace content, and returns on open space"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/e2e/navigation.spec.ts
git commit -m "test(app): cover home spaces full-takeover navigation flow"
```

### Task 7: Full verification and ticket evidence capture

**Files:**
- Modify: `docs/plans/2026-02-23-kat-65-home-spaces-design.md` (optional final notes only)
- Modify: `docs/plans/2026-02-23-kat-65-home-spaces-implementation.md` (append run evidence section)

**Step 1: Run unit suite**

Run: `npm run test`  
Expected: PASS.

**Step 2: Run coverage gate**

Run: `npm run test:coverage`  
Expected: PASS with project thresholds met.

**Step 3: Run quality-gate E2E**

Run: `npm run test:e2e:quality-gate`  
Expected: PASS.

**Step 4: Record evidence for Linear**

Capture concise evidence:
- key unit assertions added
- E2E scenario name and result
- screenshots if needed for visual parity notes

**Step 5: Commit final docs updates**

```bash
git add docs/plans/2026-02-23-kat-65-home-spaces-implementation.md docs/plans/2026-02-23-kat-65-home-spaces-design.md
git commit -m "docs(app): record KAT-65 verification evidence"
```

