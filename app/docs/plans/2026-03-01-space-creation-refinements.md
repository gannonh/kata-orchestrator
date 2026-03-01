# Space Creation Refinements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the space creation flows with progressive disclosure (browse-first UX), nanoid auto-naming, branch pickers, and proper repo grouping in the spaces list.

**Architecture:** Replace the current 4-step flat form with a 3-step progressive disclosure pattern. Shared `RepoPathPicker` and `GitHubRepoPicker` components handle the browse→validate→branch-pick pattern. Auto-naming replaces manual input using `{repoLabel}-{nanoid(4)}`. New IPC channels connect the renderer to Electron's native file dialog, git branch listing, and GitHub CLI.

**Tech Stack:** React 19, TypeScript, Electron 40, Vitest, Testing Library, Tailwind CSS, `node:crypto` for nanoid-equivalent

**Design doc:** `app/docs/plans/2026-03-01-space-creation-refinements-design.md`

---

### Task 1: Auto-naming algorithm

Replace the branch-based naming in `space-name.ts` with nanoid-style: `{repoLabel}-{shortId}`.

**Files:**
- Modify: `app/src/shared/space-name.ts`
- Test: `app/tests/unit/shared/space-name.test.ts`

**Step 1: Write the failing tests**

Add these tests to `app/tests/unit/shared/space-name.test.ts`:

```ts
import { generateShortId, resolveSpaceName } from '../../../src/shared/space-name'

describe('generateShortId', () => {
  it('returns a 4-character lowercase alphanumeric string', () => {
    const id = generateShortId()
    expect(id).toMatch(/^[a-z0-9]{4}$/)
  })

  it('produces different values on successive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateShortId()))
    expect(ids.size).toBeGreaterThan(1)
  })
})

describe('resolveSpaceName (nanoid)', () => {
  it('generates repoLabel-shortId format', () => {
    const name = resolveSpaceName({ repoLabel: 'kata-cloud', existingNames: new Set() })
    expect(name).toMatch(/^kata-cloud-[a-z0-9]{4}$/)
  })

  it('retries on collision', () => {
    // Pre-fill existingNames with many possible 4-char combos to force retry
    const name = resolveSpaceName({ repoLabel: 'repo', existingNames: new Set() })
    expect(name).toMatch(/^repo-[a-z0-9]{4}$/)
  })

  it('uses safe repo label for blank input', () => {
    const name = resolveSpaceName({ repoLabel: '  ', existingNames: new Set() })
    expect(name).toMatch(/^repo-[a-z0-9]{4}$/)
  })
})
```

Remove the old tests for `deriveDefaultSpaceName` and the old `resolveSpaceName` signature.

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/shared/space-name.test.ts`
Expected: FAIL — `generateShortId` not exported, `resolveSpaceName` signature mismatch

**Step 3: Implement the new naming functions**

Replace `app/src/shared/space-name.ts` contents with:

```ts
import { randomBytes } from 'node:crypto'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function generateShortId(length = 4): string {
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return result
}

export function resolveSpaceName(input: {
  repoLabel: string
  existingNames: Set<string>
}): string {
  const safeRepo = input.repoLabel.trim() || 'repo'
  const maxAttempts = 10

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = `${safeRepo}-${generateShortId(4)}`
    if (!input.existingNames.has(candidate)) {
      return candidate
    }
  }

  // Fallback: 6-char id on repeated collisions
  return `${safeRepo}-${generateShortId(6)}`
}
```

Note: `node:crypto` works in both main process and renderer (Electron exposes it). If renderer-only usage is needed later, we can swap to `crypto.getRandomValues`.

**Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/unit/shared/space-name.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/src/shared/space-name.ts app/tests/unit/shared/space-name.test.ts
git commit -m "feat(KAT-156): replace branch-based space naming with nanoid-style"
```

---

### Task 2: Remove name/spaceNameOverride from CreateSpaceInput

Update the type system and IPC handler to stop accepting manual name overrides.

**Files:**
- Modify: `app/src/shared/types/space.ts:32-37`
- Modify: `app/src/main/ipc-handlers.ts:120-136,312-319`
- Test: `app/tests/unit/main/ipc-handlers.test.ts`

**Step 1: Write/update failing tests**

In `app/tests/unit/main/ipc-handlers.test.ts`, find the test that validates `space:create` name resolution. Update to expect the new nanoid format instead of `override` or `name`:

