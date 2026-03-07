# KAT-170 Sidebar Sections/Nav With Collapse-Expand Behavior Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the Spec 02 left sidebar behavior for coordinator sessions so `Agents`, `Context`, collapse/expand, and sidebar sizing match the scoped mock intent without stacking top-level affordances.

**Architecture:** Keep the existing `LeftPanel` rail and collapse mechanics, but introduce coordinator-specific left-surface bodies and a small mode resolver so coordinator sessions can hide the build-session status block while preserving later Spec 04 behavior. Build the new UI from selector-backed data using a dedicated hook that combines roster, context resources, and runs instead of parsing prompt/context state in JSX.

**Tech Stack:** React 19, Electron preload IPC, TypeScript, Tailwind/shadcn UI, Vitest, Playwright

---

Use `@test-driven-development` for each task. Use `@verification-before-completion` before claiming the ticket is done.

### Task 1: Add a coordinator sidebar data hook

**Files:**
- Create: `src/renderer/hooks/useCoordinatorSidebarData.ts`
- Test: `tests/unit/renderer/hooks/useCoordinatorSidebarData.test.ts`

**Step 1: Write the failing test**

```ts
it('loads coordinator sidebar data from IPC and derives prompt preview + context items', async () => {
  window.kata = {
    sessionAgentRosterList: vi.fn().mockResolvedValue([coordinatorAgent]),
    sessionContextResourcesList: vi.fn().mockResolvedValue([specResource]),
    runList: vi.fn().mockResolvedValue([latestRun])
  } as unknown as Window['kata']

  const { result } = renderHook(() => useCoordinatorSidebarData('session-1'))

  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.promptPreview).toContain('I would like to build')
  expect(result.current.contextItems[0]?.label).toBe('Spec')
  expect(result.current.agentItems[0]?.name).toBe('Coordinator')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/hooks/useCoordinatorSidebarData.test.ts`
Expected: FAIL with `Cannot find module '../../../../src/renderer/hooks/useCoordinatorSidebarData'` or equivalent missing export error.

**Step 3: Write minimal implementation**

```ts
export function useCoordinatorSidebarData(sessionId: string | null) {
  const [state, setState] = useState({
    agentItems: [],
    contextItems: [],
    promptPreview: null,
    isLoading: false,
    error: null
  })

  useEffect(() => {
    if (!sessionId || !window.kata?.sessionAgentRosterList || !window.kata?.sessionContextResourcesList || !window.kata?.runList) {
      setState((current) => ({ ...current, agentItems: [], contextItems: [], promptPreview: null, isLoading: false }))
      return
    }

    let disposed = false
    setState((current) => ({ ...current, isLoading: true, error: null }))

    void Promise.all([
      window.kata.sessionAgentRosterList({ sessionId }),
      window.kata.sessionContextResourcesList({ sessionId }),
      window.kata.runList(sessionId)
    ]).then(([agentRoster, contextResources, runs]) => {
      if (disposed) return
      const contractState = { agentRoster: indexById(agentRoster), contextResources: indexById(contextResources), runs: indexById(runs) }
      setState({
        agentItems: selectCoordinatorAgentList(contractState, sessionId),
        contextItems: selectCoordinatorContextItems(contractState, sessionId),
        promptPreview: selectCoordinatorPromptPreview(contractState, sessionId),
        isLoading: false,
        error: null
      })
    }).catch((error) => {
      if (disposed) return
      setState({ agentItems: [], contextItems: [], promptPreview: null, isLoading: false, error: toErrorMessage(error) })
    })

    return () => {
      disposed = true
    }
  }, [sessionId])

  return state
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/hooks/useCoordinatorSidebarData.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/hooks/useCoordinatorSidebarData.ts tests/unit/renderer/hooks/useCoordinatorSidebarData.test.ts
git commit -m "feat: add coordinator sidebar data hook"
```

### Task 2: Add an inline action variant to `LeftSection`

