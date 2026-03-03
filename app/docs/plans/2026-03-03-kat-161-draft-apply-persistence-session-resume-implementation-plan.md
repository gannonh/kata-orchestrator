# KAT-161 Draft Apply + Persistence + Session Resume Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist Slice A session/run/spec/task state so relaunch restores the active workspace/session with coherent draft and task continuity.

**Architecture:** Consolidate persistence in main-process `AppState` and expose explicit bootstrap/spec IPC contracts. On startup, reconcile transient run states (`queued`/`running`) into a safe terminal fallback and restore valid active selections. Move right-panel spec storage from renderer localStorage to IPC-backed persisted state keyed by `spaceId:sessionId`.

**Tech Stack:** Electron IPC, React 19, TypeScript, Vitest, Playwright Electron E2E.

---

**Execution rules**

- Apply `@test-driven-development` on every task (red -> green -> refactor).
- Apply `@verification-before-completion` before marking KAT-161 complete.
- Keep commits small: one commit per task.

### Task 1: Add Shared Persistence Contracts for Spec and Run Draft Metadata

**Files:**
- Create: `src/shared/types/spec-document.ts`
- Modify: `src/shared/types/run.ts`
- Modify: `src/shared/types/space.ts`
- Test: `tests/unit/shared/types/space.test.ts`

**Step 1: Write failing type-contract tests**

```ts
it('supports session-scoped persisted spec documents', () => {
  const state = createDefaultAppState()
  expect(state.specDocuments).toEqual({})
})

it('supports run draft metadata and draft-applied markers', () => {
  const run: RunRecord = {
    id: 'r1',
    sessionId: 's1',
    prompt: 'hello',
    status: 'completed',
    model: 'gpt',
    provider: 'openai',
    createdAt: '2026-01-01T00:00:00.000Z',
    messages: [],
    draft: {
      runId: 'r1',
      generatedAt: '2026-01-01T00:00:00.000Z',
      content: '## Goal\nShip'
    },
    draftAppliedAt: '2026-01-01T00:01:00.000Z'
  }

  expect(run.draft?.runId).toBe('r1')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/shared/types/space.test.ts`  
Expected: FAIL on missing `specDocuments` / `draft` contracts.

**Step 3: Implement shared contracts**

```ts
export type PersistedSpecDocument = {
  markdown: string
  updatedAt: string
  appliedRunId?: string
  appliedAt?: string
}
```

```ts
export type RunRecord = {
  // existing fields...
  draft?: LatestRunDraft
  draftAppliedAt?: string
}
```

```ts
export type AppState = {
  // existing fields...
  specDocuments: Record<string, PersistedSpecDocument>
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/shared/types/space.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/types/spec-document.ts src/shared/types/run.ts src/shared/types/space.ts tests/unit/shared/types/space.test.ts
git commit -m "feat(app): add shared persistence contracts for KAT-161"
```

### Task 2: Extend State Store Validation + Startup Reconciliation

**Files:**
- Modify: `src/main/state-store.ts`
- Test: `tests/unit/main/state-store.test.ts`

**Step 1: Write failing tests for specDocuments validation and run reconciliation**

```ts
test('loads valid specDocuments and drops malformed entries', () => {
  // fixture with one valid and one invalid spec document
})

test('reconciles queued/running runs to failed on load', () => {
  // fixture run status queued/running -> failed + completedAt + errorMessage
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/state-store.test.ts`  
Expected: FAIL for missing `specDocuments` handling and restart reconciliation.

**Step 3: Implement state-store updates**

```ts
function reconcileInterruptedRuns(runs: AppState['runs']): AppState['runs'] {
  // queued/running -> failed with deterministic restart message
}
```

```ts
return {
  spaces: parsed.spaces,
  sessions: parsed.sessions,
  runs: reconcileInterruptedRuns(parsed.runs ?? {}),
  agentRoster: normalizeAgentRoster(parsed.agentRoster),
  specDocuments: normalizeSpecDocuments(parsed.specDocuments),
  activeSpaceId,
  activeSessionId
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/main/state-store.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/state-store.ts tests/unit/main/state-store.test.ts
git commit -m "fix(app): reconcile interrupted runs and persist spec docs on load"
```

### Task 3: Persist Draft Metadata and Draft-Applied Checkpoints in Orchestrator Domain

**Files:**
- Modify: `src/main/orchestrator.ts`
- Modify: `src/main/ipc-handlers.ts`
- Test: `tests/unit/main/ipc-handlers.test.ts`

