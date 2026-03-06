# KAT-169 Agent/Context Sidebar Domain Model + State Contracts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the shared coordinator-session context contracts and selector surface that downstream sidebar and center tickets consume as read-only inputs.

**Architecture:** Reuse the persisted `agentRoster` introduced by KAT-215, add persisted session-scoped context resources plus run-scoped context references, and publish a renderer-domain selector layer that maps raw app state into coordinator-specific read models. Keep rendering code unchanged in this ticket and prove the contract with test-first coverage across shared types, state-store, main IPC/preload, and renderer selectors.

**Tech Stack:** TypeScript, Electron IPC, Vitest, React renderer domain modules

---

### Task 1: Add shared context contracts to app state and run records

**Files:**
- Modify: `src/shared/types/space.ts`
- Modify: `src/shared/types/run.ts`
- Test: `tests/unit/shared/types/space.test.ts`
- Test: `tests/unit/shared/types/run.test.ts`

**Step 1: Write the failing shared-type tests**

Add assertions for the new context constants and record shapes.

```ts
// tests/unit/shared/types/space.test.ts
import {
  SESSION_CONTEXT_RESOURCE_KINDS,
  createDefaultAppState
} from '../../../../src/shared/types/space'

describe('SESSION_CONTEXT_RESOURCE_KINDS', () => {
  it('contains spec, note, workspace-file, and manual', () => {
    expect(SESSION_CONTEXT_RESOURCE_KINDS).toEqual([
      'spec',
      'note',
      'workspace-file',
      'manual'
    ])
  })
})

it('includes contextResources in default app state', () => {
  expect(createDefaultAppState().contextResources).toEqual({})
})
```

```ts
// tests/unit/shared/types/run.test.ts
import type { RunRecord } from '../../../../src/shared/types/run'

it('allows run-scoped context references', () => {
  const run: RunRecord = {
    id: 'run-1',
    sessionId: 'session-1',
    prompt: 'Build this',
    status: 'completed',
    model: 'gpt-5.3-codex',
    provider: 'openai-codex',
    createdAt: '2026-03-06T00:00:00.000Z',
    messages: [],
    contextReferences: [
      {
        id: 'ctx-1',
        kind: 'resource',
        label: 'Spec',
        resourceId: 'resource-spec',
        sortOrder: 0,
        capturedAt: '2026-03-06T00:00:01.000Z'
      }
    ]
  }

  expect(run.contextReferences?.[0]?.kind).toBe('resource')
})
```

**Step 2: Run the targeted tests to verify they fail**

Run: `npx vitest run tests/unit/shared/types/space.test.ts tests/unit/shared/types/run.test.ts`

Expected: FAIL with missing `SESSION_CONTEXT_RESOURCE_KINDS`, missing `contextResources`, and missing `contextReferences`.

**Step 3: Write the minimal shared-type implementation**

Add the new contracts in-place where existing app state and run contracts already live.

```ts
// src/shared/types/space.ts
export const SESSION_CONTEXT_RESOURCE_KINDS = [
  'spec',
  'note',
  'workspace-file',
  'manual'
] as const

export type SessionContextResourceKind =
  (typeof SESSION_CONTEXT_RESOURCE_KINDS)[number]

export type SessionContextResourceRecord = {
  id: string
  sessionId: string
  kind: SessionContextResourceKind
  label: string
  sourcePath?: string
  description?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type AppState = {
  ...
  contextResources: Record<string, SessionContextResourceRecord>
}
```

```ts
// src/shared/types/run.ts
export const RUN_CONTEXT_REFERENCE_KINDS = [
  'pasted-text',
  'resource',
  'workspace-snippet'
] as const

export type RunContextReferenceKind =
  (typeof RUN_CONTEXT_REFERENCE_KINDS)[number]

export type RunContextReferenceRecord = {
  id: string
  kind: RunContextReferenceKind
  label: string
  resourceId?: string
  excerpt?: string
  lineCount?: number
  sortOrder: number
  capturedAt: string
}

export type RunRecord = {
  ...
  contextReferences?: RunContextReferenceRecord[]
}
```

Also extend `createDefaultAppState()` with `contextResources: {}`.

**Step 4: Run the targeted tests to verify they pass**