**Files:**
- Modify: `src/renderer/components/left/LeftSection.tsx`
- Modify: `src/renderer/components/left/left-typography.ts`
- Test: `tests/unit/renderer/left/LeftSection.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders an inline text action when actionVariant is inline', () => {
  const onAddAction = vi.fn()

  render(
    <LeftSection
      title="Agents"
      description="Agents write code, maintain notes, and coordinate tasks."
      addActionLabel="Create new agent"
      actionVariant="inline"
      onAddAction={onAddAction}
    >
      <div>Body content</div>
    </LeftSection>
  )

  expect(screen.getByRole('button', { name: 'Create new agent' })).toHaveTextContent('+ Create new agent')
  expect(screen.queryByRole('button', { name: 'Add agent' })).toBeNull()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/left/LeftSection.test.tsx`
Expected: FAIL because `actionVariant` is not a valid prop and the inline action text does not exist.

**Step 3: Write minimal implementation**

```tsx
type LeftSectionProps = {
  // ...
  actionVariant?: 'icon' | 'inline'
}

const actionVariant = props.actionVariant ?? 'icon'

{actions ?? (
  actionVariant === 'inline' ? (
    <button
      type="button"
      className={LEFT_PANEL_TYPOGRAPHY.inlineAction}
      onClick={onAddAction}
      disabled={!onAddAction}
    >
      + {addActionLabel}
    </button>
  ) : (
    <Button /* existing icon button */ />
  )
)}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/left/LeftSection.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/left/LeftSection.tsx src/renderer/components/left/left-typography.ts tests/unit/renderer/left/LeftSection.test.tsx
git commit -m "feat: add inline left section actions"
```

### Task 3: Build the coordinator `Agents` surface

**Files:**
- Create: `src/renderer/components/left/CoordinatorAgentsSection.tsx`
- Create: `src/renderer/components/left/CoordinatorAgentListItem.tsx`
- Test: `tests/unit/renderer/left/CoordinatorAgentsSection.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders coordinator prompt preview with inline create action and no background summary in the simple case', () => {
  render(
    <CoordinatorAgentsSection
      agentItems={[coordinatorAgent]}
      promptPreview="I would like to build the following product..."
      isLoading={false}
      error={null}
    />
  )

  expect(screen.getByRole('heading', { name: 'Agents' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Create new agent' })).toHaveTextContent('+ Create new agent')
  expect(screen.getByText('Coordinator')).toBeTruthy()
  expect(screen.getByText('I would like to build the following product...')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /background agents running/i })).toBeNull()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/left/CoordinatorAgentsSection.test.tsx`
Expected: FAIL because the component file does not exist.

**Step 3: Write minimal implementation**

```tsx
export function CoordinatorAgentsSection(props: CoordinatorAgentsSectionProps) {
  return (
    <LeftSection
      title="Agents"
      description="Agents write code, maintain notes, and coordinate tasks."
      addActionLabel="Create new agent"
      actionVariant="inline"
    >
      {props.agentItems.map((agent) => (
        <CoordinatorAgentListItem
          key={agent.id}
          name={agent.name}
          status={agent.status}
          subtitle={agent.kind === 'coordinator' ? props.promptPreview ?? agent.currentTask ?? '' : agent.currentTask ?? agent.role}
        />
      ))}
    </LeftSection>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/left/CoordinatorAgentsSection.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/left/CoordinatorAgentsSection.tsx src/renderer/components/left/CoordinatorAgentListItem.tsx tests/unit/renderer/left/CoordinatorAgentsSection.test.tsx
git commit -m "feat: add coordinator agents sidebar surface"
```

### Task 4: Build the coordinator `Context` surface

**Files:**
- Create: `src/renderer/components/left/CoordinatorContextSection.tsx`
- Test: `tests/unit/renderer/left/CoordinatorContextSection.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders selector-backed context resources with spec-first ordering and coordinator copy', () => {
  render(
    <CoordinatorContextSection
      contextItems={[
        { id: 'spec', kind: 'spec', label: 'Spec', sortOrder: 0, createdAt: '', updatedAt: '' },
        { id: 'note-1', kind: 'note', label: 'Team Brainstorm', sortOrder: 1, createdAt: '', updatedAt: '' }
      ]}
      isLoading={false}
      error={null}
    />
  )

  expect(screen.getByRole('heading', { name: 'Context' })).toBeTruthy()
  expect(screen.getByText('Context about the task, shared with all agents on demand.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add context' })).toHaveTextContent('+ Add context')
  expect(screen.getByText('Spec')).toBeTruthy()
  expect(screen.getByText('Team Brainstorm')).toBeTruthy()
  expect(screen.queryByText('./notes')).toBeNull()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/left/CoordinatorContextSection.test.tsx`