```ts
it('generates nanoid-style space name without override', async () => {
  const store = createMockStore()
  registerIpcHandlers(store)
  const handlers = getHandlersByChannel()
  const createHandler = handlers.get('space:create')!

  mockProvisionManagedWorkspace.mockResolvedValue({
    rootPath: '/mock/workspace/repo',
    cacheRepoPath: '/mock/cache',
    repoUrl: 'https://github.com/org/my-repo.git',
    branch: 'main'
  })

  const result = await createHandler(null, {
    repoUrl: 'https://github.com/org/my-repo.git',
    branch: 'main',
    workspaceMode: 'managed',
    provisioningMethod: 'copy-local',
    sourceLocalPath: '/Users/me/dev/my-repo'
  }) as { name: string }

  expect(result.name).toMatch(/^my-repo-[a-z0-9]{4}$/)
})
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/main/ipc-handlers.test.ts`
Expected: FAIL — name still uses old format

**Step 3: Update types and handler**

In `app/src/shared/types/space.ts`, remove `name`, `prompt`, and `spaceNameOverride` from `CreateSpaceInput`:

```ts
export type CreateSpaceInput = {
  repoUrl: string
  branch: string
  workspaceMode?: WorkspaceMode
  orchestrationMode?: OrchestrationMode
} & (
  // ... discriminated union stays the same
)
```

In `app/src/main/ipc-handlers.ts`:
- Remove lines 120-136 (the `optionalTextFieldNames` loop and `optionalTexts` object)
- Remove `...optionalTexts` from all return statements in `parseCreateSpaceInput`
- Update the `space:create` handler (lines 312-319) to call the new `resolveSpaceName`:

```ts
const existingNames = new Set(Object.values(state.spaces).map((space) => space.name))
const resolvedName = resolveSpaceName({
  repoLabel: deriveRepoLabel(parsedInput),
  existingNames
})
```

**Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/unit/main/ipc-handlers.test.ts`
Expected: PASS

**Step 5: Fix any downstream test breakages**

Run: `cd app && npx vitest run`

Tests in `HomeSpacesScreen.test.tsx` that pass `spaceNameOverride` or `name` in create payloads will fail. Update them to remove those fields and match the new nanoid name pattern. Specifically update:
- `submits developer-managed mode with explicit workspace path` — remove `spaceNameOverride` from expected payload
- `defaults space name to repo label only in UI` — this test asserts a Space name input exists; it needs to be removed or rewritten
- Any test using `screen.getByRole('textbox', { name: 'Space name' })` — this element no longer exists

**Step 6: Run full test suite**

Run: `cd app && npx vitest run`
Expected: PASS

**Step 7: Commit**

```bash
git add app/src/shared/types/space.ts app/src/main/ipc-handlers.ts app/tests/unit/main/ipc-handlers.test.ts app/tests/unit/renderer/home/HomeSpacesScreen.test.tsx
git commit -m "feat(KAT-156): remove manual space naming from types and IPC handler"
```

---

### Task 3: New IPC channels — dialog, git branches, GitHub

Add four new IPC channels: `dialog:openDirectory`, `git:listBranches`, `github:listRepos`, `github:listBranches`.

**Files:**
- Modify: `app/src/main/ipc-handlers.ts`
- Modify: `app/src/preload/index.ts`
- Test: `app/tests/unit/main/ipc-handlers.test.ts`

**Step 1: Write failing tests for new IPC channels**

Add to `app/tests/unit/main/ipc-handlers.test.ts`:

```ts
const { mockShowOpenDialog } = vi.hoisted(() => ({
  mockShowOpenDialog: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { removeHandler: mockRemoveHandler, handle: mockHandle },
  shell: { openExternal: mockOpenExternal },
  dialog: { showOpenDialog: mockShowOpenDialog }
}))

describe('dialog:openDirectory', () => {
  it('returns selected directory path', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/Users/me/dev/repo'] })
    registerIpcHandlers(createMockStore())
    const handlers = getHandlersByChannel()
    const handler = handlers.get('dialog:openDirectory')!
    const result = await handler(null)
    expect(result).toBe('/Users/me/dev/repo')
  })

  it('returns null when dialog is canceled', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    registerIpcHandlers(createMockStore())
    const handlers = getHandlersByChannel()
    const handler = handlers.get('dialog:openDirectory')!
    const result = await handler(null)
    expect(result).toBeNull()
  })
})