Run: `npx vitest run tests/unit/shared/types/space.test.ts tests/unit/shared/types/run.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/types/space.ts src/shared/types/run.ts tests/unit/shared/types/space.test.ts tests/unit/shared/types/run.test.ts
git commit -m "feat(shared): add coordinator context contracts"
```

### Task 2: Make state-store load and save the new contracts safely

**Files:**
- Modify: `src/main/state-store.ts`
- Test: `tests/unit/main/state-store.test.ts`

**Step 1: Write the failing state-store tests**

Add one compatibility test and one round-trip test.

```ts
it('loads legacy state without contextResources', () => {
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      spaces: {},
      sessions: {},
      runs: {},
      agentRoster: {},
      specDocuments: {},
      activeSpaceId: null,
      activeSessionId: null
    })
  )

  expect(createStateStore(filePath).load().contextResources).toEqual({})
})

it('drops malformed contextResources and malformed run contextReferences', () => {
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      spaces: {},
      sessions: {},
      runs: {
        'run-1': {
          id: 'run-1',
          sessionId: 'session-1',
          prompt: 'Prompt',
          status: 'completed',
          model: 'm',
          provider: 'p',
          createdAt: '2026-03-06T00:00:00.000Z',
          messages: [],
          contextReferences: [{ id: 'bad', kind: 'unknown' }]
        }
      },
      agentRoster: {},
      contextResources: {
        bad: { id: 'bad', sessionId: 123 }
      },
      specDocuments: {},
      activeSpaceId: null,
      activeSessionId: null
    })
  )

  const state = createStateStore(filePath).load()
  expect(state.contextResources).toEqual({})
  expect(state.runs['run-1']?.contextReferences).toEqual([])
})
```

**Step 2: Run the targeted tests to verify they fail**

Run: `npx vitest run tests/unit/main/state-store.test.ts`

Expected: FAIL on missing `contextResources` normalization and invalid `contextReferences` handling.

**Step 3: Implement normalization and validation**

Update validators and load defaults.

```ts
function isSessionContextResourceRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.kind === 'string' &&
    SESSION_CONTEXT_RESOURCE_KINDS.includes(value.kind as SessionContextResourceKind) &&
    typeof value.label === 'string' &&
    typeof value.sortOrder === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function normalizeContextResources(value: unknown): AppState['contextResources'] {
  ...
}

function normalizeRunRecord(record: unknown): RunRecord | null {
  ...
}
```

Practical rule:

- missing top-level `contextResources` becomes `{}`
- invalid context resources are dropped one-by-one
- invalid `contextReferences` on a valid run collapse to `[]`, not full-run rejection

**Step 4: Run the targeted tests to verify they pass**

Run: `npx vitest run tests/unit/main/state-store.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/main/state-store.ts tests/unit/main/state-store.test.ts
git commit -m "feat(main): normalize coordinator context state"
```

### Task 3: Seed baseline session context resources and expose a read IPC

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Test: `tests/unit/main/ipc-handlers.test.ts`
- Test: `tests/unit/preload/index.test.ts`

**Step 1: Write the failing IPC and preload tests**

Add tests for session seeding and the new preload bridge.

```ts
// tests/unit/main/ipc-handlers.test.ts
it('session:create seeds the Spec context resource for the new session', async () => {
  const createdSession = await sessionCreate({}, { spaceId: existingSpace.id, label: 'Session 2' })
  const savedState = store.save.mock.calls[0]?.[0] as AppState
  const sessionResources = Object.values(savedState.contextResources)
    .filter((entry) => entry.sessionId === createdSession.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  expect(sessionResources).toEqual([
    expect.objectContaining({
      sessionId: createdSession.id,
      kind: 'spec',
      label: 'Spec',
      sortOrder: 0
    })
  ])
})

it('session-context-resources:list returns sorted records for one session', async () => {
  const handler = getHandlersByChannel().get('session-context-resources:list')!
  await expect(handler({}, { sessionId: 'session-1' })).resolves.toEqual([
    expect.objectContaining({ id: 'ctx-1' }),
    expect.objectContaining({ id: 'ctx-2' })
  ])
})
```