Expected: FAIL because the component file does not exist.

**Step 3: Write minimal implementation**

```tsx
export function CoordinatorContextSection(props: CoordinatorContextSectionProps) {
  return (
    <LeftSection
      title="Context"
      description="Context about the task, shared with all agents on demand. Your notes live in /following.build/.workspace."
      addActionLabel="Add context"
      actionVariant="inline"
    >
      <div className="space-y-2">
        {props.contextItems.map((item) => (
          <button key={item.id} type="button" className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </LeftSection>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/left/CoordinatorContextSection.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/left/CoordinatorContextSection.tsx tests/unit/renderer/left/CoordinatorContextSection.test.tsx
git commit -m "feat: add coordinator context sidebar surface"
```

### Task 5: Wire coordinator mode into `LeftPanel` and `AppShell`

**Files:**
- Create: `src/renderer/components/left/left-panel-mode.ts`
- Test: `tests/unit/renderer/left/left-panel-mode.test.ts`
- Modify: `src/renderer/components/layout/LeftPanel.tsx`
- Modify: `src/renderer/components/layout/AppShell.tsx`
- Modify: `tests/unit/renderer/left/LeftPanel.test.tsx`
- Modify: `tests/unit/renderer/AppShell.test.tsx`

**Step 1: Write the failing tests**

```ts
it('resolves coordinator mode when no task activity snapshot is present', () => {
  expect(resolveLeftPanelMode({ taskActivitySnapshot: undefined })).toBe('coordinator')
})

it('hides the left status section and renders the coordinator agents surface in coordinator mode', () => {
  render(<LeftPanel activeSpaceId="space-1" activeSessionId="session-1" taskActivitySnapshot={undefined} />)

  expect(screen.queryByLabelText('Left panel status')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Agents' })).toBeTruthy()
})

it('uses the coordinator left-width preset when task activity is absent', () => {
  render(<AppShell />)
  const columns = parseShellColumns(screen.getByTestId('app-shell-grid').style.gridTemplateColumns)
  expect(columns.left).toBe(248)
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/left/left-panel-mode.test.ts tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/AppShell.test.tsx`
Expected: FAIL because the mode resolver does not exist, `LeftStatusSection` is still always rendered, and the left-column width is still `390`.

**Step 3: Write minimal implementation**

```ts
export type LeftPanelMode = 'coordinator' | 'build'

export function resolveLeftPanelMode(input: { taskActivitySnapshot?: TaskActivitySnapshot }): LeftPanelMode {
  return input.taskActivitySnapshot ? 'build' : 'coordinator'
}
```

```tsx
const panelMode = resolveLeftPanelMode({ taskActivitySnapshot })
const leftDefault = panelMode === 'coordinator' ? 248 : LEFT_DEFAULT

{panelMode === 'build' ? (
  <LeftStatusSection /* existing props */ />
) : null}

{activeTab === 'agents' ? (
  panelMode === 'coordinator' ? (
    <CoordinatorAgentsSection
      agentItems={coordinatorSidebar.agentItems}
      promptPreview={coordinatorSidebar.promptPreview}
      isLoading={coordinatorSidebar.isLoading}
      error={coordinatorSidebar.error}
    />
  ) : (
    <AgentsTab agents={agents} isLoading={isAgentsLoading} error={agentsError} />
  )
) : null}

{activeTab === 'context' ? (
  panelMode === 'coordinator' ? (
    <CoordinatorContextSection
      contextItems={coordinatorSidebar.contextItems}
      isLoading={coordinatorSidebar.isLoading}
      error={coordinatorSidebar.error}
    />
  ) : (
    <ContextTab project={project} previewState={previewState} />
  )
) : null}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/renderer/left/left-panel-mode.test.ts tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/AppShell.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/left/left-panel-mode.ts src/renderer/components/layout/LeftPanel.tsx src/renderer/components/layout/AppShell.tsx tests/unit/renderer/left/left-panel-mode.test.ts tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/AppShell.test.tsx
git commit -m "feat: wire coordinator left panel mode"
```

### Task 6: Update E2E coverage for the coordinator sidebar

