# Slice 0: Minimum Viable Space — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A user can create a space, see it persist across app restarts, and navigate into a coordinator session scoped to that space.

**Architecture:** Main process owns persistence (JSON file in Electron userData). Renderer communicates via IPC through the preload bridge. Shared types in `src/shared/` are importable by both main and renderer. Code-first Pencil design sync at the end.

**Tech Stack:** Electron IPC (`ipcMain.handle` / `ipcRenderer.invoke`), Vitest + Testing Library, TypeScript strict mode.

**Design doc:** `docs/plans/2026-02-25-slice-0-minimum-viable-space-design.md`

**Design workflow:** This is behavior-driven work. Follow the **code-first** Pencil design sync workflow from `app/AGENTS.md`:
1. Build the React component
2. Update or create the corresponding Pencil frame to reflect the shipped state
3. Keep Pencil as a living record, not a stale spec

---

### Task 1: Shared Types (SpaceRecord, SessionRecord, AppState)

**Files:**
- Create: `app/src/shared/types/space.ts`

**Step 1: Create the shared types file**

```typescript
// app/src/shared/types/space.ts

export type SpaceRecord = {
  id: string
  name: string
  repoUrl: string
  rootPath: string
  branch: string
  orchestrationMode: 'team' | 'single'
  createdAt: string
  status: 'active' | 'idle' | 'archived'
}

export type SessionRecord = {
  id: string
  spaceId: string
  label: string
  createdAt: string
}

export type CreateSpaceInput = {
  name: string
  repoUrl: string
  rootPath: string
  branch: string
  orchestrationMode: 'team' | 'single'
}

export type CreateSessionInput = {
  spaceId: string
  label: string
}

export type AppState = {
  spaces: Record<string, SpaceRecord>
  sessions: Record<string, SessionRecord>
  activeSpaceId: string | null
  activeSessionId: string | null
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors (pure types, no runtime code).

**Step 3: Commit**

```bash
git add app/src/shared/types/space.ts
git commit -m "feat(app): add shared SpaceRecord, SessionRecord, and AppState types"
```

---

### Task 2: State Store (Main Process Persistence)

**Files:**
- Create: `app/src/main/state-store.ts`
- Create: `app/tests/unit/main/state-store.test.ts`

**Step 1: Write the failing tests**

```typescript
// app/tests/unit/main/state-store.test.ts
// @vitest-environment node

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createStateStore } from '../../../src/main/state-store'

const TEST_DIR = path.join(__dirname, '__state-store-test-tmp__')
const STATE_FILE = path.join(TEST_DIR, 'app-state.json')

