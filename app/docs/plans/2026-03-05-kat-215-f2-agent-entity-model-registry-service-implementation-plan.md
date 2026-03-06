# KAT-215 F2 Agent Entity Model + Registry Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve the shared agent entity and persisted registry contracts so coordinator, wave, and completion lanes can consume one stable agent model.

**Architecture:** Extend `SessionAgentRecord`/status literals in shared types, add backward-compatible normalization in `state-store`, and extract a main-process session-agent registry contract used by IPC handlers. Keep changes limited to shared contracts and main-process state/registry plumbing; no center/right UI edits in this ticket.

**Tech Stack:** TypeScript, Electron main/preload IPC, Vitest unit tests.

---

**Required supporting skills during execution:** `@test-driven-development`, `@verification-before-completion`, `@committing-changes`.

### Task 1: Expand Shared Agent Contract and Status Vocabulary

**Files:**
- Modify: `src/shared/types/space.ts`
- Test: `tests/unit/shared/types/space.test.ts`

**Step 1: Write the failing test**

Add assertions in `tests/unit/shared/types/space.test.ts` for new status values and extended record fields:

```ts
describe('SESSION_AGENT_STATUSES', () => {
  it('contains lifecycle statuses used by coordinator + wave + completion surfaces', () => {
    expect(SESSION_AGENT_STATUSES).toEqual([
      'idle',
      'queued',
      'delegating',
      'running',
      'blocked',
      'completed',
      'failed'
    ])
  })
})

it('allows optional wave/run metadata on SessionAgentRecord', () => {
  const agent: SessionAgentRecord = {
    id: 'agent-1',
    sessionId: 'session-1',
    name: 'Wave1 Verifier',
    role: 'Verifies wave outputs',
    kind: 'specialist',
    status: 'queued',
    avatarColor: '#0088cc',
    sortOrder: 2,
    activeRunId: 'run-1',
    waveId: 'wave-1',
    groupLabel: 'Wave 1 Coordinators',
    lastActivityAt: '2026-03-05T00:00:00.000Z',
    createdAt: '2026-03-05T00:00:00.000Z',
    updatedAt: '2026-03-05T00:00:00.000Z'
  }
  expect(agent.status).toBe('queued')
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/shared/types/space.test.ts`  
Expected: FAIL because `SESSION_AGENT_STATUSES` and/or `SessionAgentRecord` do not yet match the new assertions.

**Step 3: Write minimal implementation**

Update `src/shared/types/space.ts`:

```ts
export const SESSION_AGENT_STATUSES = [
  'idle',
  'queued',
  'delegating',
  'running',
  'blocked',
  'completed',
  'failed'
] as const

export type SessionAgentRecord = {
  id: string
  sessionId: string
  name: string
  role: string
  kind: SessionAgentKind
  status: SessionAgentStatus
  avatarColor: string
  delegatedBy?: string
  currentTask?: string
  sortOrder: number
  activeRunId?: string
  waveId?: string
  groupLabel?: string
  lastActivityAt?: string
  createdAt: string
  updatedAt: string
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/shared/types/space.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/shared/types/space.test.ts src/shared/types/space.ts
git commit -m "feat: expand session agent lifecycle and metadata contract"
```

### Task 2: Add Backward-Compatible Agent Status Normalization in State Store

**Files:**
- Modify: `src/main/state-store.ts`
- Test: `tests/unit/main/state-store.test.ts`

**Step 1: Write the failing test**

Add tests proving legacy and new values load correctly:

```ts
test('normalizes legacy agent status complete to completed', () => {
  fs.writeFileSync(filePath, JSON.stringify({
    spaces: {},
    sessions: {},
    runs: {},
    agentRoster: {
      a1: {
        id: 'a1',
        sessionId: 's1',
        name: 'Legacy Agent',
        role: 'legacy',
        kind: 'specialist',
        status: 'complete',
        avatarColor: '#123456',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    specDocuments: {},
    activeSpaceId: null,
    activeSessionId: null
  }))

  const state = createStateStore(filePath).load()
  expect(state.agentRoster.a1?.status).toBe('completed')
})

test('keeps extended agent metadata fields when valid', () => {
  // same fixture but with activeRunId/waveId/groupLabel/lastActivityAt
  // expect loaded record to include these values unchanged
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/main/state-store.test.ts`  
Expected: FAIL because legacy `complete` is currently rejected/dropped.

**Step 3: Write minimal implementation**

In `src/main/state-store.ts`, normalize status before validating enum membership:

```ts
function normalizeSessionAgentStatus(value: unknown): SessionAgentRecord['status'] | null {
  if (value === 'complete') {
    return 'completed'
  }
  if (typeof value === 'string' && SESSION_AGENT_STATUSES.includes(value as SessionAgentRecord['status'])) {
    return value as SessionAgentRecord['status']
  }
  return null
}
```

