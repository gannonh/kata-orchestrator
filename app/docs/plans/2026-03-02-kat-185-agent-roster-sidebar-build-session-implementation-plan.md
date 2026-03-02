# KAT-185 Agent Roster + Sidebar Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce a persistent session-agent roster model and render the build-session left sidebar Agents view from persisted IPC data instead of renderer-only mocks.

**Architecture:** Extend shared `AppState` with a normalized `agentRoster` collection, make main-process `state-store` backward-compatible for existing state files, seed baseline roster entries during session creation, and expose roster read APIs through preload to renderer. In the renderer, load roster data for the active space/session and map records into existing `AgentsTab`/`AgentCard` presentation contracts.

**Tech Stack:** Electron IPC (main/preload/renderer), React 19, TypeScript, Vitest + Testing Library, existing shadcn/ui primitives, state persistence via `src/main/state-store.ts`.

---

## Implementation Rules

- Use `@test-driven-development` for every code task (Red -> Green).
- Use `@verification-before-completion` before claiming completion.
- Keep scope to KAT-185 (no KAT-186 conversation index and no KAT-188 task checklist parity work).

### Task 1: Add Session Agent Roster Types to Shared State

**Files:**
- Modify: `src/shared/types/space.ts`
- Test: `tests/unit/shared/types/space.test.ts`

**Step 1: Write failing shared-type tests**

Add tests that assert:
- `AppState` now includes `agentRoster`.
- `createDefaultAppState()` returns `{ agentRoster: {} }`.
- `SESSION_AGENT_STATUSES` and `SESSION_AGENT_KINDS` expose the expected literals.

```ts
expect(createDefaultAppState()).toEqual({
  spaces: {},
  sessions: {},
  agentRoster: {},
  activeSpaceId: null,
  activeSessionId: null
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/shared/types/space.test.ts`  
Expected: FAIL because `agentRoster` and related roster types do not exist.

**Step 3: Implement shared roster types**

Add to `src/shared/types/space.ts`:

```ts
export const SESSION_AGENT_STATUSES = ['idle', 'running', 'blocked', 'complete'] as const
export type SessionAgentStatus = (typeof SESSION_AGENT_STATUSES)[number]

export const SESSION_AGENT_KINDS = ['system', 'coordinator', 'specialist'] as const
export type SessionAgentKind = (typeof SESSION_AGENT_KINDS)[number]

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
  createdAt: string
  updatedAt: string
}
```

Extend `AppState` and `createDefaultAppState()` with:

```ts
agentRoster: Record<string, SessionAgentRecord>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/shared/types/space.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/types/space.ts tests/unit/shared/types/space.test.ts
git commit -m "feat(kat-185): add shared session agent roster types"
```

### Task 2: Make State Store Backward-Compatible for `agentRoster`

**Files:**
- Modify: `src/main/state-store.ts`
- Test: `tests/unit/main/state-store.test.ts`

**Step 1: Write failing compatibility tests**

Add tests for:
- Loading legacy state JSON without `agentRoster` does not reset state.
- Loaded state gets normalized with `agentRoster: {}`.
- Invalid `agentRoster` top-level shape falls back safely.

```ts
expect(state.agentRoster).toEqual({})
expect(state.spaces['s1']).toBeDefined()
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/state-store.test.ts`  
Expected: FAIL on legacy payload handling.

**Step 3: Implement normalization + validation**

In `src/main/state-store.ts`:
- Add `isSessionAgentRecord(value: unknown): boolean`.
- Allow `agentRoster` to be missing in parsed files.
- Normalize loaded state before returning:

```ts
function normalizeAppState(value: AppState | Omit<AppState, 'agentRoster'>): AppState {
  return {
    ...value,
    agentRoster: isRecord((value as { agentRoster?: unknown }).agentRoster)
      ? ((value as { agentRoster: Record<string, unknown> }).agentRoster as AppState['agentRoster'])
      : {}
  }
}
```