```ts
// tests/unit/preload/index.test.ts
it('exposes sessionContextResourcesList and invokes the new channel', async () => {
  await import('../../../src/preload/index')
  const [, api] = exposeInMainWorld.mock.calls[0]
  invoke.mockResolvedValueOnce([{ id: 'ctx-1', sessionId: 'session-1', kind: 'spec', label: 'Spec', sortOrder: 0, createdAt: 'now', updatedAt: 'now' }])
  await expect(api.sessionContextResourcesList({ sessionId: 'session-1' })).resolves.toHaveLength(1)
  expect(invoke).toHaveBeenCalledWith('session-context-resources:list', { sessionId: 'session-1' })
})
```

**Step 2: Run the targeted tests to verify they fail**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts`

Expected: FAIL with missing seeded `contextResources` and missing `sessionContextResourcesList` bridge.

**Step 3: Implement the new main/preload contract**

Inside `src/main/ipc-handlers.ts`:

- add `SESSION_CONTEXT_RESOURCES_LIST_CHANNEL`
- add a `seedBaselineContextResources(sessionId, createdAt)` helper local to the file or a tiny colocated main-domain helper
- call that helper in `session:create` before save
- add the `session-context-resources:list` handler with deterministic `sortOrder`, `createdAt`, `id` ordering

Inside `src/preload/index.ts`:

```ts
sessionContextResourcesList: (input: { sessionId: string }) =>
  invokeTyped<SessionContextResourceRecord[]>(
    SESSION_CONTEXT_RESOURCES_LIST_CHANNEL,
    input
  )
```

`src/preload/index.d.ts` should continue deriving `PreloadKataApi` from `KataApi`; no special-case typing should be added there beyond the automatic surface change.

**Step 4: Run the targeted tests to verify they pass**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts src/preload/index.ts src/preload/index.d.ts tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts
git commit -m "feat(ipc): expose coordinator context resources"
```

### Task 4: Persist run context references explicitly

**Files:**
- Modify: `src/main/orchestrator.ts`
- Modify: `src/main/ipc-handlers.ts`
- Test: `tests/unit/main/orchestrator.test.ts`
- Test: `tests/unit/main/ipc-handlers.test.ts`

**Step 1: Write the failing persistence tests**

Add a focused mutator test first.

```ts
// tests/unit/main/orchestrator.test.ts
it('replaces run context references for an existing run', async () => {
  const run = createRun(store, {
    sessionId: 'session-1',
    prompt: 'Prompt',
    model: 'm',
    provider: 'p'
  })

  replaceRunContextReferences(store, run.id, [
    {
      id: 'ctx-1',
      kind: 'resource',
      label: 'Spec',
      resourceId: 'resource-spec',
      sortOrder: 0,
      capturedAt: '2026-03-06T00:00:01.000Z'
    }
  ])

  expect(store.load().runs[run.id]?.contextReferences).toHaveLength(1)
})
```

Add one IPC-level test proving `run:submit` initializes empty references:

```ts
expect(savedRun.contextReferences).toEqual([])
```

**Step 2: Run the targeted tests to verify they fail**

Run: `npx vitest run tests/unit/main/orchestrator.test.ts tests/unit/main/ipc-handlers.test.ts`

Expected: FAIL with missing `replaceRunContextReferences` and missing `contextReferences: []` initialization.

**Step 3: Implement the minimal run-reference persistence**

```ts
// src/main/orchestrator.ts
export function replaceRunContextReferences(
  store: StateStore,
  runId: string,
  references: RunContextReferenceRecord[]
): void {
  const state = store.load()
  const run = state.runs[runId]
  if (!run) {
    console.error(`[Orchestrator] Cannot set context references for unknown run: ${runId}`)
    return
  }

  store.save({
    ...state,
    runs: {
      ...state.runs,
      [runId]: { ...run, contextReferences: [...references] }
    }
  })
}
```

Also initialize `contextReferences: []` in `createRun`.

Do not add UI behavior here. This task only creates the persistence seam and default shape.

**Step 4: Run the targeted tests to verify they pass**

Run: `npx vitest run tests/unit/main/orchestrator.test.ts tests/unit/main/ipc-handlers.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/main/orchestrator.ts src/main/ipc-handlers.ts tests/unit/main/orchestrator.test.ts tests/unit/main/ipc-handlers.test.ts
git commit -m "feat(main): persist run context references"
```

### Task 5: Add coordinator selector contracts for agents and context