**Step 1: Write failing tests for run draft persistence and draft-applied stamping**

```ts
it('stores latest draft payload on agent message append', async () => {
  // assert save() includes run.draft
})

it('marks draftAppliedAt when draft is applied', async () => {
  // assert run.draftAppliedAt set through IPC handler
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts`  
Expected: FAIL for missing draft persistence channel/behavior.

**Step 3: Implement minimal persistence helpers**

```ts
export function setRunDraft(store: StateStore, runId: string, draft: LatestRunDraft): void
export function markRunDraftApplied(store: StateStore, runId: string, appliedAt: string): void
```

Wire into run event handling so persisted runs retain draft context.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/orchestrator.ts src/main/ipc-handlers.ts tests/unit/main/ipc-handlers.test.ts
git commit -m "feat(app): persist run draft and draft-applied checkpoints"
```

### Task 4: Add Bootstrap, Active Selection, and Spec Persistence IPC Channels

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Test: `tests/unit/main/ipc-handlers.test.ts`
- Test: `tests/unit/preload/index.test.ts`

**Step 1: Write failing IPC contract tests**

```ts
it('returns persisted active ids via app:bootstrap', async () => {})
it('persists active selection via session:setActive and space:setActive', async () => {})
it('supports spec:get spec:save spec:applyDraft', async () => {})
```

```ts
it('preload exposes appBootstrap and spec persistence methods', async () => {})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts`  
Expected: FAIL with missing channels on main/preload bridge.

**Step 3: Implement channel contracts**

```ts
const APP_BOOTSTRAP_CHANNEL = 'app:bootstrap'
const SPACE_SET_ACTIVE_CHANNEL = 'space:setActive'
const SESSION_SET_ACTIVE_CHANNEL = 'session:setActive'
const SPEC_GET_CHANNEL = 'spec:get'
const SPEC_SAVE_CHANNEL = 'spec:save'
const SPEC_APPLY_DRAFT_CHANNEL = 'spec:applyDraft'
```

```ts
appBootstrap: () => invokeTyped<AppBootstrapPayload>(APP_BOOTSTRAP_CHANNEL),
specGet: (input) => invokeTyped<PersistedSpecDocument | null>(SPEC_GET_CHANNEL, input),
specSave: (input) => invokeTyped<PersistedSpecDocument>(SPEC_SAVE_CHANNEL, input),
specApplyDraft: (input) => invokeTyped<PersistedSpecDocument>(SPEC_APPLY_DRAFT_CHANNEL, input),
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts src/preload/index.ts src/preload/index.d.ts tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts
git commit -m "feat(app): add bootstrap and spec persistence ipc contracts"
```

### Task 5: Restore Active Workspace/Session on Renderer Startup

**Files:**
- Modify: `src/renderer/App.tsx`
- Test: `tests/unit/renderer/App.test.tsx`

**Step 1: Write failing app startup tests**

```tsx
it('opens workspace directly when appBootstrap has valid active ids', async () => {})
it('does not create a new session on startup when activeSessionId exists', async () => {})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/App.test.tsx`  
Expected: FAIL because App always starts in Home and creates a new session on open.

**Step 3: Implement bootstrap-driven startup**

```tsx
useEffect(() => {
  window.kata?.appBootstrap?.().then((boot) => {
    if (boot.activeSpaceId && boot.activeSessionId) {
      setActiveSpaceId(boot.activeSpaceId)
      setActiveSessionId(boot.activeSessionId)
      setAppView('workspace')
      return
    }
    setAppView('home')
  })
}, [])
```

Persist selection changes through new `space:setActive` / `session:setActive` APIs.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/App.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/App.tsx tests/unit/renderer/App.test.tsx
git commit -m "feat(app): restore active workspace session on relaunch"
```

### Task 6: Migrate Spec Panel Persistence from localStorage to IPC-backed Main State

**Files:**
- Modify: `src/renderer/hooks/useSpecDocument.ts`
- Modify: `src/renderer/components/layout/RightPanel.tsx`
- Test: `tests/unit/renderer/hooks/useSpecDocument.test.ts`

**Step 1: Write failing hook tests for IPC-backed persistence**

```ts
it('loads spec document from ipc for active session', async () => {})
it('persists markdown/task toggles through spec:save', async () => {})
it('applyDraft sets appliedRunId and marks run draft applied', async () => {})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/hooks/useSpecDocument.test.ts`  
Expected: FAIL because hook currently reads/writes `window.localStorage`.

**Step 3: Implement IPC persistence path**