Use normalization after schema checks so existing users do not lose `spaces/sessions`.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/main/state-store.test.ts tests/unit/shared/types/space.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/state-store.ts tests/unit/main/state-store.test.ts
git commit -m "fix(kat-185): make state-store compatible with agentRoster schema"
```

### Task 3: Seed and Query Roster in Main IPC Handlers

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Test: `tests/unit/main/ipc-handlers.test.ts`

**Step 1: Write failing IPC tests**

Add tests for:
- `session:create` seeds baseline roster entries for the new session.
- New channel `session-agent-roster:list` returns sorted entries for a session.
- New channel `session:listBySpace` returns sessions for the given space sorted by `createdAt` descending.
- Unknown session id returns empty list.

```ts
expect(handlers.get('session-agent-roster:list')).toBeDefined()
expect(roster).toHaveLength(2)
expect(roster.map((a) => a.name)).toEqual(['Kata Agents', 'MVP Planning Coordinator'])
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts`  
Expected: FAIL because channel and seeding behavior do not exist.

**Step 3: Implement handler + seed logic**

In `src/main/ipc-handlers.ts`:
- Add channel constant:

```ts
const SESSION_AGENT_ROSTER_LIST_CHANNEL = 'session-agent-roster:list'
const SESSION_LIST_BY_SPACE_CHANNEL = 'session:listBySpace'
```

- Add helper `createSeedRosterEntries(sessionId: string, nowIso: string): SessionAgentRecord[]`.
- In `session:create`, append seeded entries into `state.agentRoster`.
- Register list handler:

```ts
ipcMain.handle(SESSION_AGENT_ROSTER_LIST_CHANNEL, async (_event, input: unknown) => {
  const { sessionId } = parseSessionAgentRosterListInput(input)
  const state = stateStore.load()
  return Object.values(state.agentRoster)
    .filter((entry) => entry.sessionId === sessionId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
})
```

- Register session list-by-space handler:

```ts
ipcMain.handle(SESSION_LIST_BY_SPACE_CHANNEL, async (_event, input: unknown) => {
  const { spaceId } = parseSessionListBySpaceInput(input)
  const state = stateStore.load()
  return Object.values(state.sessions)
    .filter((session) => session.spaceId === spaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})
```

**Step 4: Run tests**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts tests/unit/main/ipc-handlers.test.ts
git commit -m "feat(kat-185): seed and expose session agent roster via IPC"
```

### Task 4: Expose Roster API in Preload + Renderer Window Types

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/renderer/types/window.d.ts`
- Test: `tests/unit/preload/index.test.ts`

**Step 1: Write failing preload bridge tests**

Add tests that `kataApi` exposes:
- `sessionAgentRosterList(input: { sessionId: string })`
- `sessionListBySpace(input: { spaceId: string })`

and invokes:

```ts
expect(invoke).toHaveBeenCalledWith('session-agent-roster:list', { sessionId: 'session-1' })
expect(invoke).toHaveBeenCalledWith('session:listBySpace', { spaceId: 'space-1' })
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/preload/index.test.ts`  
Expected: FAIL because API method is missing.

**Step 3: Implement preload + type declarations**

In `src/preload/index.ts`:
- Add channel constant and method:

```ts
const SESSION_AGENT_ROSTER_LIST_CHANNEL = 'session-agent-roster:list'
const SESSION_LIST_BY_SPACE_CHANNEL = 'session:listBySpace'
sessionListBySpace: (input: { spaceId: string }) =>
  invokeTyped<SessionRecord[]>(SESSION_LIST_BY_SPACE_CHANNEL, input)
sessionAgentRosterList: (input: { sessionId: string }) =>
  invokeTyped<SessionAgentRecord[]>(SESSION_AGENT_ROSTER_LIST_CHANNEL, input)
```

In `src/renderer/types/window.d.ts` and `src/preload/index.d.ts`:
- Add method signatures for `sessionListBySpace` and `sessionAgentRosterList`.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/preload/index.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/preload/index.ts src/preload/index.d.ts src/renderer/types/window.d.ts tests/unit/preload/index.test.ts
git commit -m "feat(kat-185): expose session agent roster preload API"
```

### Task 5: Build Renderer Roster Adapter + Loader Hook

**Files:**
- Create: `src/renderer/hooks/useSessionAgentRoster.ts`
- Create: `src/renderer/components/left/mapSessionAgentRecordToSummary.ts`
- Test: `tests/unit/renderer/hooks/useSessionAgentRoster.test.ts`
- Test: `tests/unit/renderer/left/mapSessionAgentRecordToSummary.test.ts`

**Step 1: Write failing mapper/hook tests**

Mapper tests should assert:
- `SessionAgentRecord.status` maps directly to `AgentSummary.status`.
- `currentTask` falls back to stable placeholder when absent.
- `delegatedBy` is forwarded.

Hook tests should assert:
- Hook resolves latest session for `activeSpaceId`, then loads roster.
- Successful IPC load populates `agents`.
- Missing API returns deterministic empty state.
- IPC rejection sets `error`.

**Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/renderer/hooks/useSessionAgentRoster.test.ts tests/unit/renderer/left/mapSessionAgentRecordToSummary.test.ts`  
Expected: FAIL because files do not exist.

**Step 3: Implement mapper + hook**

`mapSessionAgentRecordToSummary.ts`:

```ts
export function mapSessionAgentRecordToSummary(record: SessionAgentRecord): AgentSummary {
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    status: record.status,
    model: 'n/a',
    tokenUsage: { prompt: 0, completion: 0, total: 0 },
    currentTask: record.currentTask ?? 'Waiting for delegated work.',
    lastUpdated: record.updatedAt,
    delegatedBy: record.delegatedBy
  }
}
```

`useSessionAgentRoster.ts`:
- Accept `activeSpaceId`.
- Load sessions using `window.kata?.sessionListBySpace({ spaceId })`.
- Resolve target session as current active (if separately available) or most recent by `createdAt`.
- Load roster using `window.kata?.sessionAgentRosterList({ sessionId })`.
- Return `{ agents, isLoading, error }`.
- Guard for absent `window.kata?.sessionAgentRosterList`.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/renderer/hooks/useSessionAgentRoster.test.ts tests/unit/renderer/left/mapSessionAgentRecordToSummary.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/hooks/useSessionAgentRoster.ts src/renderer/components/left/mapSessionAgentRecordToSummary.ts tests/unit/renderer/hooks/useSessionAgentRoster.test.ts tests/unit/renderer/left/mapSessionAgentRecordToSummary.test.ts
git commit -m "feat(kat-185): add renderer roster loader and mapping adapter"
```

### Task 6: Wire Left Sidebar Agents View to Persisted Roster

**Files:**
- Modify: `src/renderer/components/layout/AppShell.tsx`
- Modify: `src/renderer/components/layout/LeftPanel.tsx`
- Modify: `src/renderer/components/left/AgentsTab.tsx`
- Test: `tests/unit/renderer/left/LeftPanel.test.tsx`
- Test: `tests/unit/renderer/left/AgentsTab.test.tsx`

**Step 1: Write failing UI wiring tests**

Add/update tests to assert:
- `LeftPanel` uses IPC-backed roster when provided.
- `mockAgents` is not required for baseline rendering.
- Error fallback text appears when roster loading fails.

```tsx
expect(screen.getByText('Kata Agents')).toBeTruthy()
expect(screen.queryByText('Task Block Parser')).toBeNull()
```

**Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/left/AgentsTab.test.tsx`  
Expected: FAIL because components still depend on `mockAgents`.

**Step 3: Implement sidebar integration**

In `AppShell`:
- Pass `activeSpaceId` through to `LeftPanel` prop.

In `LeftPanel`:
- Replace direct `mockAgents` usage for Agents tab with `useSessionAgentRoster(activeSpaceId)`.
- If no sessions exist for a space, render empty state copy (no crash).

In `AgentsTab`:
- Add optional `isLoading` and `error` props.
- Keep existing collapsible layout behavior for specialist/background entries.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/left/AgentsTab.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/layout/AppShell.tsx src/renderer/components/layout/LeftPanel.tsx src/renderer/components/left/AgentsTab.tsx tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/left/AgentsTab.test.tsx
git commit -m "feat(kat-185): render left sidebar agents from persisted roster"
```

### Task 7: End-to-End Verification + Evidence Capture

**Files:**
- Create: `tests/e2e/kat-185-agent-roster-sidebar.spec.ts` (if no existing sidebar scenario is suitable)
- Artifacts: `test-results/` screenshots

**Step 1: Add failing E2E assertion**

Create/update E2E scenario that:
- Opens a space/session.
- Verifies left panel shows seeded roster entries.
- Reloads app and verifies roster persists.

**Step 2: Run E2E to verify failure**

Run: `npm run test:app:e2e:ci -- --grep "kat-185|agent roster"`  
Expected: FAIL before implementation wiring.

**Step 3: Finalize E2E and screenshot evidence**

Capture at least one screenshot of the left sidebar showing:
- `Kata Agents`
- `MVP Planning Coordinator`

**Step 4: Run full verification suite**

Run:
- `npm run test:app`
- `npm run test:app:coverage`
- `npm run test:app:quality-gate`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/e2e/kat-185-agent-roster-sidebar.spec.ts test-results
git commit -m "test(kat-185): verify persisted agent roster sidebar behavior"
```

### Task 8: Final Cleanup and Ticket Evidence Notes

**Files:**
- Modify: `docs/plans/2026-03-02-kat-185-agent-roster-sidebar-build-session-design.md` (optional brief implementation notes)
- Optional: add summary in Linear ticket comment

**Step 1: Confirm no accidental scope creep**

Run: `git diff --name-only main...HEAD`  
Expected: only KAT-185 relevant shared/main/preload/renderer/tests files.

**Step 2: Confirm persistence contract manually**

Manual check:
- Create/open session.
- Verify roster appears.
- Relaunch app.
- Verify roster still appears.

**Step 3: Prepare evidence references**

Collect:
- Test command outputs.
- Screenshot paths.
- Any key test file links.

**Step 4: Final lint/test spot check**

Run: `npm run -w app test:ci:local`  
Expected: PASS.

**Step 5: Commit (if documentation/evidence files changed)**

```bash
git add docs/plans/2026-03-02-kat-185-agent-roster-sidebar-build-session-design.md
git commit -m "docs(kat-185): add implementation evidence summary"
```