**Files:**
- Create: `src/renderer/features/coordinator-session/domain/contracts.ts`
- Create: `src/renderer/features/coordinator-session/domain/selectors.ts`
- Create: `src/renderer/features/coordinator-session/domain/index.ts`
- Test: `tests/unit/renderer/features/coordinator-session/domain/selectors.test.ts`

**Step 1: Write the failing selector tests**

Create a focused selector suite with small fixtures.

```ts
// tests/unit/renderer/features/coordinator-session/domain/selectors.test.ts
import { describe, expect, it } from 'vitest'
import {
  selectCoordinatorAgentList,
  selectCoordinatorContextItems,
  selectCoordinatorActiveRunContextChips,
  selectCoordinatorActiveRunContextSummary,
  selectCoordinatorPromptPreview
} from '../../../../../../src/renderer/features/coordinator-session/domain'

it('derives coordinator prompt preview from the latest run', () => {
  expect(selectCoordinatorPromptPreview(state, 'session-1')).toBe(
    'I would like to build the following product for which I have created an overview document...'
  )
})

it('returns Spec as a context item for a seeded session', () => {
  expect(selectCoordinatorContextItems(state, 'session-1')).toEqual([
    expect.objectContaining({ label: 'Spec', kind: 'spec' })
  ])
})

it('returns run context chips in sortOrder order', () => {
  expect(selectCoordinatorActiveRunContextChips(state, 'session-1').map((chip) => chip.label)).toEqual([
    '# Kata Cloud (Kata V2)',
    '## Context...'
  ])
})

it('builds the compact run context summary from references', () => {
  expect(selectCoordinatorActiveRunContextSummary(state, 'session-1')).toEqual({
    referenceCount: 2,
    pastedLineCount: 205,
    labels: ['# Kata Cloud (Kata V2)', '## Context...']
  })
})
```

**Step 2: Run the targeted tests to verify they fail**

Run: `npx vitest run tests/unit/renderer/features/coordinator-session/domain/selectors.test.ts`

Expected: FAIL because the coordinator domain module does not exist yet.

**Step 3: Implement the selector layer**

Create pure domain contracts and selectors only.

```ts
// contracts.ts
export type CoordinatorAgentListItem = { ... }
export type CoordinatorContextListItem = { ... }
export type CoordinatorRunContextChip = { ... }
export type CoordinatorRunContextSummary = { ... }
```

```ts
// selectors.ts
function getLatestRunForSession(state: CoordinatorContractState, sessionId: string) {
  return Object.values(state.runs)
    .filter((run) => run.sessionId === sessionId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
}

export function selectCoordinatorPromptPreview(...) { ... }
export function selectCoordinatorAgentList(...) { ... }
export function selectCoordinatorContextItems(...) { ... }
export function selectCoordinatorActiveRunContextChips(...) { ... }
export function selectCoordinatorActiveRunContextSummary(...) { ... }
```

Implementation rules:

- keep selectors total and deterministic
- use single-line trimmed excerpts for prompt preview
- return `[]` or `null` instead of throwing
- do not import React or renderer components

**Step 4: Run the targeted tests to verify they pass**

Run: `npx vitest run tests/unit/renderer/features/coordinator-session/domain/selectors.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/features/coordinator-session/domain/contracts.ts src/renderer/features/coordinator-session/domain/selectors.ts src/renderer/features/coordinator-session/domain/index.ts tests/unit/renderer/features/coordinator-session/domain/selectors.test.ts
git commit -m "feat(renderer): add coordinator session contract selectors"
```

### Task 6: Add compatibility proof tests at the current seams

**Files:**
- Modify: `tests/unit/renderer/hooks/useSessionAgentRoster.test.ts`
- Modify: `tests/unit/renderer/center/mockChatPresentation.test.ts`

**Step 1: Write the failing proof tests**

Add one test to keep the old roster hook usable and one test to document the migration target away from hardcoded chips.

```ts
// tests/unit/renderer/hooks/useSessionAgentRoster.test.ts
it('still maps seeded roster records while coordinator selectors move prompt preview out of AgentSummary', async () => {
  ...
  expect(result.current.agents[0]?.name).toBe('MVP Planning Coordinator')
})
```