```ts
const persisted = await window.kata?.specGet?.({ spaceId, sessionId })
await window.kata?.specSave?.({ spaceId, sessionId, markdown, appliedRunId })
await window.kata?.specApplyDraft?.({ spaceId, sessionId, runId: draft.runId, content: draft.content })
```

Keep parser-driven task derivation identical to KAT-160 behavior.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/hooks/useSpecDocument.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/hooks/useSpecDocument.ts src/renderer/components/layout/RightPanel.tsx tests/unit/renderer/hooks/useSpecDocument.test.ts
git commit -m "feat(app): move spec task persistence to main-state ipc"
```

### Task 7: Preserve Conversation Resume Semantics with Persisted Runs and Drafts

**Files:**
- Modify: `src/renderer/hooks/useIpcSessionConversation.ts`
- Test: `tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`

**Step 1: Write failing replay tests for persisted draft/failed-recovery states**

```ts
it('replays persisted run messages and restores latestDraft from run.draft', async () => {})
it('shows error state for reconciled interrupted run after relaunch', async () => {})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`  
Expected: FAIL because replay currently rebuilds synthetic draft from agent messages only.

**Step 3: Implement replay updates**

```ts
if (run.draft) {
  setLatestDraft(run.draft)
}
if (run.status === 'failed' && run.errorMessage?.includes('Recovered after app restart')) {
  dispatch({ type: 'RUN_FAILED', error: run.errorMessage })
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/hooks/useIpcSessionConversation.ts tests/unit/renderer/hooks/useIpcSessionConversation.test.ts
git commit -m "fix(app): restore draft and interrupted-run state on replay"
```

### Task 8: Add Relaunch E2E Coverage and Evidence Capture for KAT-161

**Files:**
- Create: `tests/e2e/kat-161-restart-resume.spec.ts`
- Create: `tests/e2e/helpers/kat-161-evidence.ts`
- Modify: `tests/e2e/fixtures/electron.ts` (if fixture helper extraction is needed)

**Step 1: Write failing relaunch integration test**

```ts
test('restores active space/session/spec/tasks across relaunch', async ({ ... }) => {
  // create/open space + session
  // submit prompt, apply draft, toggle task
  // relaunch with same state file
  // verify restored workspace/session + spec/task state
})

test('reconciles interrupted running run to safe failed fallback on relaunch', async ({ ... }) => {
  // simulate in-flight status in state file before relaunch
  // assert error fallback message appears and run is terminal
})
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/kat-161-restart-resume.spec.ts`  
Expected: FAIL before persistence/restart wiring is complete.

**Step 3: Implement final selectors/assertions and evidence writer**

Write JSON + screenshot pointers under `test-results/kat-161/` with:
- pre/post relaunch active IDs
- run status before/after reconciliation
- applied run id + task status snapshot

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/e2e/kat-161-restart-resume.spec.ts`  
Expected: PASS with artifacts in `test-results/kat-161/`.

**Step 5: Commit**

```bash
git add tests/e2e/kat-161-restart-resume.spec.ts tests/e2e/helpers/kat-161-evidence.ts test-results/kat-161
git commit -m "test(app): add KAT-161 relaunch resume integration coverage"
```

### Task 9: Final Verification Gate and Linear Evidence Package

**Files:**
- Modify: `docs/plans/2026-03-03-kat-161-draft-apply-persistence-session-resume-implementation-plan.md` (verification notes section only)

**Step 1: Run targeted unit suites**

Run:
`npx vitest run tests/unit/main/state-store.test.ts tests/unit/main/ipc-handlers.test.ts tests/unit/preload/index.test.ts tests/unit/renderer/App.test.tsx tests/unit/renderer/hooks/useSpecDocument.test.ts tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`  
Expected: PASS.

**Step 2: Run relaunch integration suite**

Run:
`npx playwright test tests/e2e/kat-161-restart-resume.spec.ts`  
Expected: PASS.

**Step 3: Run desktop quality gate**

Run:
`npm run test:ci:local`  
Expected: PASS (or document exact failing non-KAT-161 pre-existing checks if any).

**Step 4: Prepare issue evidence comment**

Include:
- commands run + pass summaries
- `test-results/kat-161/*` artifact paths
- confirmation that interrupted runs reconcile to safe failed state
- confirmation that active space/session/spec/task state resumes after relaunch

**Step 5: Commit verification notes**

```bash
git add docs/plans/2026-03-03-kat-161-draft-apply-persistence-session-resume-implementation-plan.md
git commit -m "docs(app): finalize KAT-161 verification checklist"
```
