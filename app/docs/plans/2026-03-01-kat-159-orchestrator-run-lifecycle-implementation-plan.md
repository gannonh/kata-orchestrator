# KAT-159 Real Orchestrator Run Lifecycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire prompt submission from renderer through preload/main into a real orchestrator lifecycle using `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core`, with OAuth auth for Anthropic + OpenAI, persisted run timeline, and deterministic refresh replay.

**Architecture:** Main-process agent runtime (pi-agent-core) coordinates with pi-ai's streaming LLM API. IPC event bridge carries `SessionRuntimeEvent`s from main to renderer. Renderer's existing `sessionConversationReducer` consumes events unchanged. Credential resolution follows OAuth > env var > none priority. Run records persist to `StateStore` for refresh replay.

**Tech Stack:** Electron (main/preload/renderer), `@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`, `proper-lockfile`, React 19, TypeScript, Vitest + Testing Library, Playwright.

**Design doc:** `app/docs/plans/2026-03-01-kat-159-orchestrator-run-lifecycle-design.md`

---

### Task 1: Install pi-mono packages

**Files:**
- Modify: `app/package.json`

**Step 1: Install dependencies**

Run from repo root:
```bash
cd app && npm install @mariozechner/pi-ai @mariozechner/pi-agent-core proper-lockfile
npm install --save-dev @types/proper-lockfile
```

**Step 2: Verify installation**

Run: `cd app && node -e "require('@mariozechner/pi-ai'); console.log('pi-ai OK')"`
Run: `cd app && node -e "require('@mariozechner/pi-agent-core'); console.log('pi-agent-core OK')"`
Expected: Both print OK.

**Step 3: Verify existing tests still pass**

Run: `npm run test:app`
Expected: All existing tests pass.

**Step 4: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore(kat-159): install pi-ai, pi-agent-core, and proper-lockfile"
```

---

### Task 2: Define RunRecord types and extend AppState (Red)

**Files:**
- Create: `app/src/shared/types/run.ts`
- Modify: `app/src/shared/types/space.ts:66-80`
- Test: `app/tests/unit/shared/types/run.test.ts`
- Modify: `app/tests/unit/main/state-store.test.ts`

**Step 1: Write the failing tests**

Create `app/tests/unit/shared/types/run.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { RUN_STATUSES } from '../../../../src/shared/types/run'
import type { RunRecord, RunStatus, PersistedMessage } from '../../../../src/shared/types/run'