describe('StateStore', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('returns empty default state when file does not exist', () => {
    const store = createStateStore(STATE_FILE)
    const state = store.getState()

    expect(state.spaces).toEqual({})
    expect(state.sessions).toEqual({})
    expect(state.activeSpaceId).toBeNull()
    expect(state.activeSessionId).toBeNull()
  })

  it('loads existing state from disk', () => {
    writeFileSync(STATE_FILE, JSON.stringify({
      spaces: { 'abc': { id: 'abc', name: 'Test', repoUrl: 'https://github.com/test/repo', rootPath: '/tmp/repo', branch: 'main', orchestrationMode: 'team', createdAt: '2026-01-01T00:00:00.000Z', status: 'active' } },
      sessions: {},
      activeSpaceId: 'abc',
      activeSessionId: null
    }))

    const store = createStateStore(STATE_FILE)
    const state = store.getState()

    expect(state.spaces['abc']?.name).toBe('Test')
    expect(state.activeSpaceId).toBe('abc')
  })

  it('recovers from corrupt JSON by returning default state', () => {
    writeFileSync(STATE_FILE, '{ broken json !!!')

    const store = createStateStore(STATE_FILE)
    const state = store.getState()

    expect(state.spaces).toEqual({})
  })

  it('persists state to disk with atomic write', () => {
    const store = createStateStore(STATE_FILE)

    store.setState({
      spaces: { 'x': { id: 'x', name: 'Saved', repoUrl: '', rootPath: '', branch: 'main', orchestrationMode: 'single', createdAt: '2026-01-01T00:00:00.000Z', status: 'active' } },
      sessions: {},
      activeSpaceId: 'x',
      activeSessionId: null
    })

    expect(existsSync(STATE_FILE)).toBe(true)

    // Reload from a fresh store to verify persistence
    const store2 = createStateStore(STATE_FILE)
    expect(store2.getState().spaces['x']?.name).toBe('Saved')
  })

  it('does not leave temp files after successful write', () => {
    const store = createStateStore(STATE_FILE)

    store.setState({
      spaces: {},
      sessions: {},
      activeSpaceId: null,
      activeSessionId: null
    })

    const files = existsSync(STATE_FILE + '.tmp')
    expect(files).toBe(false)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/main/state-store.test.ts`
Expected: FAIL — `createStateStore` does not exist.

**Step 3: Implement the state store**

```typescript
// app/src/main/state-store.ts

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { AppState } from '../shared/types/space'

const DEFAULT_STATE: AppState = {
  spaces: {},
  sessions: {},
  activeSpaceId: null,
  activeSessionId: null
}

export type StateStore = {
  getState: () => AppState
  setState: (state: AppState) => void
}

export function createStateStore(filePath: string): StateStore {
  let state: AppState = loadState(filePath)

  return {
    getState: () => state,
    setState: (nextState: AppState) => {
      state = nextState
      saveState(filePath, nextState)
    }
  }
}

function loadState(filePath: string): AppState {
  if (!existsSync(filePath)) {
    return { ...DEFAULT_STATE }
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as AppState
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function saveState(filePath: string, state: AppState): void {
  const dir = path.dirname(filePath)
  mkdirSync(dir, { recursive: true })

  const tmpPath = filePath + '.tmp'
  writeFileSync(tmpPath, JSON.stringify(state, null, 2))
  renameSync(tmpPath, filePath)
}
```

**Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/unit/main/state-store.test.ts`
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add app/src/main/state-store.ts app/tests/unit/main/state-store.test.ts
git commit -m "feat(app): add state store with JSON file persistence and atomic writes"
```

---

### Task 3: Space and Session IPC Handlers

**Files:**
- Modify: `app/src/main/ipc-handlers.ts`
- Modify: `app/tests/unit/main/ipc-handlers.test.ts`

**Step 1: Write the failing tests**

Add these tests to the existing `ipc-handlers.test.ts`. The handlers need a `StateStore` dependency injected via `registerIpcHandlers(store)`.

```typescript
// Add to app/tests/unit/main/ipc-handlers.test.ts

// Add these to the vi.hoisted mock factory:
// mockRemoveHandler, mockHandle already exist

// Add new describe block after existing tests:

describe('space and session handlers', () => {
  let stateStore: {
    getState: ReturnType<typeof vi.fn>
    setState: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    stateStore = {
      getState: vi.fn().mockReturnValue({
        spaces: {},
        sessions: {},
        activeSpaceId: null,
        activeSessionId: null
      }),
      setState: vi.fn()
    }
  })

  function getHandler(channel: string) {
    registerIpcHandlers(stateStore as any)
    const call = mockHandle.mock.calls.find(
      ([ch]: [string]) => ch === channel
    )
    return call?.[1] as (event: unknown, args: unknown) => Promise<unknown>
  }

  it('registers all space and session channels', () => {
    registerIpcHandlers(stateStore as any)

    const channels = mockHandle.mock.calls.map(([ch]: [string]) => ch)
    expect(channels).toContain('space:create')
    expect(channels).toContain('space:list')
    expect(channels).toContain('space:get')
    expect(channels).toContain('session:create')
  })

  it('space:create returns a SpaceRecord with generated id and createdAt', async () => {
    const handler = getHandler('space:create')
    const result = await handler({}, {
      name: 'My Space',
      repoUrl: 'https://github.com/test/repo',
      rootPath: '/tmp/repo',
      branch: 'main',
      orchestrationMode: 'team'
    }) as Record<string, unknown>

    expect(result).toMatchObject({
      name: 'My Space',
      repoUrl: 'https://github.com/test/repo',
      rootPath: '/tmp/repo',
      branch: 'main',
      orchestrationMode: 'team',
      status: 'active'
    })
    expect(result.id).toBeTypeOf('string')
    expect((result.id as string).length).toBeGreaterThan(0)
    expect(result.createdAt).toBeTypeOf('string')
    expect(stateStore.setState).toHaveBeenCalledTimes(1)
  })

  it('space:create rejects missing required fields', async () => {
    const handler = getHandler('space:create')
    await expect(handler({}, { name: 'No repo' })).rejects.toThrow()
  })

  it('space:list returns all spaces as an array', async () => {
    stateStore.getState.mockReturnValue({
      spaces: {
        'a': { id: 'a', name: 'Space A', repoUrl: '', rootPath: '', branch: 'main', orchestrationMode: 'team', createdAt: '', status: 'active' },
        'b': { id: 'b', name: 'Space B', repoUrl: '', rootPath: '', branch: 'main', orchestrationMode: 'single', createdAt: '', status: 'idle' }
      },
      sessions: {},
      activeSpaceId: null,
      activeSessionId: null
    })

    const handler = getHandler('space:list')
    const result = await handler({}, undefined)

    expect(result).toHaveLength(2)
  })

  it('space:get returns the space or null', async () => {
    stateStore.getState.mockReturnValue({
      spaces: { 'a': { id: 'a', name: 'Found', repoUrl: '', rootPath: '', branch: 'main', orchestrationMode: 'team', createdAt: '', status: 'active' } },
      sessions: {},
      activeSpaceId: null,
      activeSessionId: null
    })

    const handler = getHandler('space:get')
    const found = await handler({}, { id: 'a' })
    expect((found as Record<string, unknown>).name).toBe('Found')

    const notFound = await handler({}, { id: 'missing' })
    expect(notFound).toBeNull()
  })

  it('session:create returns a SessionRecord linked to the space', async () => {
    stateStore.getState.mockReturnValue({
      spaces: { 's1': { id: 's1', name: 'Host', repoUrl: '', rootPath: '', branch: 'main', orchestrationMode: 'team', createdAt: '', status: 'active' } },
      sessions: {},
      activeSpaceId: null,
      activeSessionId: null
    })

    const handler = getHandler('session:create')
    const result = await handler({}, { spaceId: 's1', label: 'Coordinator' }) as Record<string, unknown>

    expect(result.spaceId).toBe('s1')
    expect(result.label).toBe('Coordinator')
    expect(result.id).toBeTypeOf('string')
    expect(stateStore.setState).toHaveBeenCalled()
  })

  it('session:create rejects if spaceId does not exist', async () => {
    const handler = getHandler('session:create')
    await expect(handler({}, { spaceId: 'nonexistent', label: 'Test' })).rejects.toThrow()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/main/ipc-handlers.test.ts`
Expected: FAIL — `registerIpcHandlers` does not accept a store argument, channels not registered.

**Step 3: Implement the handlers**

Modify `app/src/main/ipc-handlers.ts`:

```typescript
// app/src/main/ipc-handlers.ts

import { randomUUID } from 'node:crypto'

import { ipcMain, shell } from 'electron'

import type { AppState, CreateSessionInput, CreateSpaceInput, SessionRecord, SpaceRecord } from '../shared/types/space'
import type { StateStore } from './state-store'

const OPEN_EXTERNAL_URL_CHANNEL = 'kata:openExternalUrl'
const SPACE_CREATE_CHANNEL = 'space:create'
const SPACE_LIST_CHANNEL = 'space:list'
const SPACE_GET_CHANNEL = 'space:get'
const SESSION_CREATE_CHANNEL = 'session:create'

function isExternalHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string') {
    return false
  }

  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

function isValidCreateSpaceInput(input: unknown): input is CreateSpaceInput {
  if (typeof input !== 'object' || input === null) return false
  const obj = input as Record<string, unknown>
  return (
    typeof obj.name === 'string' &&
    typeof obj.repoUrl === 'string' &&
    typeof obj.rootPath === 'string' &&
    typeof obj.branch === 'string' &&
    (obj.orchestrationMode === 'team' || obj.orchestrationMode === 'single')
  )
}

function isValidCreateSessionInput(input: unknown): input is CreateSessionInput {
  if (typeof input !== 'object' || input === null) return false
  const obj = input as Record<string, unknown>
  return typeof obj.spaceId === 'string' && typeof obj.label === 'string'
}

export function registerIpcHandlers(store?: StateStore): void {
  // External URL handler (existing)
  ipcMain.removeHandler(OPEN_EXTERNAL_URL_CHANNEL)
  ipcMain.handle(OPEN_EXTERNAL_URL_CHANNEL, async (_event, url: unknown) => {
    if (!isExternalHttpUrl(url)) {
      return false
    }
    await shell.openExternal(url)
    return true
  })

  if (!store) return

  // Space handlers
  ipcMain.removeHandler(SPACE_CREATE_CHANNEL)
  ipcMain.handle(SPACE_CREATE_CHANNEL, async (_event, input: unknown) => {
    if (!isValidCreateSpaceInput(input)) {
      throw new Error('Invalid space:create input')
    }

    const space: SpaceRecord = {
      id: randomUUID(),
      name: input.name,
      repoUrl: input.repoUrl,
      rootPath: input.rootPath,
      branch: input.branch,
      orchestrationMode: input.orchestrationMode,
      createdAt: new Date().toISOString(),
      status: 'active'
    }

    const state = store.getState()
    store.setState({
      ...state,
      spaces: { ...state.spaces, [space.id]: space }
    })

    return space
  })

  ipcMain.removeHandler(SPACE_LIST_CHANNEL)
  ipcMain.handle(SPACE_LIST_CHANNEL, async () => {
    return Object.values(store.getState().spaces)
  })

  ipcMain.removeHandler(SPACE_GET_CHANNEL)
  ipcMain.handle(SPACE_GET_CHANNEL, async (_event, input: unknown) => {
    const id = typeof input === 'object' && input !== null ? (input as Record<string, unknown>).id : undefined
    if (typeof id !== 'string') return null
    return store.getState().spaces[id] ?? null
  })

  // Session handler
  ipcMain.removeHandler(SESSION_CREATE_CHANNEL)
  ipcMain.handle(SESSION_CREATE_CHANNEL, async (_event, input: unknown) => {
    if (!isValidCreateSessionInput(input)) {
      throw new Error('Invalid session:create input')
    }

    const state = store.getState()
    if (!state.spaces[input.spaceId]) {
      throw new Error(`Space ${input.spaceId} does not exist`)
    }

    const session: SessionRecord = {
      id: randomUUID(),
      spaceId: input.spaceId,
      label: input.label,
      createdAt: new Date().toISOString()
    }

    store.setState({
      ...state,
      sessions: { ...state.sessions, [session.id]: session }
    })

    return session
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/unit/main/ipc-handlers.test.ts`
Expected: All tests PASS (existing + new).

**Step 5: Commit**

```bash
git add app/src/main/ipc-handlers.ts app/tests/unit/main/ipc-handlers.test.ts
git commit -m "feat(app): add space and session IPC handlers with input validation"
```

---

### Task 4: Wire State Store into Main Process Initialization

**Files:**
- Modify: `app/src/main/index.ts`

**Step 1: Wire the state store**

```typescript
// In app/src/main/index.ts, add imports and state store initialization:

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow } from 'electron'

import { registerIpcHandlers } from './ipc-handlers'
import { createStateStore } from './state-store'

// ... existing __filename/__dirname ...

app.whenReady().then(() => {
  const stateFilePath = path.join(app.getPath('userData'), 'app-state.json')
  const store = createStateStore(stateFilePath)
  registerIpcHandlers(store)
  createWindow()
  // ... rest unchanged
})
```

**Step 2: Verify the app starts**

Run: `cd app && npm run dev`
Expected: App starts without errors. Check the dev console for no IPC registration failures.

**Step 3: Commit**

```bash
git add app/src/main/index.ts
git commit -m "feat(app): initialize state store and pass to IPC handlers on app startup"
```

---

### Task 5: Preload Bridge Additions

**Files:**
- Modify: `app/src/preload/index.ts`
- Modify: `app/tests/unit/preload/index.test.ts`

**Step 1: Write the failing tests**

Add to `app/tests/unit/preload/index.test.ts`:

```typescript
// Add a new test after the existing tests:

it('exposes space and session IPC methods', async () => {
  invoke.mockResolvedValue({ id: 'test-space' })

  await import('../../../src/preload/index')

  const [, api] = exposeInMainWorld.mock.calls[0] as [
    string,
    {
      spaceCreate: (input: unknown) => Promise<unknown>
      spaceList: () => Promise<unknown>
      spaceGet: (id: string) => Promise<unknown>
      sessionCreate: (input: unknown) => Promise<unknown>
    }
  ]

  await api.spaceCreate({ name: 'Test' })
  expect(invoke).toHaveBeenCalledWith('space:create', { name: 'Test' })

  await api.spaceList()
  expect(invoke).toHaveBeenCalledWith('space:list')

  await api.spaceGet('abc')
  expect(invoke).toHaveBeenCalledWith('space:get', { id: 'abc' })

  await api.sessionCreate({ spaceId: 's1', label: 'Coordinator' })
  expect(invoke).toHaveBeenCalledWith('session:create', { spaceId: 's1', label: 'Coordinator' })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/preload/index.test.ts`
Expected: FAIL — `api.spaceCreate` is not a function.

**Step 3: Implement the preload additions**

Modify `app/src/preload/index.ts` — add space/session methods to `kataApi`:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

import type { CreateSessionInput, CreateSpaceInput, SessionRecord, SpaceRecord } from '../shared/types/space'

const OPEN_EXTERNAL_URL_CHANNEL = 'kata:openExternalUrl'

const kataApi = {
  getAgents: async () => [],
  getMessages: async () => [],
  getProject: async () => null,
  getGitStatus: async () => null,
  openExternalUrl: async (url: string): Promise<boolean> => {
    try {
      return await ipcRenderer.invoke(OPEN_EXTERNAL_URL_CHANNEL, url) as boolean
    } catch {
      return false
    }
  },
  spaceCreate: async (input: CreateSpaceInput): Promise<SpaceRecord> => {
    return await ipcRenderer.invoke('space:create', input) as SpaceRecord
  },
  spaceList: async (): Promise<SpaceRecord[]> => {
    return await ipcRenderer.invoke('space:list') as SpaceRecord[]
  },
  spaceGet: async (id: string): Promise<SpaceRecord | null> => {
    return await ipcRenderer.invoke('space:get', { id }) as SpaceRecord | null
  },
  sessionCreate: async (input: CreateSessionInput): Promise<SessionRecord> => {
    return await ipcRenderer.invoke('session:create', input) as SessionRecord
  }
}

contextBridge.exposeInMainWorld('kata', kataApi)

export type KataApi = typeof kataApi
```

**Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/unit/preload/index.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add app/src/preload/index.ts app/tests/unit/preload/index.test.ts
git commit -m "feat(app): add space and session IPC methods to preload bridge"
```

---

### Task 6: Replace MockSpace with SpaceRecord in Renderer

**Files:**
- Modify: `app/src/renderer/mock/spaces.ts`
- Modify: `app/src/renderer/components/home/SpacesListPanel.tsx`
- Modify: `app/src/renderer/components/home/HomeSpacesScreen.tsx`
- Modify: `app/tests/unit/renderer/home/HomeSpacesScreen.test.tsx`

This task converts the type system. The next task wires IPC.

**Step 1: Update mock/spaces.ts to use SpaceRecord**

Replace `MockSpace` with `SpaceRecord`. Add a `toDisplaySpace` helper that existing tests and components can use during transition. Keep the mock data for testing purposes.

```typescript
// app/src/renderer/mock/spaces.ts

import type { SpaceRecord } from '../../shared/types/space'

// Re-export SpaceRecord as the canonical space type for the renderer.
// MockSpace is retired; all renderer code uses SpaceRecord.
export type { SpaceRecord }

// Display helpers for SpaceRecord fields not present in the persisted type.
export type DisplaySpace = SpaceRecord & {
  repo: string      // derived from repoUrl (org/name)
  elapsed: string   // display-only time label
  archived: boolean // derived from status === 'archived'
}

export function toDisplaySpace(space: SpaceRecord, elapsed?: string): DisplaySpace {
  const repo = space.repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '') || space.repoUrl
  return {
    ...space,
    repo,
    elapsed: elapsed ?? 'now',
    archived: space.status === 'archived'
  }
}

export const mockSpaces: DisplaySpace[] = [
  {
    id: 'space-wave-1',
    name: 'Unblock Wave 1 verification',
    repoUrl: 'https://github.com/gannonh/kata-cloud',
    rootPath: '/Users/dev/kata-cloud',
    branch: 'main',
    orchestrationMode: 'team',
    createdAt: '2026-02-25T10:00:00.000Z',
    status: 'active',
    repo: 'gannonh/kata-cloud',
    elapsed: '2h',
    archived: false
  },
  {
    id: 'space-left-panel',
    name: 'Left panel parity follow-ups',
    repoUrl: 'https://github.com/gannonh/kata-cloud',
    rootPath: '/Users/dev/kata-cloud',
    branch: 'feature/left-panel',
    orchestrationMode: 'team',
    createdAt: '2026-02-25T09:00:00.000Z',
    status: 'idle',
    repo: 'gannonh/kata-cloud',
    elapsed: '48m',
    archived: false
  },
  {
    id: 'space-docs-sync',
    name: 'Docs and release sync',
    repoUrl: 'https://github.com/gannonh/kata-orchestrator',
    rootPath: '/Users/dev/kata-orchestrator',
    branch: 'main',
    orchestrationMode: 'single',
    createdAt: '2026-02-25T08:00:00.000Z',
    status: 'idle',
    repo: 'gannonh/kata-orchestrator',
    elapsed: '15m',
    archived: false
  },
  {
    id: 'space-archived-migration',
    name: 'Archived migration notes',
    repoUrl: 'https://github.com/gannonh/kata-orchestrator',
    rootPath: '/Users/dev/kata-orchestrator',
    branch: 'archive/notes',
    orchestrationMode: 'single',
    createdAt: '2026-02-24T08:00:00.000Z',
    status: 'archived',
    repo: 'gannonh/kata-orchestrator',
    elapsed: '1d',
    archived: true
  }
]
```

**Step 2: Update SpacesListPanel to use DisplaySpace**

In `app/src/renderer/components/home/SpacesListPanel.tsx`:
- Replace `import type { MockSpace }` with `import type { DisplaySpace }`
- Replace all `MockSpace` references with `DisplaySpace`

**Step 3: Update HomeSpacesScreen to use DisplaySpace**

In `app/src/renderer/components/home/HomeSpacesScreen.tsx`:
- Replace `import { mockSpaces, type MockSpace }` with `import { mockSpaces, type DisplaySpace }`
- Replace all `MockSpace` references with `DisplaySpace`

**Step 4: Update test to use DisplaySpace in custom data**

In `app/tests/unit/renderer/home/HomeSpacesScreen.test.tsx`:
- The test at line 134 creates inline space objects. Add the new required fields (`repoUrl`, `rootPath`, `orchestrationMode`, `createdAt`) to those objects.

**Step 5: Run tests to verify they still pass**

Run: `cd app && npx vitest run tests/unit/renderer/home/HomeSpacesScreen.test.ts`
Expected: All existing tests PASS. This is a pure type refactor; no behavior changes.

**Step 6: Commit**

```bash
git add app/src/renderer/mock/spaces.ts app/src/renderer/components/home/SpacesListPanel.tsx app/src/renderer/components/home/HomeSpacesScreen.tsx app/tests/unit/renderer/home/HomeSpacesScreen.test.tsx
git commit -m "refactor(app): replace MockSpace with SpaceRecord/DisplaySpace across renderer"
```

---

### Task 7: HomeSpacesScreen IPC Wiring

**Files:**
- Modify: `app/src/renderer/components/home/HomeSpacesScreen.tsx`
- Modify: `app/tests/unit/renderer/home/HomeSpacesScreen.test.tsx`

**Step 1: Write the failing tests**

Add new tests to `HomeSpacesScreen.test.tsx` that verify IPC calls. Mock `window.kata` for the renderer tests.

```typescript
// Add to app/tests/unit/renderer/home/HomeSpacesScreen.test.tsx

// At the top, add:
import { waitFor } from '@testing-library/react'

// Add these tests:

describe('IPC wiring', () => {
  afterEach(() => {
    cleanup()
    delete (window as any).kata
  })

  it('calls spaceList on mount and renders returned spaces', async () => {
    const spaceList = vi.fn().mockResolvedValue([
      { id: 'ipc-1', name: 'IPC Space', repoUrl: 'https://github.com/test/repo', rootPath: '/tmp', branch: 'main', orchestrationMode: 'team', createdAt: '2026-01-01T00:00:00.000Z', status: 'active' }
    ])
    ;(window as any).kata = { spaceList }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    await waitFor(() => {
      expect(spaceList).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByText('IPC Space')).toBeTruthy()
    })
  })

  it('calls spaceCreate on submit and adds the new space', async () => {
    const newSpace = { id: 'new-1', name: 'Created', repoUrl: 'https://github.com/gannonh/kata-cloud', rootPath: '/tmp', branch: 'main', orchestrationMode: 'team', createdAt: '2026-01-01T00:00:00.000Z', status: 'active' }
    const spaceCreate = vi.fn().mockResolvedValue(newSpace)
    const spaceList = vi.fn().mockResolvedValue([])
    ;(window as any).kata = { spaceCreate, spaceList }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('textbox', { name: 'Space prompt' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Space prompt' }), { target: { value: 'New project' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })
    expect(spaceCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New project'
    }))
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/unit/renderer/home/HomeSpacesScreen.test.tsx`
Expected: FAIL — component does not call `window.kata.spaceList` or `window.kata.spaceCreate`.

**Step 3: Implement IPC wiring in HomeSpacesScreen**

Modify `handleCreateSpace` to call `window.kata?.spaceCreate()` and add a `useEffect` to call `window.kata?.spaceList()` on mount.

Key changes to `app/src/renderer/components/home/HomeSpacesScreen.tsx`:

1. Add `useEffect` import
2. Add `useEffect` that calls `spaceList` on mount:
```typescript
useEffect(() => {
  const loadSpaces = async () => {
    const spaces = await window.kata?.spaceList()
    if (spaces) {
      setSpaces(spaces.map((s) => toDisplaySpace(s)))
    }
  }
  loadSpaces()
}, [])
```
3. Make `handleCreateSpace` async and call IPC:
```typescript
async function handleCreateSpace() {
  const input: CreateSpaceInput = {
    name: spacePrompt.trim() || 'Untitled space',
    repoUrl: selectedSpace ? `https://github.com/${selectedSpace.repo}` : 'https://github.com/gannonh/kata-cloud',
    rootPath: '',
    branch: selectedSpace?.branch ?? 'main',
    orchestrationMode: selectedMode
  }

  const created = await window.kata?.spaceCreate(input)
  if (created) {
    const display = toDisplaySpace(created)
    setSpaces((current) => [display, ...current])
    setSelectedSpaceId(display.id)
  }
  setSpacePrompt('')
  setIsCreatePanelActive(false)
}
```

**Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/unit/renderer/home/HomeSpacesScreen.test.tsx`
Expected: All tests PASS (existing + new IPC tests).

**Step 5: Run full test suite**

Run: `cd app && npm run test`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add app/src/renderer/components/home/HomeSpacesScreen.tsx app/tests/unit/renderer/home/HomeSpacesScreen.test.tsx
git commit -m "feat(app): wire HomeSpacesScreen to real IPC for space list and create"
```

---

### Task 8: App.tsx Startup Navigation

**Files:**
- Modify: `app/src/renderer/App.tsx`
- Modify or create: `app/tests/unit/renderer/App.test.tsx`

**Step 1: Write the failing test**

```typescript
// app/tests/unit/renderer/App.test.tsx

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from '../../../src/renderer/App'

describe('App', () => {
  afterEach(() => {
    cleanup()
    delete (window as any).kata
  })

  it('starts on home view by default', () => {
    render(<App />)
    // Home view shows the "Home" heading from HomeSpacesScreen
    expect(screen.getByText('Home')).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/unit/renderer/App.test.tsx`
Expected: FAIL — App defaults to `appView = 'workspace'`, so "Home" heading is not rendered.

**Step 3: Change App.tsx default to 'home'**

In `app/src/renderer/App.tsx`, change:
```typescript
const [appView, setAppView] = useState<'workspace' | 'home'>('home')
```

Remove the KAT-65 TODO comment (this task resolves it).

**Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/unit/renderer/App.test.tsx`
Expected: PASS.

**Step 5: Run full test suite**

Run: `cd app && npm run test`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add app/src/renderer/App.tsx app/tests/unit/renderer/App.test.tsx
git commit -m "feat(app): default to home view on startup, navigate to workspace on space open"
```

---

### Task 9: Integration Verification

**Files:**
- No new files. Manual + automated verification.

**Step 1: Run the full quality gate**

Run: `cd app && npm run test:ci:local`
Expected: Lint passes, coverage gate passes, all tests pass.

**Step 2: Run the dev app**

Run: `cd app && npm run dev`
Expected:
1. App opens on the Home view (not workspace)
2. Empty space list (first launch, no persisted data)
3. Type a prompt, click "Create space" — space appears in the list
4. Quit the app, relaunch — the created space persists in the list
5. Click a space, click "Open selected space" — navigates to the workspace (coordinator session) view

**Step 3: Verify persistence file**

Check: `ls ~/Library/Application\ Support/kata-desktop/app-state.json`
Expected: File exists with the created space data.

**Step 4: Commit any fixes**

If any fixes were needed, commit them individually with descriptive messages.

---

### Task 10: Pencil Design Sync (Code-First)

**Files:**
- Pencil file: `pencil/ui-01.pen` (via Pencil MCP tools only)

**Context:** Per `app/AGENTS.md`, this is behavior-driven work, so we follow the **code-first** Pencil design sync workflow:
1. Code is already built (Tasks 1-9)
2. Update or create the corresponding Pencil frame to reflect the shipped state
3. Keep Pencil as a living record, not a stale spec

**Step 1: Review current Pencil state**

Use Pencil MCP `get_editor_state()` to check what's currently in the design file.
Use `batch_get` to find existing frames related to "Home", "Create Space", "Spaces List".

**Step 2: Update Pencil frames**

Using `batch_design` operations:
- If a "Home / Spaces" frame exists, update it to reflect the shipped layout (real data flow, no mocks)
- If frames reference `MockSpace`, update component context notes to reference `SpaceRecord` / `DisplaySpace`
- Ensure all components use `$variable` references, not hardcoded colors
- Note target code paths in component `context` properties:
  - `HomeSpacesScreen` → `app/src/renderer/components/home/HomeSpacesScreen.tsx`
  - `CreateSpacePanel` → `app/src/renderer/components/home/CreateSpacePanel.tsx`
  - `SpacesListPanel` → `app/src/renderer/components/home/SpacesListPanel.tsx`

**Step 3: Screenshot for verification**

Use `get_screenshot` to capture the updated Pencil frame and compare visually with the running app.

**Step 4: Commit design sync notes (if any)**

If the Pencil sync required any code-side token or component changes, commit them.

---

## Linear Sub-Issues

Create these as sub-issues of KAT-92 in Linear:

| # | Title | Task |
|---|-------|------|
| 1 | [Slice 0] Shared types: SpaceRecord, SessionRecord, AppState | Task 1 |
| 2 | [Slice 0] State store: JSON file persistence with atomic writes | Task 2 |
| 3 | [Slice 0] Space and session IPC handlers | Task 3 |
| 4 | [Slice 0] Wire state store into main process initialization | Task 4 |
| 5 | [Slice 0] Preload bridge: space and session IPC methods | Task 5 |
| 6 | [Slice 0] Replace MockSpace with SpaceRecord/DisplaySpace | Task 6 |
| 7 | [Slice 0] HomeSpacesScreen IPC wiring | Task 7 |
| 8 | [Slice 0] App.tsx startup navigation | Task 8 |
| 9 | [Slice 0] Integration verification and quality gate | Task 9 |
| 10 | [Slice 0] Pencil design sync (code-first) | Task 10 |