```ts
// tests/unit/renderer/center/mockChatPresentation.test.ts
it('documents the target chip labels that will be sourced from coordinator selectors', () => {
  const result = deriveMockChatPresentation({
    messages: [{ id: 'u1', role: 'user', content: '# Kata Cloud\n## Context' }],
    isStreaming: true
  })

  expect(result.blocks.find((block) => block.type === 'contextChipRow')).toEqual(
    expect.objectContaining({
      chips: ['# Kata Cloud (Kata V2)', '## Context...']
    })
  )
})
```

The second test is not a UI rewrite. It locks the current seam so a follow-on refactor can swap the source without changing visible output.

**Step 2: Run the targeted tests to verify they fail only if the existing seam regresses**

Run: `npx vitest run tests/unit/renderer/hooks/useSessionAgentRoster.test.ts tests/unit/renderer/center/mockChatPresentation.test.ts`

Expected: PASS or reveal any accidental contract regressions introduced by earlier tasks.

**Step 3: Adjust tests minimally if earlier tasks changed the seam**

Only update assertions that legitimately changed because of the new shared contracts. Do not pull selector logic into the UI tests.

```ts
expect(result.current.agents[0]).toMatchObject({
  name: 'MVP Planning Coordinator',
  status: 'idle'
})
```

**Step 4: Run the targeted tests again**

Run: `npx vitest run tests/unit/renderer/hooks/useSessionAgentRoster.test.ts tests/unit/renderer/center/mockChatPresentation.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/renderer/hooks/useSessionAgentRoster.test.ts tests/unit/renderer/center/mockChatPresentation.test.ts
git commit -m "test(renderer): lock coordinator contract seam behavior"
```

### Task 7: Run the focused verification set and prepare Linear evidence notes

**Files:**
- Modify: `docs/plans/2026-03-06-kat-169-agentcontext-sidebar-domain-model-state-contracts-design.md`
- Create: `docs/plans/2026-03-06-kat-169-agentcontext-sidebar-domain-model-state-contracts-evidence.md`

**Step 1: Run the focused verification suite**

Run:

```bash
npx vitest run \
  tests/unit/shared/types/space.test.ts \
  tests/unit/shared/types/run.test.ts \
  tests/unit/main/state-store.test.ts \
  tests/unit/main/orchestrator.test.ts \
  tests/unit/main/ipc-handlers.test.ts \
  tests/unit/preload/index.test.ts \
  tests/unit/renderer/features/coordinator-session/domain/selectors.test.ts \
  tests/unit/renderer/hooks/useSessionAgentRoster.test.ts \
  tests/unit/renderer/center/mockChatPresentation.test.ts
```

Expected: PASS

**Step 2: Record the exported contract surface used by downstream tickets**

Create a short evidence note with:

- tests run and pass/fail summary
- exported selector/type names
- reminder that `KAT-171` must consume these as read-only inputs

```md
## Exported contract surface

- `CoordinatorAgentListItem`
- `CoordinatorContextListItem`
- `CoordinatorRunContextChip`
- `CoordinatorRunContextSummary`
- `selectCoordinatorAgentList(...)`
- `selectCoordinatorContextItems(...)`
- `selectCoordinatorActiveRunContextChips(...)`
- `selectCoordinatorActiveRunContextSummary(...)`
- `selectCoordinatorPromptPreview(...)`
```

**Step 3: Update the design doc approval note if implementation exposed any scope correction**

Keep edits minimal and factual.

**Step 4: Stage and commit the evidence note**

```bash
git add docs/plans/2026-03-06-kat-169-agentcontext-sidebar-domain-model-state-contracts-design.md docs/plans/2026-03-06-kat-169-agentcontext-sidebar-domain-model-state-contracts-evidence.md
git commit -m "docs: add KAT-169 contract evidence summary"
```

**Step 5: Post the Linear-ready summary**

Prepare this note for the ticket/PR:

```md
## KAT-169 Contract Surface
- Added persisted `contextResources` and run `contextReferences`
- Seeded baseline `Spec` session context resource
- Added coordinator selector exports for roster/context/chips/summary/prompt preview
- Locked compatibility with shared/main/preload/renderer tests
```

Plan complete and saved to `docs/plans/2026-03-06-kat-169-agentcontext-sidebar-domain-model-state-contracts-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