Then update `isSessionAgentRecord` / `normalizeAgentRoster` so normalized status is persisted in the returned in-memory state.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/main/state-store.test.ts`  
Expected: PASS for new normalization tests and existing suite.

**Step 5: Commit**

```bash
git add tests/unit/main/state-store.test.ts src/main/state-store.ts
git commit -m "feat: normalize legacy agent status during state-store load"
```

### Task 3: Create Main-Process Session Agent Registry Service Contract

**Files:**
- Create: `src/main/session-agent-registry.ts`
- Create: `tests/unit/main/session-agent-registry.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/main/session-agent-registry.test.ts` with deterministic behavior tests:

```ts
it('seeds baseline agents idempotently per session', () => {
  const state = createDefaultAppState()
  const registry = createSessionAgentRegistry(() => state, (next) => Object.assign(state, next))

  const first = registry.seedBaselineAgents('session-1', '2026-03-05T00:00:00.000Z')
  const second = registry.seedBaselineAgents('session-1', '2026-03-05T00:00:00.000Z')

  expect(first).toHaveLength(2)
  expect(second).toHaveLength(2)
  expect(Object.values(state.agentRoster).filter((a) => a.sessionId === 'session-1')).toHaveLength(2)
})

it('transitions queued -> delegating -> running -> completed', () => {
  // create agent then call transitionStatus repeatedly and assert final status
})

it('lists with deterministic sortOrder then createdAt', () => {
  // insert out-of-order agents, assert list order
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/main/session-agent-registry.test.ts`  
Expected: FAIL because registry module does not exist yet.

**Step 3: Write minimal implementation**

Create `src/main/session-agent-registry.ts`:

```ts
import { randomUUID } from 'node:crypto'
import type { AppState, SessionAgentRecord, SessionAgentStatus } from '../shared/types/space'

export type SessionAgentRegistry = {
  seedBaselineAgents(sessionId: string, createdAt: string): SessionAgentRecord[]
  list(sessionId: string): SessionAgentRecord[]
  upsert(agent: SessionAgentRecord): SessionAgentRecord
  transitionStatus(agentId: string, nextStatus: SessionAgentStatus, at: string): SessionAgentRecord
}

// implement with deterministic sort + idempotent baseline seeding
```

Keep logic pure over `AppState.agentRoster` (no IPC coupling in this file).

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/main/session-agent-registry.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/session-agent-registry.ts tests/unit/main/session-agent-registry.test.ts
git commit -m "feat: add session agent registry service contract"
```

### Task 4: Wire IPC Handlers to Registry Service (No UI Refactor)

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Test: `tests/unit/main/ipc-handlers.test.ts`

**Step 1: Write the failing test**

Add IPC tests that assert registry-backed behavior:

```ts
it('session:create seeds baseline agents through registry and avoids duplicates', async () => {
  // create session twice/load-save cycle and assert roster count stays 2 for session
})

it('session-agent-roster:list returns sorted agent records including new statuses', async () => {
  // load mocked state with queued/delegating/running/completed/failed and assert sorted output
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/main/ipc-handlers.test.ts`  
Expected: FAIL due to old inline seeding/sorting assumptions.

**Step 3: Write minimal implementation**

In `src/main/ipc-handlers.ts`:

- Import and instantiate `createSessionAgentRegistry`.
- Replace inline `createBaselineSessionAgentRoster` usage with `registry.seedBaselineAgents(...)`.
- Replace direct roster filtering/sort in `session-agent-roster:list` with `registry.list(sessionId)`.

Keep the channel contract unchanged:

```ts
ipcMain.handle('session-agent-roster:list', async (_event, input) => {
  const { sessionId } = parseSessionAgentRosterListInput(input)
  return sessionAgentRegistry.list(sessionId)
})
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/main/ipc-handlers.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts tests/unit/main/ipc-handlers.test.ts
git commit -m "refactor: route session agent IPC through registry service"
```

### Task 5: Full Ticket Verification and Evidence Pack

**Files:**
- Modify: `docs/plans/2026-03-05-kat-215-f2-agent-entity-model-registry-service-design.md` (append implementation evidence section)
- Create: `docs/plans/2026-03-05-kat-215-evidence-package.md`

**Step 1: Write failing verification checklist entry**

Add TODO checklist in evidence file before running commands:

```md
- [ ] Shared type suite passes
- [ ] State-store suite passes
- [ ] Registry suite passes
- [ ] IPC suite passes
- [ ] No out-of-scope file edits
```

**Step 2: Run verification commands**

Run:

```bash
npm run test -- tests/unit/shared/types/space.test.ts
npm run test -- tests/unit/main/state-store.test.ts
npm run test -- tests/unit/main/session-agent-registry.test.ts
npm run test -- tests/unit/main/ipc-handlers.test.ts
npm run lint
```

Expected: all commands PASS.

**Step 3: Record evidence output**

Populate evidence markdown with:

- Command results summary (pass/fail, timestamps)
- Files changed list
- Mapping of implemented contract to spec gaps (02/04/06/07)
- Explicit note that center/right presentation files were not edited

**Step 4: Final regression check**

Run: `git status --short`  
Expected: only scoped files + evidence docs changed.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-05-kat-215-f2-agent-entity-model-registry-service-design.md \
  docs/plans/2026-03-05-kat-215-evidence-package.md
git commit -m "docs: add KAT-215 implementation evidence package"
```

## Definition of Done Checklist

- Shared `SessionAgentRecord` contract supports coordinator/build/wave/completion usage.
- Legacy `complete` status is load-compatible and normalized.
- Session agent registry service exists with seed/list/upsert/transition contract.
- IPC session roster list is backed by registry service.
- Unit tests pass for shared/main registry/state/IPC coverage.
- Evidence doc prepared for Linear completion gate.