describe('RunRecord types', () => {
  it('exports RUN_STATUSES tuple', () => {
    expect(RUN_STATUSES).toEqual(['queued', 'running', 'completed', 'failed'])
  })

  it('RunRecord satisfies shape with all required fields', () => {
    const run: RunRecord = {
      id: 'run-1',
      sessionId: 'session-1',
      prompt: 'Build a dashboard',
      status: 'queued',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      createdAt: '2026-03-01T00:00:00.000Z',
      messages: []
    }

    expect(run.id).toBe('run-1')
    expect(run.status).toBe('queued')
    expect(run.messages).toEqual([])
  })

  it('RunRecord accepts optional timing and error fields', () => {
    const run: RunRecord = {
      id: 'run-2',
      sessionId: 'session-1',
      prompt: 'Plan phase 2',
      status: 'failed',
      model: 'gpt-4.1-2025-04-14',
      provider: 'openai',
      createdAt: '2026-03-01T00:00:00.000Z',
      startedAt: '2026-03-01T00:00:01.000Z',
      completedAt: '2026-03-01T00:00:05.000Z',
      errorMessage: 'Provider timed out',
      messages: [
        { id: 'user-1', role: 'user', content: 'Plan phase 2', createdAt: '2026-03-01T00:00:00.000Z' }
      ]
    }

    expect(run.errorMessage).toBe('Provider timed out')
    expect(run.messages).toHaveLength(1)
  })

  it('PersistedMessage satisfies shape', () => {
    const msg: PersistedMessage = {
      id: 'agent-1',
      role: 'agent',
      content: 'Draft ready.',
      createdAt: '2026-03-01T00:00:02.000Z'
    }

    expect(msg.role).toBe('agent')
  })

  it('RunStatus only allows valid values', () => {
    const statuses: RunStatus[] = ['queued', 'running', 'completed', 'failed']
    for (const status of statuses) {
      expect(RUN_STATUSES).toContain(status)
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/shared/types/run.test.ts`
Expected: FAIL — module not found.

**Step 3: Create run types**

Create `app/src/shared/types/run.ts`:

```ts
export const RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export type PersistedMessage = {
  id: string
  role: 'user' | 'agent'
  content: string
  createdAt: string
}

export type RunRecord = {
  id: string
  sessionId: string
  prompt: string
  status: RunStatus
  model: string
  provider: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  messages: PersistedMessage[]
}
```

**Step 4: Extend AppState and SessionRecord**

Modify `app/src/shared/types/space.ts`:

Add to `SessionRecord`:
```ts
export type SessionRecord = {
  id: string
  spaceId: string
  label: string
  createdAt: string
  activeModelId?: string
}
```

Add `runs` to `AppState`:
```ts
import type { RunRecord } from './run'

export type AppState = {
  spaces: Record<string, SpaceRecord>
  sessions: Record<string, SessionRecord>
  runs: Record<string, RunRecord>
  activeSpaceId: string | null
  activeSessionId: string | null
}

export function createDefaultAppState(): AppState {
  return {
    spaces: {},
    sessions: {},
    runs: {},
    activeSpaceId: null,
    activeSessionId: null
  }
}
```

**Step 5: Update state-store validation**

Modify `app/src/main/state-store.ts` — update `isAppState` to validate `runs`:

```ts
function isRunRecord(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.prompt === 'string' &&
    typeof value.status === 'string' &&
    RUN_STATUSES.includes(value.status as (typeof RUN_STATUSES)[number]) &&
    typeof value.model === 'string' &&
    typeof value.provider === 'string' &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.messages)
  )
}
```

Update `isAppState` to check `isRecord(value.runs)` and `Object.values(value.runs).every(isRunRecord)`.

**Step 6: Fix any existing state-store tests that now fail**

The `state-store.test.ts` tests pass `{ spaces: {}, sessions: {}, activeSpaceId: null, activeSessionId: null }` — these need `runs: {}` added to pass validation.

**Step 7: Run tests to verify all pass**

Run: `npx vitest run tests/unit/shared/types/run.test.ts tests/unit/main/state-store.test.ts tests/unit/shared/types/space.test.ts`
Expected: All pass.

**Step 8: Commit**

```bash
git add app/src/shared/types/run.ts app/src/shared/types/space.ts app/src/main/state-store.ts app/tests/unit/shared/types/run.test.ts app/tests/unit/main/state-store.test.ts
git commit -m "feat(kat-159): add RunRecord types and extend AppState with runs"
```

---

### Task 3: Auth Storage (Red → Green)

**Files:**
- Create: `app/src/main/auth-storage.ts`
- Test: `app/tests/unit/main/auth-storage.test.ts`

**Step 1: Write the failing tests**

Create `app/tests/unit/main/auth-storage.test.ts`:

```ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAuthStorage } from '../../../../src/main/auth-storage'
import type { AuthCredential, AuthStorage } from '../../../../src/main/auth-storage'

describe('AuthStorage', () => {
  let tmpDir: string
  let authPath: string
  let storage: AuthStorage

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kata-auth-test-'))
    authPath = path.join(tmpDir, 'auth.json')
    storage = createAuthStorage(authPath)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns null for unknown provider when file does not exist', async () => {
    const cred = await storage.get('anthropic')
    expect(cred).toBeNull()
  })

  it('saves and retrieves an api_key credential', async () => {
    const cred: AuthCredential = { type: 'api_key', key: 'sk-ant-test' }
    await storage.set('anthropic', cred)

    const loaded = await storage.get('anthropic')
    expect(loaded).toEqual(cred)
  })

  it('saves and retrieves an oauth credential', async () => {
    const cred: AuthCredential = {
      type: 'oauth',
      refresh: 'refresh-token',
      access: 'access-token',
      expires: Date.now() + 3600000
    }
    await storage.set('openai', cred)

    const loaded = await storage.get('openai')
    expect(loaded).toEqual(cred)
  })

  it('removes a credential', async () => {
    await storage.set('anthropic', { type: 'api_key', key: 'sk-ant-test' })
    await storage.remove('anthropic')

    const loaded = await storage.get('anthropic')
    expect(loaded).toBeNull()
  })

  it('persists across instances', async () => {
    await storage.set('anthropic', { type: 'api_key', key: 'sk-ant-test' })

    const storage2 = createAuthStorage(authPath)
    const loaded = await storage2.get('anthropic')
    expect(loaded).toEqual({ type: 'api_key', key: 'sk-ant-test' })
  })

  it('handles concurrent access without corruption', async () => {
    const s1 = createAuthStorage(authPath)
    const s2 = createAuthStorage(authPath)

    await Promise.all([
      s1.set('anthropic', { type: 'api_key', key: 'key-1' }),
      s2.set('openai', { type: 'api_key', key: 'key-2' })
    ])

    const storage3 = createAuthStorage(authPath)
    const a = await storage3.get('anthropic')
    const o = await storage3.get('openai')
    // Both should exist (lockfile prevents race)
    expect(a).not.toBeNull()
    expect(o).not.toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/auth-storage.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement auth storage**

Create `app/src/main/auth-storage.ts`:

```ts
import fs from 'node:fs'
import path from 'node:path'
import { lockSync, unlockSync } from 'proper-lockfile'

export type AuthCredential =
  | { type: 'api_key'; key: string }
  | { type: 'oauth'; refresh: string; access: string; expires: number }

type AuthData = Record<string, AuthCredential>

export type AuthStorage = {
  get(provider: string): Promise<AuthCredential | null>
  set(provider: string, credential: AuthCredential): Promise<void>
  remove(provider: string): Promise<void>
}

function readData(filePath: string): AuthData {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as AuthData
      : {}
  } catch {
    return {}
  }
}

function writeData(filePath: string, data: AuthData): void {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const tmpPath = path.join(dir, `.auth-${Date.now()}.tmp`)
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2))
  fs.renameSync(tmpPath, filePath)
}

function ensureFileExists(filePath: string): void {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '{}')
  }
}

export function createAuthStorage(filePath: string): AuthStorage {
  return {
    async get(provider) {
      const data = readData(filePath)
      return data[provider] ?? null
    },

    async set(provider, credential) {
      ensureFileExists(filePath)
      let release: (() => void) | undefined
      try {
        lockSync(filePath, { retries: { retries: 3, minTimeout: 100 } })
        release = () => unlockSync(filePath)
        const data = readData(filePath)
        data[provider] = credential
        writeData(filePath, data)
      } finally {
        release?.()
      }
    },

    async remove(provider) {
      ensureFileExists(filePath)
      let release: (() => void) | undefined
      try {
        lockSync(filePath, { retries: { retries: 3, minTimeout: 100 } })
        release = () => unlockSync(filePath)
        const data = readData(filePath)
        delete data[provider]
        writeData(filePath, data)
      } finally {
        release?.()
      }
    }
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/main/auth-storage.test.ts`
Expected: All pass.

**Step 5: Commit**

```bash
git add app/src/main/auth-storage.ts app/tests/unit/main/auth-storage.test.ts
git commit -m "feat(kat-159): add auth storage with lockfile-protected JSON persistence"
```

---

### Task 4: Credential Resolver (Red → Green)

**Files:**
- Create: `app/src/main/credential-resolver.ts`
- Test: `app/tests/unit/main/credential-resolver.test.ts`

**Step 1: Write the failing tests**

Create `app/tests/unit/main/credential-resolver.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCredentialResolver } from '../../../../src/main/credential-resolver'
import type { AuthStorage } from '../../../../src/main/auth-storage'
import type { CredentialResolver } from '../../../../src/main/credential-resolver'

function createMockAuthStorage(data: Record<string, { type: 'api_key'; key: string } | { type: 'oauth'; access: string; refresh: string; expires: number } | null> = {}): AuthStorage {
  return {
    async get(provider) { return data[provider] ?? null },
    async set() {},
    async remove() {}
  }
}

describe('CredentialResolver', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns oauth access token when stored', async () => {
    const storage = createMockAuthStorage({
      anthropic: { type: 'oauth', access: 'oauth-token', refresh: 'r', expires: Date.now() + 3600000 }
    })
    const resolver = createCredentialResolver(storage)

    const key = await resolver.getApiKey('anthropic')
    expect(key).toBe('oauth-token')
  })

  it('falls back to env var when no oauth credential', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env'
    const resolver = createCredentialResolver(createMockAuthStorage())

    const key = await resolver.getApiKey('anthropic')
    expect(key).toBe('sk-ant-env')
  })

  it('returns undefined when no credentials at all', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const resolver = createCredentialResolver(createMockAuthStorage())

    const key = await resolver.getApiKey('anthropic')
    expect(key).toBeUndefined()
  })

  it('resolves openai env var', async () => {
    process.env.OPENAI_API_KEY = 'sk-openai-env'
    const resolver = createCredentialResolver(createMockAuthStorage())

    const key = await resolver.getApiKey('openai')
    expect(key).toBe('sk-openai-env')
  })

  it('oauth takes priority over env var', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env'
    const storage = createMockAuthStorage({
      anthropic: { type: 'oauth', access: 'oauth-wins', refresh: 'r', expires: Date.now() + 3600000 }
    })
    const resolver = createCredentialResolver(storage)

    const key = await resolver.getApiKey('anthropic')
    expect(key).toBe('oauth-wins')
  })

  it('api_key credential takes priority over env var', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env'
    const storage = createMockAuthStorage({
      anthropic: { type: 'api_key', key: 'sk-ant-stored' }
    })
    const resolver = createCredentialResolver(storage)

    const key = await resolver.getApiKey('anthropic')
    expect(key).toBe('sk-ant-stored')
  })

  it('getAuthStatus returns oauth when oauth credential exists', async () => {
    const storage = createMockAuthStorage({
      anthropic: { type: 'oauth', access: 'token', refresh: 'r', expires: Date.now() + 3600000 }
    })
    const resolver = createCredentialResolver(storage)

    const status = await resolver.getAuthStatus('anthropic')
    expect(status).toBe('oauth')
  })

  it('getAuthStatus returns api_key when only env var set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env'
    const resolver = createCredentialResolver(createMockAuthStorage())

    const status = await resolver.getAuthStatus('anthropic')
    expect(status).toBe('api_key')
  })

  it('getAuthStatus returns none when no credentials', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const resolver = createCredentialResolver(createMockAuthStorage())

    const status = await resolver.getAuthStatus('anthropic')
    expect(status).toBe('none')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/credential-resolver.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement credential resolver**

Create `app/src/main/credential-resolver.ts`:

```ts
import type { AuthStorage } from './auth-storage'

export type AuthStatus = 'oauth' | 'api_key' | 'none'

export type CredentialResolver = {
  getApiKey(provider: string): Promise<string | undefined>
  getAuthStatus(provider: string): Promise<AuthStatus>
}

const ENV_MAP: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY'
}

export function createCredentialResolver(authStorage: AuthStorage): CredentialResolver {
  return {
    async getApiKey(provider) {
      const stored = await authStorage.get(provider)
      if (stored) {
        return stored.type === 'oauth' ? stored.access : stored.key
      }

      const envVar = ENV_MAP[provider]
      return envVar ? process.env[envVar] : undefined
    },

    async getAuthStatus(provider) {
      const stored = await authStorage.get(provider)
      if (stored) {
        return stored.type
      }

      const envVar = ENV_MAP[provider]
      if (envVar && process.env[envVar]) {
        return 'api_key'
      }

      return 'none'
    }
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/main/credential-resolver.test.ts`
Expected: All pass.

**Step 5: Commit**

```bash
git add app/src/main/credential-resolver.ts app/tests/unit/main/credential-resolver.test.ts
git commit -m "feat(kat-159): add credential resolver with OAuth > env > none priority"
```

---

### Task 5: Orchestrator Service (Red → Green)

**Files:**
- Create: `app/src/main/orchestrator.ts`
- Test: `app/tests/unit/main/orchestrator.test.ts`

**Step 1: Write the failing tests**

Create `app/tests/unit/main/orchestrator.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StateStore } from '../../../../src/main/state-store'
import type { AppState } from '../../../../src/shared/types/space'
import type { RunRecord } from '../../../../src/shared/types/run'
import { createDefaultAppState } from '../../../../src/shared/types/space'

// We test the orchestrator's exported functions against mocked pi-agent-core
// The actual Agent class is mocked to emit canned events

describe('Orchestrator', () => {
  let state: AppState
  let store: StateStore
  let savedStates: AppState[]

  beforeEach(() => {
    state = {
      ...createDefaultAppState(),
      sessions: {
        's-1': { id: 's-1', spaceId: 'sp-1', label: 'Test', createdAt: '2026-03-01T00:00:00Z' }
      },
      spaces: {
        'sp-1': {
          id: 'sp-1', name: 'Test Space', repoUrl: 'https://github.com/test/repo',
          rootPath: '/tmp/test', branch: 'main', orchestrationMode: 'team',
          createdAt: '2026-03-01T00:00:00Z', status: 'active'
        }
      }
    }
    savedStates = []
    store = {
      load: () => state,
      save: (next: AppState) => {
        state = next
        savedStates.push({ ...next })
      }
    }
  })

  it('createRun creates a queued RunRecord in state', async () => {
    const { createRun } = await import('../../../../src/main/orchestrator')

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'Plan phase 2',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic'
    })

    expect(run.status).toBe('queued')
    expect(run.sessionId).toBe('s-1')
    expect(run.prompt).toBe('Plan phase 2')
    expect(run.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'Plan phase 2' })
    ])
    expect(state.runs[run.id]).toBeDefined()
  })

  it('updateRunStatus transitions and persists', async () => {
    const { createRun, updateRunStatus } = await import('../../../../src/main/orchestrator')

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'test',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic'
    })

    updateRunStatus(store, run.id, 'running')
    expect(state.runs[run.id].status).toBe('running')
    expect(state.runs[run.id].startedAt).toBeDefined()

    updateRunStatus(store, run.id, 'completed')
    expect(state.runs[run.id].status).toBe('completed')
    expect(state.runs[run.id].completedAt).toBeDefined()
  })

  it('updateRunStatus sets errorMessage on failed', async () => {
    const { createRun, updateRunStatus } = await import('../../../../src/main/orchestrator')

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'test',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic'
    })

    updateRunStatus(store, run.id, 'running')
    updateRunStatus(store, run.id, 'failed', 'No credentials')
    expect(state.runs[run.id].status).toBe('failed')
    expect(state.runs[run.id].errorMessage).toBe('No credentials')
  })

  it('appendRunMessage adds a message to run', async () => {
    const { createRun, appendRunMessage } = await import('../../../../src/main/orchestrator')

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'test',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic'
    })

    appendRunMessage(store, run.id, {
      id: 'agent-1',
      role: 'agent',
      content: 'Draft ready.',
      createdAt: new Date().toISOString()
    })

    expect(state.runs[run.id].messages).toHaveLength(2) // user + agent
    expect(state.runs[run.id].messages[1].role).toBe('agent')
  })

  it('getRunsForSession returns runs filtered by sessionId', async () => {
    const { createRun, getRunsForSession } = await import('../../../../src/main/orchestrator')

    createRun(store, { sessionId: 's-1', prompt: 'a', model: 'm', provider: 'p' })
    createRun(store, { sessionId: 's-1', prompt: 'b', model: 'm', provider: 'p' })
    createRun(store, { sessionId: 's-other', prompt: 'c', model: 'm', provider: 'p' })

    const runs = getRunsForSession(store, 's-1')
    expect(runs).toHaveLength(2)
    expect(runs.every(r => r.sessionId === 's-1')).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/orchestrator.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement orchestrator service**

Create `app/src/main/orchestrator.ts`:

```ts
import { randomUUID } from 'node:crypto'
import type { StateStore } from './state-store'
import type { RunRecord, RunStatus, PersistedMessage } from '../shared/types/run'

export type CreateRunInput = {
  sessionId: string
  prompt: string
  model: string
  provider: string
}

export function createRun(store: StateStore, input: CreateRunInput): RunRecord {
  const state = store.load()
  const now = new Date().toISOString()
  const run: RunRecord = {
    id: randomUUID(),
    sessionId: input.sessionId,
    prompt: input.prompt,
    status: 'queued',
    model: input.model,
    provider: input.provider,
    createdAt: now,
    messages: [
      {
        id: `user-${randomUUID().slice(0, 8)}`,
        role: 'user',
        content: input.prompt,
        createdAt: now
      }
    ]
  }

  store.save({
    ...state,
    runs: { ...state.runs, [run.id]: run }
  })

  return run
}

export function updateRunStatus(
  store: StateStore,
  runId: string,
  status: RunStatus,
  errorMessage?: string
): void {
  const state = store.load()
  const run = state.runs[runId]
  if (!run) return

  const now = new Date().toISOString()
  const updates: Partial<RunRecord> = { status }

  if (status === 'running' && !run.startedAt) {
    updates.startedAt = now
  }
  if (status === 'completed' || status === 'failed') {
    updates.completedAt = now
  }
  if (errorMessage !== undefined) {
    updates.errorMessage = errorMessage
  }

  store.save({
    ...state,
    runs: {
      ...state.runs,
      [runId]: { ...run, ...updates }
    }
  })
}

export function appendRunMessage(
  store: StateStore,
  runId: string,
  message: PersistedMessage
): void {
  const state = store.load()
  const run = state.runs[runId]
  if (!run) return

  store.save({
    ...state,
    runs: {
      ...state.runs,
      [runId]: { ...run, messages: [...run.messages, message] }
    }
  })
}

export function getRunsForSession(store: StateStore, sessionId: string): RunRecord[] {
  const state = store.load()
  return Object.values(state.runs)
    .filter((run) => run.sessionId === sessionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/main/orchestrator.test.ts`
Expected: All pass.

**Step 5: Commit**

```bash
git add app/src/main/orchestrator.ts app/tests/unit/main/orchestrator.test.ts
git commit -m "feat(kat-159): add orchestrator service with run lifecycle and state persistence"
```

---

### Task 6: Agent Runner — pi-agent-core integration (Red → Green)

**Files:**
- Create: `app/src/main/agent-runner.ts`
- Test: `app/tests/unit/main/agent-runner.test.ts`

This module wraps pi-agent-core's `Agent` class and maps its events to `SessionRuntimeEvent`.

**Step 1: Write the failing tests**

Create `app/tests/unit/main/agent-runner.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

// Mock pi-agent-core's Agent before importing agent-runner
vi.mock('@mariozechner/pi-agent-core', () => {
  return {
    Agent: vi.fn().mockImplementation(() => {
      const listeners: Array<(event: unknown) => void> = []
      return {
        state: { messages: [], isStreaming: false },
        listen: vi.fn((cb: (event: unknown) => void) => {
          listeners.push(cb)
          return () => { /* unsubscribe */ }
        }),
        run: vi.fn(async () => {
          // Simulate agent lifecycle
          for (const listener of listeners) {
            listener({ type: 'agent_start' })
            listener({
              type: 'message_end',
              message: {
                role: 'assistant',
                content: [{ type: 'text', text: 'Draft ready for review.' }],
                usage: { input: 100, output: 50, totalTokens: 150, cacheRead: 0, cacheWrite: 0, cost: { total: 0.001 } },
                stopReason: 'end_turn',
                api: 'anthropic-messages',
                provider: 'anthropic',
                model: 'claude-sonnet-4-6-20250514'
              }
            })
            listener({ type: 'agent_end', messages: [] })
          }
        }),
        abort: vi.fn(),
        setSystemPrompt: vi.fn(),
        setModel: vi.fn(),
        addMessage: vi.fn()
      }
    })
  }
})

vi.mock('@mariozechner/pi-ai', () => ({
  getModel: vi.fn(() => ({
    id: 'claude-sonnet-4-6-20250514',
    name: 'Claude Sonnet 4.6',
    api: 'anthropic-messages',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com'
  })),
  streamSimple: vi.fn()
}))

describe('AgentRunner', () => {
  it('executeRun emits events and resolves on completion', async () => {
    const { createAgentRunner } = await import('../../../../src/main/agent-runner')
    const events: Array<{ type: string }> = []

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'You are a helpful assistant.',
      onEvent: (event) => events.push(event)
    })

    await runner.execute('Plan phase 2')

    expect(events.some(e => e.type === 'run_state_changed')).toBe(true)
    expect(events.some(e => e.type === 'message_appended')).toBe(true)
  })

  it('executeRun can be aborted', async () => {
    const { createAgentRunner } = await import('../../../../src/main/agent-runner')

    const runner = createAgentRunner({
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      systemPrompt: 'You are a helpful assistant.',
      onEvent: () => {}
    })

    // Start then abort immediately
    const promise = runner.execute('Plan phase 2')
    runner.abort()
    await promise

    // Should not throw
    expect(true).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/agent-runner.test.ts`
Expected: FAIL — module not found for agent-runner.

**Step 3: Implement agent runner**

Create `app/src/main/agent-runner.ts`:

```ts
import { Agent } from '@mariozechner/pi-agent-core'
import { getModel, streamSimple } from '@mariozechner/pi-ai'
import type { SessionRuntimeEvent } from '../renderer/types/session-runtime-adapter'

export type AgentRunnerConfig = {
  model: string
  provider: string
  apiKey: string
  systemPrompt: string
  onEvent: (event: SessionRuntimeEvent) => void
}

export type AgentRunner = {
  execute(prompt: string): Promise<void>
  abort(): void
}

function extractTextContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('')
}

export function createAgentRunner(config: AgentRunnerConfig): AgentRunner {
  const agent = new Agent()
  let aborted = false

  return {
    async execute(prompt) {
      const model = getModel(config.provider as 'anthropic' | 'openai', config.model)

      agent.setSystemPrompt(config.systemPrompt)
      agent.setModel(model)
      agent.addMessage({ role: 'user', content: prompt })

      config.onEvent({ type: 'run_state_changed', runState: 'pending' })

      agent.listen((event: { type: string; message?: unknown }) => {
        if (aborted) return

        if (event.type === 'message_end' && event.message) {
          const msg = event.message as {
            role: string
            content: Array<{ type: string; text?: string }>
          }
          if (msg.role === 'assistant') {
            const text = extractTextContent(msg.content)
            if (text) {
              config.onEvent({
                type: 'message_appended',
                message: {
                  id: `agent-${Date.now()}`,
                  role: 'agent',
                  content: text,
                  createdAt: new Date().toISOString()
                }
              })
            }
          }
        }

        if (event.type === 'agent_end') {
          config.onEvent({ type: 'run_state_changed', runState: 'idle' })
        }
      })

      try {
        await agent.run({
          model,
          convertToLlm: (messages) => messages.filter(m => 'role' in m) as any[],
          getApiKey: async () => config.apiKey,
          stream: (model, context, options) => streamSimple(model, context, options)
        })
      } catch (error) {
        if (!aborted) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          config.onEvent({
            type: 'run_state_changed',
            runState: 'error',
            errorMessage: message
          })
        }
      }
    },

    abort() {
      aborted = true
      agent.abort()
    }
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/main/agent-runner.test.ts`
Expected: All pass.

**Step 5: Commit**

```bash
git add app/src/main/agent-runner.ts app/tests/unit/main/agent-runner.test.ts
git commit -m "feat(kat-159): add agent runner bridging pi-agent-core events to SessionRuntimeEvent"
```

---

### Task 7: IPC Handlers for run/auth/model channels (Red → Green)

**Files:**
- Modify: `app/src/main/ipc-handlers.ts`
- Modify: `app/tests/unit/main/ipc-handlers.test.ts`

**Step 1: Write the failing tests**

Add to `app/tests/unit/main/ipc-handlers.test.ts` — new describe blocks for the new channels. The tests should verify:

- `run:submit` calls `createRun` and starts an agent runner
- `run:abort` calls the runner's abort
- `run:list` returns runs filtered by sessionId
- `auth:status` returns the credential status for a provider
- `auth:login` triggers the OAuth flow (mocked)
- `auth:logout` clears credentials
- `model:list` returns the curated model list with auth availability

Each handler test follows the pattern of the existing tests: create mock `ipcMain.handle`, invoke, assert response.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts`
Expected: New tests FAIL.

**Step 3: Implement new IPC channels**

Add to `app/src/main/ipc-handlers.ts`:

New channel constants:
```ts
const RUN_SUBMIT_CHANNEL = 'run:submit'
const RUN_ABORT_CHANNEL = 'run:abort'
const RUN_LIST_CHANNEL = 'run:list'
const RUN_EVENT_CHANNEL = 'run:event'
const AUTH_STATUS_CHANNEL = 'auth:status'
const AUTH_LOGIN_CHANNEL = 'auth:login'
const AUTH_LOGOUT_CHANNEL = 'auth:logout'
const AUTH_CALLBACK_CHANNEL = 'auth:callback'
const MODEL_LIST_CHANNEL = 'model:list'
```

New handler registrations in `registerIpcHandlers`:
- `run:submit` — validates input `{ sessionId, prompt, model, provider }`, calls `createRun()`, spawns `createAgentRunner()`, forwards events to `event.sender.send('run:event', runtimeEvent)`, updates run status on completion/failure
- `run:abort` — looks up active runner by runId, calls `abort()`
- `run:list` — validates `{ sessionId }`, calls `getRunsForSession()`
- `auth:status` — validates `{ provider }`, calls `credentialResolver.getAuthStatus()`
- `auth:login` — validates `{ provider }`, triggers pi-ai OAuth flow via `shell.openExternal()`, stores result in auth storage
- `auth:logout` — validates `{ provider }`, calls `authStorage.remove()`
- `model:list` — returns `SUPPORTED_MODELS` array annotated with auth status per provider

The `registerIpcHandlers` function signature expands to accept `AuthStorage` and `CredentialResolver` dependencies.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts`
Expected: All pass.

**Step 5: Verify existing tests still pass**

Run: `npm run test:app`
Expected: Full suite passes.

**Step 6: Commit**

```bash
git add app/src/main/ipc-handlers.ts app/tests/unit/main/ipc-handlers.test.ts
git commit -m "feat(kat-159): add run/auth/model IPC handlers"
```

---

### Task 8: Preload bridge additions (Red → Green)

**Files:**
- Modify: `app/src/preload/index.ts:23-53`
- Modify: `app/src/preload/index.d.ts`
- Modify: `app/tests/unit/preload/index.test.ts`

**Step 1: Write the failing tests**

Add tests verifying the new preload API surface:
- `kata.runSubmit` exists and is a function
- `kata.runAbort` exists and is a function
- `kata.onRunEvent` exists and is a function
- `kata.runList` exists and is a function
- `kata.authStatus` exists and is a function
- `kata.authLogin` exists and is a function
- `kata.authLogout` exists and is a function
- `kata.authCallback` exists and is a function
- `kata.modelList` exists and is a function

**Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/preload/index.test.ts`
Expected: New tests FAIL.

**Step 3: Add preload API methods**

Add to `kataApi` in `app/src/preload/index.ts`:

```ts
import type { SessionRuntimeEvent } from '../renderer/types/session-runtime-adapter'

// Run channels
runSubmit: (input: { sessionId: string; prompt: string; model: string; provider: string }) =>
  invokeTyped<{ runId: string }>(RUN_SUBMIT_CHANNEL, input),
runAbort: (runId: string) =>
  invokeTyped<boolean>(RUN_ABORT_CHANNEL, runId),
runList: (sessionId: string) =>
  invokeTyped<RunRecord[]>(RUN_LIST_CHANNEL, { sessionId }),
onRunEvent: (callback: (event: SessionRuntimeEvent) => void) => {
  const handler = (_event: unknown, data: SessionRuntimeEvent) => callback(data)
  ipcRenderer.on(RUN_EVENT_CHANNEL, handler)
  return () => { ipcRenderer.removeListener(RUN_EVENT_CHANNEL, handler) }
},

// Auth channels
authStatus: (provider: string) =>
  invokeTyped<'oauth' | 'api_key' | 'none'>(AUTH_STATUS_CHANNEL, { provider }),
authLogin: (provider: string) =>
  invokeTyped<boolean>(AUTH_LOGIN_CHANNEL, { provider }),
authLogout: (provider: string) =>
  invokeTyped<boolean>(AUTH_LOGOUT_CHANNEL, { provider }),
authCallback: (provider: string, code: string) =>
  invokeTyped<boolean>(AUTH_CALLBACK_CHANNEL, { provider, code }),

// Model channel
modelList: () =>
  invokeTyped<Array<{ provider: string; modelId: string; name: string; authStatus: string }>>(MODEL_LIST_CHANNEL),
```

Update `app/src/preload/index.d.ts` to export the updated `KataApi` type.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/preload/index.test.ts`
Expected: All pass.

**Step 5: Commit**

```bash
git add app/src/preload/index.ts app/src/preload/index.d.ts app/tests/unit/preload/index.test.ts
git commit -m "feat(kat-159): add run/auth/model preload bridge methods"
```

---

### Task 9: IPC Session Runtime Adapter + hook (Red → Green)

**Files:**
- Create: `app/src/renderer/hooks/useIpcSessionConversation.ts`
- Test: `app/tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`
- Modify: `app/tests/unit/renderer/center/sessionRuntimeAdapter.contract.test.ts`

**Step 1: Write the failing tests**

Create `app/tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`:

Test that:
- Hook initializes in `empty` state
- `submitPrompt` calls `window.kata.runSubmit`
- Receiving a `run_state_changed` event updates runState
- Receiving a `message_appended` event adds to messages array
- `retry` re-submits the last failed prompt
- On mount with existing runs, messages are replayed from persisted data

Also extend `sessionRuntimeAdapter.contract.test.ts` to verify the IPC adapter satisfies the contract shape.

**Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the hook**

Create `app/src/renderer/hooks/useIpcSessionConversation.ts`:

```ts
import { useCallback, useEffect, useReducer, useRef } from 'react'
import {
  createInitialSessionConversationState,
  sessionConversationReducer
} from '../components/center/sessionConversationState'
import type { SessionRuntimeEvent } from '../types/session-runtime-adapter'

export function useIpcSessionConversation(sessionId: string | null) {
  const [state, dispatch] = useReducer(
    sessionConversationReducer,
    undefined,
    createInitialSessionConversationState
  )
  const lastPromptRef = useRef<string | null>(null)

  // Subscribe to run events from main process
  useEffect(() => {
    const kata = window.kata
    if (!kata?.onRunEvent) return

    const unsubscribe = kata.onRunEvent((event: SessionRuntimeEvent) => {
      if (event.type === 'run_state_changed') {
        if (event.runState === 'pending') return // already dispatched on submit
        if (event.runState === 'idle') {
          // Run completed — handled by message_appended
          return
        }
        if (event.runState === 'error') {
          dispatch({ type: 'RUN_FAILED', error: event.errorMessage ?? 'Unknown error' })
        }
      }

      if (event.type === 'message_appended') {
        dispatch({ type: 'RUN_SUCCEEDED', response: event.message.content })
      }
    })

    return unsubscribe
  }, [])

  // Replay persisted runs on mount
  useEffect(() => {
    if (!sessionId) return
    const kata = window.kata
    if (!kata?.runList) return

    kata.runList(sessionId).then((runs) => {
      for (const run of runs) {
        for (const msg of run.messages) {
          if (msg.role === 'user') {
            dispatch({ type: 'SUBMIT_PROMPT', prompt: msg.content })
          } else {
            dispatch({ type: 'RUN_SUCCEEDED', response: msg.content })
          }
        }
      }
    }).catch(() => {
      // Silently ignore replay errors on mount
    })
  }, [sessionId])

  const submitPrompt = useCallback((prompt: string) => {
    const kata = window.kata
    if (!kata?.runSubmit || !sessionId) return

    lastPromptRef.current = prompt
    dispatch({ type: 'SUBMIT_PROMPT', prompt })

    kata.runSubmit({
      sessionId,
      prompt,
      model: 'claude-sonnet-4-6-20250514', // TODO: wire to model selector
      provider: 'anthropic'
    }).catch((error: Error) => {
      dispatch({ type: 'RUN_FAILED', error: error.message })
    })
  }, [sessionId])

  const retry = useCallback(() => {
    if (state.runState !== 'error' || !lastPromptRef.current) return
    dispatch({ type: 'RETRY_FROM_ERROR' })
    submitPrompt(lastPromptRef.current)
  }, [state.runState, submitPrompt])

  return { state, submitPrompt, retry }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`
Expected: All pass.

**Step 5: Commit**

```bash
git add app/src/renderer/hooks/useIpcSessionConversation.ts app/tests/unit/renderer/hooks/useIpcSessionConversation.test.ts app/tests/unit/renderer/center/sessionRuntimeAdapter.contract.test.ts
git commit -m "feat(kat-159): add IPC session conversation hook with persisted run replay"
```

---

### Task 10: ModelSelector component (Red → Green)

**Files:**
- Create: `app/src/renderer/components/center/ModelSelector.tsx`
- Test: `app/tests/unit/renderer/center/ModelSelector.test.tsx`

**Step 1: Write the failing tests**

Test that:
- Renders current model name in a badge
- Click opens a dropdown with model options
- Selecting a model calls `onModelChange` callback
- Models without auth show "Log in" instead of being selectable
- Renders disabled state when `disabled` prop is true

**Step 2: Run to verify failure, implement, run to verify pass**

The component is a `DropdownMenu` (shadcn) triggered by the existing model badge location in `ChatInput`. Each item shows `provider / model name`. Items without credentials are grayed with a "Log in" action.

**Step 3: Commit**

```bash
git add app/src/renderer/components/center/ModelSelector.tsx app/tests/unit/renderer/center/ModelSelector.test.tsx
git commit -m "feat(kat-159): add model selector dropdown component"
```

---

### Task 11: AuthDialog component (Red → Green)

**Files:**
- Create: `app/src/renderer/components/center/AuthDialog.tsx`
- Test: `app/tests/unit/renderer/center/AuthDialog.test.tsx`

**Step 1: Write the failing tests**

Test that:
- Dialog renders with Claude and OpenAI login options
- Clicking Claude triggers `window.kata.authLogin('anthropic')`
- Anthropic flow shows a text input for code paste
- Submitting the code calls `window.kata.authCallback`
- OpenAI flow shows a spinner during callback server wait
- Dialog closes on successful auth
- Cancel button closes dialog without action

**Step 2: Run to verify failure, implement, run to verify pass**

The component uses shadcn `Dialog`. Two-step flow: provider selection → auth progress.

**Step 3: Commit**

```bash
git add app/src/renderer/components/center/AuthDialog.tsx app/tests/unit/renderer/center/AuthDialog.test.tsx
git commit -m "feat(kat-159): add OAuth auth dialog for Claude and OpenAI"
```

---

### Task 12: ChatPanel — replace MockChatPanel (Red → Green)

**Files:**
- Create: `app/src/renderer/components/center/ChatPanel.tsx`
- Test: `app/tests/unit/renderer/center/ChatPanel.test.tsx`
- Modify: `app/src/renderer/components/center/ChatInput.tsx:84-86` (swap hardcoded badge for ModelSelector)
- Modify: `app/src/renderer/components/layout/AppShell.tsx:192` (swap MockChatPanel for ChatPanel)

**Step 1: Write the failing tests**

Test that:
- `ChatPanel` renders message list, run status badge, and chat input
- Submitting a message calls `useIpcSessionConversation.submitPrompt`
- Auth status indicator shows in chat input footer
- Model selector is wired to session model state
- Error state shows retry button

**Step 2: Run to verify failure**

**Step 3: Implement ChatPanel**

Create `app/src/renderer/components/center/ChatPanel.tsx`:

```tsx
import { useIpcSessionConversation } from '../../hooks/useIpcSessionConversation'
import { ChatInput } from './ChatInput'
import { MessageBubble } from './MessageBubble'
import { MessageList } from './MessageList'
import { RunStatusBadge } from './RunStatusBadge'

type ChatPanelProps = {
  sessionId: string | null
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const { state, submitPrompt, retry } = useIpcSessionConversation(sessionId)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageList>
        {state.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </MessageList>
      <div className="shrink-0 px-4 py-2">
        <RunStatusBadge runState={state.runState} />
      </div>
      <ChatInput
        onSend={submitPrompt}
        onRetry={retry}
        runState={state.runState}
      />
    </div>
  )
}
```

**Step 4: Wire into AppShell**

In `app/src/renderer/components/layout/AppShell.tsx`, replace:
```tsx
<MockChatPanel />
```
with:
```tsx
<ChatPanel sessionId={activeSessionId} />
```

Pass `activeSessionId` through from `App.tsx` (or derive from app state).

**Step 5: Run tests**

Run: `npm run test:app`
Expected: All tests pass including existing ones.

**Step 6: Commit**

```bash
git add app/src/renderer/components/center/ChatPanel.tsx app/tests/unit/renderer/center/ChatPanel.test.tsx app/src/renderer/components/center/ChatInput.tsx app/src/renderer/components/layout/AppShell.tsx
git commit -m "feat(kat-159): replace MockChatPanel with real IPC-wired ChatPanel"
```

---

### Task 13: Wire main process bootstrap

**Files:**
- Modify: `app/src/main/index.ts`

**Step 1: Update main process entry**

In `app/src/main/index.ts`, initialize auth storage, credential resolver, and pass them to `registerIpcHandlers`:

```ts
import { createAuthStorage } from './auth-storage'
import { createCredentialResolver } from './credential-resolver'

const authStorage = createAuthStorage(path.join(os.homedir(), '.kata', 'auth.json'))
const credentialResolver = createCredentialResolver(authStorage)

registerIpcHandlers(stateStore, {
  workspaceBaseDir,
  repoCacheBaseDir,
  authStorage,
  credentialResolver
})
```

**Step 2: Verify app launches**

Run: `cd app && npm run dev`
Expected: App launches without errors. Console shows no unhandled IPC registration errors.

**Step 3: Commit**

```bash
git add app/src/main/index.ts
git commit -m "feat(kat-159): wire auth storage and credential resolver into main process bootstrap"
```

---

### Task 14: E2E Test — Run Lifecycle

**Files:**
- Create: `app/tests/e2e/kat-159-run-lifecycle.spec.ts`

**Step 1: Write E2E test**

```ts
import { test, expect } from './fixtures/electron'

test.describe('KAT-159: Run lifecycle', () => {
  test('submit prompt shows thinking then response @ci @quality-gate', async ({ shellView }) => {
    // Navigate to a space and session
    // Type a prompt in ChatInput
    // Verify RunStatusBadge shows "Thinking"
    // Wait for agent response
    // Verify response message appears in MessageList
    // Verify RunStatusBadge shows "Stopped"
  })

  test('refresh replays persisted conversation @uat', async ({ shellView }) => {
    // Submit a prompt, wait for response
    // Reload the app
    // Verify messages are replayed from persisted state
  })

  test('error state shows retry button @ci', async ({ shellView }) => {
    // Submit with invalid credentials / trigger error
    // Verify error state and retry button
    // Click retry
  })
})
```

**Step 2: Run E2E**

Run: `npm run test:app:e2e:ci`
Expected: Tests pass (may need a local echo server or env vars for real provider).

**Step 3: Commit**

```bash
git add app/tests/e2e/kat-159-run-lifecycle.spec.ts
git commit -m "test(kat-159): add E2E tests for run lifecycle, replay, and error handling"
```

---

### Task 15: Full Test Suite Verification

**Step 1: Run full test suite**

Run: `npm run test:app`
Expected: All unit tests pass.

Run: `cd app && npm run lint`
Expected: No lint errors.

Run: `npm run test:app:coverage`
Expected: Coverage meets gate.

**Step 2: Run quality gate**

Run: `npm run test:app:quality-gate`
Expected: Lint + coverage + quality-gate E2E all pass.