describe('git:listBranches', () => {
  it('returns branch names from git output', async () => {
    // Mock execFile to return branch list
    registerIpcHandlers(createMockStore())
    const handlers = getHandlersByChannel()
    const handler = handlers.get('git:listBranches')!
    // This test needs execFile mocking — see implementation step
    expect(handler).toBeDefined()
  })
})

describe('github:listRepos', () => {
  it('returns repos from gh CLI', async () => {
    registerIpcHandlers(createMockStore())
    const handlers = getHandlersByChannel()
    const handler = handlers.get('github:listRepos')!
    expect(handler).toBeDefined()
  })
})

describe('github:listBranches', () => {
  it('returns branches from gh api', async () => {
    registerIpcHandlers(createMockStore())
    const handlers = getHandlersByChannel()
    const handler = handlers.get('github:listBranches')!
    expect(handler).toBeDefined()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/main/ipc-handlers.test.ts`
Expected: FAIL — channels not registered

**Step 3: Implement new IPC handlers**

Add to `app/src/main/ipc-handlers.ts`:

```ts
import { dialog } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'

const execFileAsync = promisify(execFile)

const DIALOG_OPEN_DIR_CHANNEL = 'dialog:openDirectory'
const GIT_LIST_BRANCHES_CHANNEL = 'git:listBranches'
const GITHUB_LIST_REPOS_CHANNEL = 'github:listRepos'
const GITHUB_LIST_BRANCHES_CHANNEL = 'github:listBranches'
```

Inside `registerIpcHandlers()`:

```ts
ipcMain.removeHandler(DIALOG_OPEN_DIR_CHANNEL)
ipcMain.removeHandler(GIT_LIST_BRANCHES_CHANNEL)
ipcMain.removeHandler(GITHUB_LIST_REPOS_CHANNEL)
ipcMain.removeHandler(GITHUB_LIST_BRANCHES_CHANNEL)

ipcMain.handle(DIALOG_OPEN_DIR_CHANNEL, async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  const selectedPath = result.filePaths[0]
  // Validate .git exists
  try {
    await fs.promises.access(path.join(selectedPath, '.git'))
  } catch {
    return { error: 'Selected directory is not a git repository.', path: selectedPath }
  }
  return { path: selectedPath }
})

ipcMain.handle(GIT_LIST_BRANCHES_CHANNEL, async (_event, repoPath: unknown) => {
  if (typeof repoPath !== 'string') {
    throw new Error('repoPath must be a string')
  }
  try {
    const { stdout } = await execFileAsync('git', ['branch', '--list', '--format=%(refname:short)'], { cwd: repoPath })
    return stdout.trim().split('\n').filter(Boolean)
  } catch {
    return { error: 'Could not read branches.' }
  }
})

ipcMain.handle(GITHUB_LIST_REPOS_CHANNEL, async () => {
  try {
    const { stdout } = await execFileAsync('gh', [
      'repo', 'list', '--json', 'name,nameWithOwner,url', '--limit', '100'
    ])
    return JSON.parse(stdout)
  } catch {
    return { error: 'GitHub CLI not available. Install and authenticate with `gh auth login`.' }
  }
})

ipcMain.handle(GITHUB_LIST_BRANCHES_CHANNEL, async (_event, input: unknown) => {
  if (!isObjectRecord(input) || typeof input.owner !== 'string' || typeof input.repo !== 'string') {
    throw new Error('input must have string owner and repo fields')
  }
  try {
    const { stdout } = await execFileAsync('gh', [
      'api', `repos/${input.owner}/${input.repo}/branches`, '--jq', '.[].name'
    ])
    return stdout.trim().split('\n').filter(Boolean)
  } catch {
    return { error: 'Could not fetch branches from GitHub.' }
  }
})
```

**Step 4: Update preload bridge**

Add to `app/src/preload/index.ts`:

```ts
const DIALOG_OPEN_DIR_CHANNEL = 'dialog:openDirectory'
const GIT_LIST_BRANCHES_CHANNEL = 'git:listBranches'
const GITHUB_LIST_REPOS_CHANNEL = 'github:listRepos'
const GITHUB_LIST_BRANCHES_CHANNEL = 'github:listBranches'

// Add to kataApi object:
dialogOpenDirectory: (): Promise<{ path: string } | { error: string; path: string } | null> =>
  invokeTyped(DIALOG_OPEN_DIR_CHANNEL),
gitListBranches: (repoPath: string): Promise<string[] | { error: string }> =>
  invokeTyped(GIT_LIST_BRANCHES_CHANNEL, repoPath),
githubListRepos: (): Promise<Array<{ name: string; nameWithOwner: string; url: string }> | { error: string }> =>
  invokeTyped(GITHUB_LIST_REPOS_CHANNEL),
githubListBranches: (owner: string, repo: string): Promise<string[] | { error: string }> =>
  invokeTyped(GITHUB_LIST_BRANCHES_CHANNEL, { owner, repo }),
```

**Step 5: Run tests**

Run: `cd app && npx vitest run tests/unit/main/ipc-handlers.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add app/src/main/ipc-handlers.ts app/src/preload/index.ts app/tests/unit/main/ipc-handlers.test.ts
git commit -m "feat(KAT-156): add IPC channels for directory dialog, git branches, and GitHub repos"
```

---

### Task 4: RepoPathPicker component

New shared component for browse→validate→branch-pick pattern.

**Files:**
- Create: `app/src/renderer/components/home/RepoPathPicker.tsx`
- Test: `app/tests/unit/renderer/home/RepoPathPicker.test.tsx`

**Step 1: Write failing tests**

Create `app/tests/unit/renderer/home/RepoPathPicker.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RepoPathPicker } from '../../../../src/renderer/components/home/RepoPathPicker'

function baseProps() {
  return {
    path: '',
    onBrowse: vi.fn(),
    branches: [] as string[],
    selectedBranch: '',
    onBranchChange: vi.fn(),
    isLoadingBranches: false,
    error: null as string | null
  }
}

describe('RepoPathPicker', () => {
  afterEach(() => cleanup())

  it('renders browse button and empty path placeholder', () => {
    render(<RepoPathPicker {...baseProps()} />)
    expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy()
    expect(screen.getByText(/select a directory/i)).toBeTruthy()
  })

  it('shows selected path as read-only text', () => {
    render(<RepoPathPicker {...baseProps()} path="/Users/me/dev/repo" />)
    expect(screen.getByText('/Users/me/dev/repo')).toBeTruthy()
  })

  it('calls onBrowse when browse button is clicked', () => {
    const props = baseProps()
    render(<RepoPathPicker {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))
    expect(props.onBrowse).toHaveBeenCalledTimes(1)
  })

  it('shows branch picker when branches are available', () => {
    render(<RepoPathPicker {...baseProps()} path="/repo" branches={['main', 'develop', 'feature/ui']} selectedBranch="main" />)
    expect(screen.getByRole('combobox', { name: /branch/i })).toBeTruthy()
  })

  it('hides branch picker when no path is selected', () => {
    render(<RepoPathPicker {...baseProps()} branches={['main']} />)
    expect(screen.queryByRole('combobox', { name: /branch/i })).toBeNull()
  })

  it('shows loading state for branches', () => {
    render(<RepoPathPicker {...baseProps()} path="/repo" isLoadingBranches={true} />)
    expect(screen.getByText(/loading branches/i)).toBeTruthy()
  })

  it('shows error message', () => {
    render(<RepoPathPicker {...baseProps()} error="Selected directory is not a git repository." />)
    expect(screen.getByText('Selected directory is not a git repository.')).toBeTruthy()
  })

  it('calls onBranchChange when branch is selected', () => {
    const props = baseProps()
    render(<RepoPathPicker {...props} path="/repo" branches={['main', 'develop']} selectedBranch="main" />)
    fireEvent.change(screen.getByRole('combobox', { name: /branch/i }), { target: { value: 'develop' } })
    expect(props.onBranchChange).toHaveBeenCalledWith('develop')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/renderer/home/RepoPathPicker.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement RepoPathPicker**

Create `app/src/renderer/components/home/RepoPathPicker.tsx`:

```tsx
type RepoPathPickerProps = {
  path: string
  onBrowse: () => void
  branches: string[]
  selectedBranch: string
  onBranchChange: (branch: string) => void
  isLoadingBranches: boolean
  error: string | null
}

export function RepoPathPicker({
  path,
  onBrowse,
  branches,
  selectedBranch,
  onBranchChange,
  isLoadingBranches,
  error
}: RepoPathPickerProps) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 truncate rounded-md border border-border bg-background/70 px-2 py-1.5 text-xs text-muted-foreground">
          {path || 'Select a directory...'}
        </div>
        <button
          type="button"
          aria-label="Browse"
          onClick={onBrowse}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
        >
          Browse
        </button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {path && !error && isLoadingBranches && (
        <p className="text-xs text-muted-foreground">Loading branches...</p>
      )}

      {path && !error && !isLoadingBranches && branches.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-foreground" htmlFor="branch-picker">
            Branch
          </label>
          <select
            id="branch-picker"
            aria-label="Branch"
            value={selectedBranch}
            onChange={(e) => onBranchChange(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
          >
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      )}

      {path && !error && !isLoadingBranches && branches.length === 0 && (
        <p className="text-xs text-muted-foreground">No branches found. Defaulting to main.</p>
      )}
    </div>
  )
}
```

**Step 4: Run tests**

Run: `cd app && npx vitest run tests/unit/renderer/home/RepoPathPicker.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/src/renderer/components/home/RepoPathPicker.tsx app/tests/unit/renderer/home/RepoPathPicker.test.tsx
git commit -m "feat(KAT-156): add RepoPathPicker component with browse and branch picker"
```

---

### Task 5: GitHubRepoPicker component

Searchable combobox for GitHub repos with branch picker.

**Files:**
- Create: `app/src/renderer/components/home/GitHubRepoPicker.tsx`
- Test: `app/tests/unit/renderer/home/GitHubRepoPicker.test.tsx`

**Step 1: Write failing tests**

Create `app/tests/unit/renderer/home/GitHubRepoPicker.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GitHubRepoPicker } from '../../../../src/renderer/components/home/GitHubRepoPicker'

type Repo = { name: string; nameWithOwner: string; url: string }

const sampleRepos: Repo[] = [
  { name: 'kata-cloud', nameWithOwner: 'gannonh/kata-cloud', url: 'https://github.com/gannonh/kata-cloud' },
  { name: 'kata-tui', nameWithOwner: 'gannonh/kata-tui', url: 'https://github.com/gannonh/kata-tui' },
  { name: 'other-project', nameWithOwner: 'gannonh/other-project', url: 'https://github.com/gannonh/other-project' }
]

function baseProps() {
  return {
    repos: sampleRepos,
    selectedRepo: null as Repo | null,
    onRepoSelect: vi.fn(),
    isLoadingRepos: false,
    searchQuery: '',
    onSearchChange: vi.fn(),
    branches: [] as string[],
    selectedBranch: '',
    onBranchChange: vi.fn(),
    isLoadingBranches: false,
    error: null as string | null,
    onFallbackUrlChange: vi.fn(),
    showFallbackUrl: false
  }
}

describe('GitHubRepoPicker', () => {
  afterEach(() => cleanup())

  it('renders search input and repo list', () => {
    render(<GitHubRepoPicker {...baseProps()} />)
    expect(screen.getByRole('textbox', { name: /search/i })).toBeTruthy()
    expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    expect(screen.getByText('gannonh/kata-tui')).toBeTruthy()
  })

  it('shows loading state when repos are loading', () => {
    render(<GitHubRepoPicker {...baseProps()} isLoadingRepos={true} repos={[]} />)
    expect(screen.getByText(/loading repos/i)).toBeTruthy()
  })

  it('shows error with fallback URL input', () => {
    render(<GitHubRepoPicker {...baseProps()} error="GitHub CLI not available." showFallbackUrl={true} />)
    expect(screen.getByText('GitHub CLI not available.')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /url/i })).toBeTruthy()
  })

  it('filters repos by search query', () => {
    render(<GitHubRepoPicker {...baseProps()} searchQuery="kata" />)
    expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    expect(screen.getByText('gannonh/kata-tui')).toBeTruthy()
    expect(screen.queryByText('gannonh/other-project')).toBeNull()
  })

  it('shows branch picker after repo selection', () => {
    render(<GitHubRepoPicker {...baseProps()} selectedRepo={sampleRepos[0]} branches={['main', 'develop']} selectedBranch="main" />)
    expect(screen.getByRole('combobox', { name: /branch/i })).toBeTruthy()
  })

  it('calls onRepoSelect when a repo is clicked', () => {
    const props = baseProps()
    render(<GitHubRepoPicker {...props} />)
    fireEvent.click(screen.getByText('gannonh/kata-cloud'))
    expect(props.onRepoSelect).toHaveBeenCalledWith(sampleRepos[0])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/renderer/home/GitHubRepoPicker.test.tsx`
Expected: FAIL

**Step 3: Implement GitHubRepoPicker**

Create `app/src/renderer/components/home/GitHubRepoPicker.tsx`. Use a simple filtered list with a text input for search (not cmdk — keep it lightweight). Show branch picker as a `<select>` when a repo is selected, same pattern as `RepoPathPicker`.

Key details:
- Filter repos client-side: `repos.filter(r => r.nameWithOwner.toLowerCase().includes(query))`
- Repo list: scrollable `max-h-40 overflow-y-auto` list of clickable buttons
- Selected repo: highlighted with `aria-pressed`
- After selection: branch picker appears (same `<select>` pattern)
- Error state: show error text + "Or paste URL" link that reveals a text input

**Step 4: Run tests**

Run: `cd app && npx vitest run tests/unit/renderer/home/GitHubRepoPicker.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/src/renderer/components/home/GitHubRepoPicker.tsx app/tests/unit/renderer/home/GitHubRepoPicker.test.tsx
git commit -m "feat(KAT-156): add GitHubRepoPicker component with search and branch selection"
```

---

### Task 6: Refactor CreateSpacePanel to 3-step progressive disclosure

Replace the current 4-step form with the new 3-step structure. Integrate `RepoPathPicker` and `GitHubRepoPicker`. Remove Step 3 (space name). Relabel "Create new repo" fields.

**Files:**
- Modify: `app/src/renderer/components/home/CreateSpacePanel.tsx`
- Modify: `app/tests/unit/renderer/home/CreateSpacePanel.test.tsx`

**Step 1: Update tests for new structure**

Rewrite `app/tests/unit/renderer/home/CreateSpacePanel.test.tsx` to:
- Assert 3 steps: "Step 1 · Where work happens", "Step 2 · Source setup", "Step 3 · Review and create"
- Assert NO "Step 3 · Space name" or "Step 4"
- Assert NO `textbox` with name "Space name"
- Assert `RepoPathPicker` renders for copy-local and external modes (browse button present)
- Assert `GitHubRepoPicker` renders for clone-github mode (search input present)
- Assert new repo labels: "New repo parent directory" and "New repo name"
- Assert `autoGeneratedName` appears as read-only text in the review step

Update `createBaseProps()` to match the new prop interface:
```ts
function createBaseProps() {
  return {
    workspaceMode: 'managed' as const,
    provisioningMethod: 'copy-local' as const,
    // RepoPathPicker props (for copy-local and external)
    repoPath: '/Users/me/dev/kata-cloud',
    branches: ['main', 'develop'],
    selectedBranch: 'main',
    onBrowse: vi.fn(),
    onBranchChange: vi.fn(),
    isLoadingBranches: false,
    repoPathError: null as string | null,
    // GitHubRepoPicker props (for clone-github)
    githubRepos: [],
    selectedGithubRepo: null,
    onGithubRepoSelect: vi.fn(),
    isLoadingGithubRepos: false,
    githubSearchQuery: '',
    onGithubSearchChange: vi.fn(),
    githubBranches: [],
    selectedGithubBranch: '',
    onGithubBranchChange: vi.fn(),
    isLoadingGithubBranches: false,
    githubError: null as string | null,
    showGithubFallbackUrl: false,
    onGithubFallbackUrlChange: vi.fn(),
    // New repo props
    newRepoParentDir: '/Users/me/dev',
    newRepoFolderName: '',
    onNewRepoParentDirChange: vi.fn(),
    onNewRepoFolderNameChange: vi.fn(),
    // Review/create props
    autoGeneratedName: 'kata-cloud-x7k2',
    createError: null as string | null,
    canCreate: true,
    isCreating: false,
    summaryLines: ['Editable files: ~/.kata/workspaces/<id>/repo'],
    onSelectWorkspaceMode: vi.fn(),
    onSelectProvisioningMethod: vi.fn(),
    onCreateSpace: vi.fn()
  }
}
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/renderer/home/CreateSpacePanel.test.tsx`
Expected: FAIL

**Step 3: Rewrite CreateSpacePanel**

Rewrite `app/src/renderer/components/home/CreateSpacePanel.tsx`:
- Step 1: unchanged (workspace mode buttons)
- Step 2: conditional rendering based on mode/method:
  - `copy-local` or `external`: render `<RepoPathPicker>`
  - `clone-github`: render `<GitHubRepoPicker>`
  - `new-repo`: two inputs with labels "New repo parent directory" and "New repo name"
- Step 3 (was Step 4): review + create. Show `autoGeneratedName` as: `<p>Space: {autoGeneratedName}</p>`. Show summaryLines, createError, Create button.
- Remove: old Step 3 (Space name input), old `onSpaceNameChange` prop, `spaceName` prop
- Remove: old text inputs for Local repo path, Remote repo URL, Branch, Workspace path (replaced by picker components)

**Step 4: Run tests**

Run: `cd app && npx vitest run tests/unit/renderer/home/CreateSpacePanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/src/renderer/components/home/CreateSpacePanel.tsx app/tests/unit/renderer/home/CreateSpacePanel.test.tsx
git commit -m "feat(KAT-156): refactor CreateSpacePanel to 3-step progressive disclosure"
```

---

### Task 7: Refactor HomeSpacesScreen for new IPC wiring

Update the orchestrator component to manage new state (branches, repos, browse dialog) and wire up IPC calls.

**Files:**
- Modify: `app/src/renderer/components/home/HomeSpacesScreen.tsx`
- Modify: `app/tests/unit/renderer/home/HomeSpacesScreen.test.tsx`

**Step 1: Update tests**

Rewrite `HomeSpacesScreen.test.tsx` to:
- Mock `window.kata.dialogOpenDirectory`, `window.kata.gitListBranches`, `window.kata.githubListRepos`, `window.kata.githubListBranches` alongside existing mocks
- Test: clicking Browse triggers `dialogOpenDirectory`, valid path triggers `gitListBranches`, branches populate the picker
- Test: selecting clone-github triggers `githubListRepos` on mount, selecting a repo triggers `githubListBranches`
- Test: create payload no longer includes `name` or `spaceNameOverride`
- Test: auto-generated name preview appears in review step
- Remove: all tests that interact with "Space name" textbox

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/renderer/home/HomeSpacesScreen.test.tsx`
Expected: FAIL

**Step 3: Rewrite HomeSpacesScreen**

Key changes:
- Remove: `spaceNameOverride`, `setSpaceNameOverride` state
- Remove: `sourceLocalPath`, `sourceRemoteUrl`, `sourceBranch`, `workspacePath` text input state
- Add: `repoPath` (string), `branches` (string[]), `selectedBranch` (string), `isLoadingBranches` (boolean), `repoPathError` (string|null)
- Add: `githubRepos`, `selectedGithubRepo`, `githubSearchQuery`, `githubBranches`, `selectedGithubBranch`, `isLoadingGithubRepos`, `isLoadingGithubBranches`, `githubError`, `showGithubFallbackUrl`
- Add: `autoGeneratedName` derived from `resolveSpaceName` preview (just `{repoLabel}-preview` for display; actual name generated server-side)
- `handleBrowse`: calls `window.kata.dialogOpenDirectory()`, validates result, sets `repoPath`, triggers `gitListBranches`
- `handleBrowseResult`: if valid path, call `window.kata.gitListBranches(path)`, set branches + select first
- `handleGithubRepoSelect`: call `window.kata.githubListBranches(owner, repo)`, set branches
- `useEffect` on mount when `provisioningMethod === 'clone-github'`: call `window.kata.githubListRepos()`
- `handleCreateSpace`: build `CreateSpaceInput` from new state (no `name`, no `spaceNameOverride`)
- Pass new props to `CreateSpacePanel`

**Step 4: Run tests**

Run: `cd app && npx vitest run tests/unit/renderer/home/HomeSpacesScreen.test.tsx`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd app && npx vitest run`
Expected: PASS

**Step 6: Commit**

```bash
git add app/src/renderer/components/home/HomeSpacesScreen.tsx app/tests/unit/renderer/home/HomeSpacesScreen.test.tsx
git commit -m "feat(KAT-156): wire HomeSpacesScreen to new IPC channels and progressive disclosure"
```

---

### Task 8: Fix SpacesListPanel visual hierarchy

Make repo group headers visually distinct from space items.

**Files:**
- Modify: `app/src/renderer/components/home/SpacesListPanel.tsx`
- Modify: `app/tests/unit/renderer/home/SpacesListPanel.test.tsx` (create if not exists)

**Step 1: Write failing test**

Create or update `app/tests/unit/renderer/home/SpacesListPanel.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SpacesListPanel } from '../../../../src/renderer/components/home/SpacesListPanel'

describe('SpacesListPanel repo grouping', () => {
  afterEach(() => cleanup())

  it('renders repo group headers as h3 headings distinct from space items', () => {
    render(<SpacesListPanel
      groups={[
        { repo: 'gannonh/kata-cloud', spaces: [
          { id: '1', name: 'kata-cloud-x7k2', repoUrl: '', rootPath: '', branch: 'main', orchestrationMode: 'team', createdAt: '', status: 'active', repo: 'gannonh/kata-cloud', elapsed: '', archived: false },
          { id: '2', name: 'kata-cloud-m3p9', repoUrl: '', rootPath: '', branch: 'develop', orchestrationMode: 'team', createdAt: '', status: 'idle', repo: 'gannonh/kata-cloud', elapsed: '', archived: false }
        ]},
        { repo: 'gannonh/kata-tui', spaces: [
          { id: '3', name: 'kata-tui-j4n1', repoUrl: '', rootPath: '', branch: 'main', orchestrationMode: 'single', createdAt: '', status: 'active', repo: 'gannonh/kata-tui', elapsed: '', archived: false }
        ]}
      ]}
      selectedSpaceId="1"
      searchQuery=""
      groupByRepo={true}
      showArchived={false}
      onSearchChange={() => {}}
      onToggleGroupByRepo={() => {}}
      onToggleShowArchived={() => {}}
      onSelectSpace={() => {}}
    />)

    // Repo headers should be h3 elements
    const headers = screen.getAllByRole('heading', { level: 3 })
    expect(headers.length).toBe(2)
    expect(headers[0].textContent).toBe('gannonh/kata-cloud')
    expect(headers[1].textContent).toBe('gannonh/kata-tui')

    // Space items should be listed below their headers
    expect(screen.getByText('kata-cloud-x7k2')).toBeTruthy()
    expect(screen.getByText('kata-cloud-m3p9')).toBeTruthy()
    expect(screen.getByText('kata-tui-j4n1')).toBeTruthy()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/renderer/home/SpacesListPanel.test.tsx`
Expected: FAIL — repo headers are `<p>` not `<h3>`

**Step 3: Update SpacesListPanel**

In `app/src/renderer/components/home/SpacesListPanel.tsx`, change the repo header from `<p>` to `<h3>` with stronger visual treatment:

```tsx
// Replace line 106:
// <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.repo}</p>
// With:
<h3 className="text-sm font-semibold text-foreground">{group.repo}</h3>
```

Also increase spacing between groups (change `space-y-4` to `space-y-6` on the outer div) and add a subtle top border on groups after the first:

```tsx
<div key={group.repo} className={groupIndex > 0 ? 'border-t border-border/50 pt-4' : ''}>
```

**Step 4: Run tests**

Run: `cd app && npx vitest run tests/unit/renderer/home/SpacesListPanel.test.tsx`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd app && npx vitest run`
Expected: PASS

**Step 6: Commit**

```bash
git add app/src/renderer/components/home/SpacesListPanel.tsx app/tests/unit/renderer/home/SpacesListPanel.test.tsx
git commit -m "feat(KAT-156): improve SpacesListPanel repo group header visual hierarchy"
```

---

### Task 9: Integration test and visual verification

Run the full test suite, start the dev server, and visually verify the changes.

**Files:** None (verification only)

**Step 1: Run full unit test suite**

Run: `cd app && npx vitest run`
Expected: All tests PASS

**Step 2: Run lint**

Run: `cd app && npm run lint`
Expected: No errors

**Step 3: Start dev server and verify visually**

Run: `cd app && npm run dev:web`

Verify in browser at `http://localhost:5199`:
- Step 1 buttons work (managed/external toggle)
- Copy local: Browse button visible, clicking opens system dialog, branch picker appears after valid selection
- Clone GitHub: repo search works, branch picker appears after selection
- New repo: fields labeled "New repo parent directory" and "New repo name"
- External folder: Browse button + branch picker (same as copy-local)
- No "Space name" input anywhere
- Review step shows auto-generated name
- Right panel: repo names as visible section headers with spaces listed beneath

**Step 4: Commit any visual polish tweaks**

```bash
git add -u
git commit -m "fix(KAT-156): visual polish from integration testing"
```

**Step 5: Final full test run**

Run: `cd app && npm run lint && npx vitest run`
Expected: All PASS