**Files:**
- Create: `tests/e2e/kat-170-sidebar-sectionsnav.spec.ts`
- Modify: `tests/e2e/navigation.spec.ts`

**Step 1: Write the failing E2E spec**

```ts
test.describe('KAT-170: coordinator sidebar behavior @ci', () => {
  test('renders agents by default, switches to context, and restores from collapse', async ({ appWindow }) => {
    await ensureWorkspaceShell(appWindow)

    await expect(appWindow.getByRole('heading', { name: 'Agents' })).toBeVisible()
    await expect(appWindow.getByLabel('Left panel status')).toHaveCount(0)
    await expect(appWindow.getByText('Coordinator')).toBeVisible()

    await appWindow.getByRole('tab', { name: 'Context' }).click()
    await expect(appWindow.getByRole('heading', { name: 'Context' })).toBeVisible()
    await expect(appWindow.getByText('Spec')).toBeVisible()

    await appWindow.getByRole('button', { name: 'Collapse sidebar navigation' }).click()
    await expect(appWindow.getByRole('button', { name: 'Expand sidebar navigation' })).toBeVisible()
    await appWindow.getByRole('button', { name: 'Expand sidebar navigation' }).click()
    await expect(appWindow.getByRole('heading', { name: 'Context' })).toBeVisible()
  })
})
```

**Step 2: Run E2E to verify it fails**

Run: `npx playwright test tests/e2e/kat-170-sidebar-sectionsnav.spec.ts tests/e2e/navigation.spec.ts`
Expected: FAIL because the new spec file is missing and `navigation.spec.ts` still expects the old context/status behavior.

**Step 3: Write minimal implementation**

```ts
// navigation.spec.ts
await leftTabs.getByRole('tab', { name: /Agents/ }).click()
await expect(appWindow.getByRole('heading', { name: 'Agents' })).toBeVisible()
await expect(appWindow.getByLabel('Left panel status')).toHaveCount(0)

await leftTabs.getByRole('tab', { name: /Context/ }).click()
await expect(appWindow.getByRole('heading', { name: 'Context' })).toBeVisible()
await expect(appWindow.getByText('Spec')).toBeVisible()
await expect(appWindow.getByText('./notes')).toHaveCount(0)
```

**Step 4: Run E2E to verify it passes**

Run: `npx playwright test tests/e2e/kat-170-sidebar-sectionsnav.spec.ts tests/e2e/navigation.spec.ts`
Expected: PASS for all targeted specs.

**Step 5: Commit**

```bash
git add tests/e2e/kat-170-sidebar-sectionsnav.spec.ts tests/e2e/navigation.spec.ts
git commit -m "test: cover coordinator sidebar behavior"
```

### Task 7: Final ticket verification

**Files:**
- Modify: none
- Test: existing affected unit and E2E files only

**Step 1: Run the affected unit suite**

```bash
npx vitest run \
  tests/unit/renderer/hooks/useCoordinatorSidebarData.test.ts \
  tests/unit/renderer/left/LeftSection.test.tsx \
  tests/unit/renderer/left/CoordinatorAgentsSection.test.tsx \
  tests/unit/renderer/left/CoordinatorContextSection.test.tsx \
  tests/unit/renderer/left/left-panel-mode.test.ts \
  tests/unit/renderer/left/LeftPanel.test.tsx \
  tests/unit/renderer/AppShell.test.tsx
```

Expected: PASS.

**Step 2: Run the targeted E2E suite**

```bash
npx playwright test tests/e2e/kat-170-sidebar-sectionsnav.spec.ts tests/e2e/navigation.spec.ts
```

Expected: PASS.

**Step 3: Run lint**

```bash
npm run lint
```

Expected: PASS with no TypeScript errors.

**Step 4: Capture evidence**

Run:

```bash
npx playwright test tests/e2e/kat-170-sidebar-sectionsnav.spec.ts --headed
```

Expected: screenshot/video artifacts under `test-results/` showing:
- `Agents` as the default coordinator surface
- `Context` showing `Spec`
- collapse/expand restore behavior

**Step 5: Commit final verification note if needed**

```bash
git status
```

Expected: clean working tree. If any evidence-path updates or test harness changes are still unstaged, stage them and create a final commit:

```bash
git add -A
git commit -m "chore: finalize kat-170 verification"
```
