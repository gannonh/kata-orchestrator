# KAT-188 Task Tracking State Parity (Mock 14) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship final-fidelity task tracking parity for build-session mock 14 with real-time left-panel updates and synchronized task state across left/right panels.

**Architecture:** Add a typed task-activity snapshot contract emitted from main runtime events, then consume that snapshot in renderer conversation state and panel components. Keep persisted spec task checkbox status authoritative while layering transient activity detail on top for high-activity states.

**Tech Stack:** Electron IPC, TypeScript, React 19, shadcn/ui, Vitest + Testing Library, Playwright Electron E2E.

---

**Execution Rules:**
- Apply `@test-driven-development` for every task (red -> green -> refactor).
- Apply `@verification-before-completion` before closing KAT-188.
- Keep commits small and frequent (one commit per task).

### Task 1: Add Shared Task Tracking Contracts

**Files:**
- Create: `src/shared/types/task-tracking.ts`
- Create: `tests/unit/shared/types/task-tracking.test.ts`
- Modify: `src/renderer/types/session-runtime-adapter.ts`

**Step 1: Write the failing shared type tests**

```ts
import { describe, expect, it } from 'vitest'

import {
  TASK_TRACKING_STATUSES,
  TASK_ACTIVITY_LEVELS,
  type TaskActivitySnapshot,
} from '../../../../src/shared/types/task-tracking'

describe('task-tracking shared types', () => {
  it('exports status and activity enums', () => {
    expect(TASK_TRACKING_STATUSES).toEqual(['not_started', 'in_progress', 'blocked', 'complete'])
    expect(TASK_ACTIVITY_LEVELS).toEqual(['none', 'low', 'high'])
  })

  it('supports typed snapshot shape', () => {
    const snapshot: TaskActivitySnapshot = {
      sessionId: 'session-1',
      runId: 'run-1',
      items: [],
      counts: { not_started: 0, in_progress: 0, blocked: 0, complete: 0 }
    }

    expect(snapshot.counts.in_progress).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/shared/types/task-tracking.test.ts`  
Expected: FAIL with missing shared type module.

**Step 3: Implement shared contracts and runtime event type extension**

```ts
export const TASK_TRACKING_STATUSES = ['not_started', 'in_progress', 'blocked', 'complete'] as const
export type TaskTrackingStatus = (typeof TASK_TRACKING_STATUSES)[number]

export const TASK_ACTIVITY_LEVELS = ['none', 'low', 'high'] as const
export type TaskActivityLevel = (typeof TASK_ACTIVITY_LEVELS)[number]

export type TaskTrackingItem = {
  id: string
  title: string
  status: TaskTrackingStatus
  activityLevel: TaskActivityLevel
  activityDetail?: string
  activeAgentId?: string
  updatedAt: string
}

export type TaskActivitySnapshot = {
  sessionId: string
  runId: string
  items: TaskTrackingItem[]
  counts: Record<TaskTrackingStatus, number>
}
```

And extend `SessionRuntimeEvent`:

```ts
type TaskActivitySnapshotEvent = {
  type: 'task_activity_snapshot'
  snapshot: TaskActivitySnapshot
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/shared/types/task-tracking.test.ts tests/unit/renderer/types/spec-document.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/types/task-tracking.ts src/renderer/types/session-runtime-adapter.ts tests/unit/shared/types/task-tracking.test.ts
git commit -m "feat(app): add shared task activity snapshot contracts"
```

### Task 2: Stabilize Spec Task IDs for Cross-Panel Sync

**Files:**
- Modify: `src/renderer/components/right/spec-parser.ts`
- Modify: `tests/unit/renderer/right/spec-parser.test.ts`
- Modify: `tests/unit/renderer/right/spec-task-markdown.test.ts`

**Step 1: Write failing parser tests for stable task IDs**

```ts
it('assigns stable task ids derived from title text', () => {
  const markdown = ['## Tasks', '- [ ] Build spec panel', '- [ ] Build spec panel'].join('\n')
  const parsed = parseStructuredSpec(markdown)

  expect(parsed.tasks[0]?.id).toBe('task-build-spec-panel')
  expect(parsed.tasks[1]?.id).toBe('task-build-spec-panel-2')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/spec-parser.test.ts`  
Expected: FAIL because ids are currently sequence-based (`task-1`, `task-2`).

**Step 3: Implement deterministic ID generation in parser**

```ts
function toStableTaskId(title: string, seen: Map<string, number>): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'task'

  const current = (seen.get(slug) ?? 0) + 1
  seen.set(slug, current)

  return current === 1 ? `task-${slug}` : `task-${slug}-${current}`
}
```

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/right/spec-parser.test.ts tests/unit/renderer/right/spec-task-markdown.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/right/spec-parser.ts tests/unit/renderer/right/spec-parser.test.ts tests/unit/renderer/right/spec-task-markdown.test.ts
git commit -m "feat(renderer): stabilize parsed spec task ids for left-right sync"
```

### Task 3: Implement Main Task Activity Projector

**Files:**
- Create: `src/main/task-activity-projector.ts`
- Create: `tests/unit/main/task-activity-projector.test.ts`
- Modify: `src/main/orchestrator.ts`

**Step 1: Write failing unit tests for projector transitions**

```ts
import { describe, expect, it } from 'vitest'
import { createTaskActivityProjector } from '../../../src/main/task-activity-projector'

it('marks first unresolved task as in_progress on pending state', () => {
  const projector = createTaskActivityProjector()
  const snapshot = projector.onRunPending({ sessionId: 's1', runId: 'r1', tasks: ['A', 'B'] })

  expect(snapshot.items[0]?.status).toBe('in_progress')
  expect(snapshot.items[0]?.activityLevel).toBe('high')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/task-activity-projector.test.ts`  
Expected: FAIL with missing projector module.

**Step 3: Implement minimal deterministic projector**

```ts
export function createTaskActivityProjector() {
  // in-memory map keyed by sessionId
  // onRunPending -> seed snapshot and mark first unresolved task active
  // onMessageUpdate -> update activityDetail on active task
  // onRunSettled -> clear high activity and preserve status
}
```

Include `buildCounts(items)` helper that always emits all status buckets.

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/main/task-activity-projector.test.ts tests/unit/main/orchestrator.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/task-activity-projector.ts src/main/orchestrator.ts tests/unit/main/task-activity-projector.test.ts
git commit -m "feat(main): add deterministic task activity projector"
```

### Task 4: Emit Task Activity Snapshots from Runtime Events

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `tests/unit/main/ipc-handlers.test.ts`

**Step 1: Write failing IPC handler tests for `task_activity_snapshot` emission**

```ts
it('emits task_activity_snapshot during pending and message updates', async () => {
  // submit run
  // invoke onEvent({ type: 'run_state_changed', runState: 'pending' })
  // invoke onEvent({ type: 'message_updated', ... })
  // assert sender.send called with event.type === 'task_activity_snapshot'
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts`  
Expected: FAIL because snapshot events are not emitted.

**Step 3: Wire projector into run lifecycle in IPC handlers**

- Build task list from applied spec document first; fallback to run draft tasks.
- Emit `task_activity_snapshot` alongside existing run/message events.
- Ensure events include `sessionId` + `runId` from active run.

```ts
if (runtimeEvent.type === 'run_state_changed' && runtimeEvent.runState === 'pending') {
  const snapshot = projector.onRunPending(...)
  event.sender.send(RUN_EVENT_CHANNEL, { type: 'task_activity_snapshot', snapshot })
}
```

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/main/ipc-handlers.test.ts tests/unit/main/state-store.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts tests/unit/main/ipc-handlers.test.ts
git commit -m "feat(main): emit task activity snapshot events for build-session runs"
```

### Task 5: Consume Snapshot Events in Conversation State Hook

**Files:**
- Modify: `src/renderer/types/session-conversation.ts`
- Modify: `src/renderer/components/center/sessionConversationState.ts`
- Modify: `src/renderer/hooks/useIpcSessionConversation.ts`
- Modify: `tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`

**Step 1: Write failing hook tests for snapshot state handling**

```ts
it('stores taskActivitySnapshot from runtime events', () => {
  onRunEventCallback?.({
    type: 'task_activity_snapshot',
    snapshot: {
      sessionId: 's-1', runId: 'r-1', items: [],
      counts: { not_started: 1, in_progress: 0, blocked: 0, complete: 0 }
    }
  })

  expect(result.current.state.taskActivitySnapshot?.runId).toBe('r-1')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts`  
Expected: FAIL because snapshot is not represented in state.

**Step 3: Implement reducer/event integration**

- Add `taskActivitySnapshot?: TaskActivitySnapshot` to `SessionConversationState`.
- Add event type + reducer branch (`TASK_ACTIVITY_SNAPSHOT_RECEIVED`).
- Clear snapshot on session reset.

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/hooks/useIpcSessionConversation.test.ts tests/unit/renderer/center/ChatPanel.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/types/session-conversation.ts src/renderer/components/center/sessionConversationState.ts src/renderer/hooks/useIpcSessionConversation.ts tests/unit/renderer/hooks/useIpcSessionConversation.test.ts
git commit -m "feat(renderer): track task activity snapshots in conversation state"
```

### Task 6: Build Left Task Tracking Section UI (No-Activity + High-Activity)

**Files:**
- Create: `src/renderer/components/left/TaskTrackingSection.tsx`
- Create: `tests/unit/renderer/left/TaskTrackingSection.test.tsx`
- Modify: `src/renderer/components/left/LeftStatusSection.tsx`
- Modify: `tests/unit/renderer/left/LeftStatusSection.test.tsx`

**Step 1: Write failing component tests for row variants**

```tsx
it('renders compact rows for no-activity state', () => {
  render(<TaskTrackingSection snapshot={snapshotNoActivity} />)
  expect(screen.queryByText(/I.m starting implementation/i)).toBeNull()
})

it('renders detail line and specialist badge for high-activity rows', () => {
  render(<TaskTrackingSection snapshot={snapshotHighActivity} />)
  expect(screen.getByText(/I.m starting implementation/i)).toBeTruthy()
  expect(screen.getAllByLabelText('Active specialist')).not.toHaveLength(0)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/left/TaskTrackingSection.test.tsx`  
Expected: FAIL with missing component.

**Step 3: Implement section and integrate with `LeftStatusSection`**

```tsx
export function TaskTrackingSection({ snapshot }: { snapshot?: TaskActivitySnapshot }) {
  // render counts header
  // render task rows with status icon + title + disclosure chevron
  // show detail row only when activityLevel === 'high'
}
```

Then render it under status summary in `LeftStatusSection` when snapshot exists.

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/left/TaskTrackingSection.test.tsx tests/unit/renderer/left/LeftStatusSection.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/left/TaskTrackingSection.tsx src/renderer/components/left/LeftStatusSection.tsx tests/unit/renderer/left/TaskTrackingSection.test.tsx tests/unit/renderer/left/LeftStatusSection.test.tsx
git commit -m "feat(renderer): add left task tracking section with activity detail states"
```

### Task 7: Wire AppShell and LeftPanel to Shared Snapshot Source

**Files:**
- Modify: `src/renderer/components/layout/AppShell.tsx`
- Modify: `src/renderer/components/layout/LeftPanel.tsx`
- Modify: `src/renderer/components/center/ChatPanel.tsx`
- Modify: `tests/unit/renderer/AppShell.test.tsx`
- Modify: `tests/unit/renderer/left/LeftPanel.test.tsx`

**Step 1: Write failing integration tests for snapshot propagation**

```tsx
it('passes task snapshot from chat runtime to left panel status section', () => {
  // mock ChatPanel callback with snapshot
  // assert left panel renders in-progress count from snapshot
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/left/LeftPanel.test.tsx`  
Expected: FAIL because snapshot wiring is absent.

**Step 3: Implement wiring through shell props**

- Add `onTaskActivitySnapshotChange` callback prop in `ChatPanel`.
- Store snapshot in `AppShell` state keyed by active session.
- Pass snapshot into `LeftPanel` and down to `LeftStatusSection`.

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/layout/AppShell.tsx src/renderer/components/layout/LeftPanel.tsx src/renderer/components/center/ChatPanel.tsx tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx
git commit -m "feat(renderer): wire task activity snapshots from runtime to left panel"
```

### Task 8: Merge Snapshot Activity into Right Task List Rendering

**Files:**
- Modify: `src/renderer/components/right/TaskList.tsx`
- Modify: `src/renderer/components/right/SpecSections.tsx`
- Modify: `src/renderer/components/layout/RightPanel.tsx`
- Modify: `tests/unit/renderer/right/SpecTab.structured.test.tsx`
- Modify: `tests/unit/renderer/right/RightPanel.draft-flow.test.tsx`

**Step 1: Write failing tests for right task activity detail rendering**

```tsx
it('shows high-activity detail in structured task rows', () => {
  render(<RightPanel ... snapshot={highActivitySnapshot} />)
  expect(screen.getByText(/starting implementation for the space creation/i)).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/right/SpecTab.structured.test.tsx tests/unit/renderer/right/RightPanel.draft-flow.test.tsx`  
Expected: FAIL because TaskList does not consume snapshot detail.

**Step 3: Implement snapshot overlay merge for task rows**

```ts
const mergedTasks = document.tasks.map((task) => {
  const activity = snapshotMap.get(task.id)
  return {
    ...task,
    status: activity?.status ?? task.status,
    activityDetail: activity?.activityDetail,
    activityLevel: activity?.activityLevel ?? 'none'
  }
})
```

Keep checkbox toggles delegated to `useSpecDocument.toggleTask`.

**Step 4: Run tests to verify it passes**

Run: `npx vitest run tests/unit/renderer/right/SpecTab.structured.test.tsx tests/unit/renderer/right/RightPanel.draft-flow.test.tsx tests/unit/renderer/right/RightPanel.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/right/TaskList.tsx src/renderer/components/right/SpecSections.tsx src/renderer/components/layout/RightPanel.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx tests/unit/renderer/right/RightPanel.draft-flow.test.tsx
git commit -m "feat(renderer): overlay runtime activity states on spec task list"
```

### Task 9: Add KAT-188 E2E Parity Evidence Capture

**Files:**
- Create: `tests/e2e/kat-188-task-tracking-parity.spec.ts`
- Create: `test-results/kat-188/mock14-task-tracking.png` (artifact)
- Create: `test-results/kat-188/task-detail-no-activity.png` (artifact)
- Create: `test-results/kat-188/task-detail-high-activity.png` (artifact)
- Create: `test-results/kat-188/mock19-wave-merge-strategy.png` (artifact)

**Step 1: Write failing E2E test for required captures**

```ts
test('captures mock14 + detail parity states for task tracking', async ({ appWindow }) => {
  await ensureWorkspaceShell(appWindow)
  // drive run
  // apply draft
  // capture no-activity and high-activity task states
})
```

**Step 2: Run test to verify it fails initially**

Run: `npx playwright test tests/e2e/kat-188-task-tracking-parity.spec.ts`  
Expected: FAIL until snapshot-driven task activity UI is wired.

**Step 3: Implement selectors/assertions and capture paths**

Required assertions before screenshots:
- left panel task rows visible with at least one `in_progress` marker
- right panel task rows aligned to same task titles
- high-activity detail line present in at least one task row

**Step 4: Run test to verify it passes and artifacts are created**

Run: `npx playwright test tests/e2e/kat-188-task-tracking-parity.spec.ts`  
Expected: PASS with images in `test-results/kat-188/`.

**Step 5: Commit**

```bash
git add tests/e2e/kat-188-task-tracking-parity.spec.ts test-results/kat-188/*.png
git commit -m "test(e2e): add KAT-188 task tracking parity evidence capture"
```

### Task 10: Verification Gate and Evidence Checklist

**Files:**
- Modify: `docs/plans/2026-03-04-kat-188-task-tracking-state-parity-implementation-plan.md` (verification notes section)

**Step 1: Run lint + targeted unit test suites**

Run:

```bash
npm run lint
npx vitest run \
  tests/unit/shared/types/task-tracking.test.ts \
  tests/unit/main/task-activity-projector.test.ts \
  tests/unit/main/ipc-handlers.test.ts \
  tests/unit/renderer/hooks/useIpcSessionConversation.test.ts \
  tests/unit/renderer/left/TaskTrackingSection.test.tsx \
  tests/unit/renderer/left/LeftPanel.test.tsx \
  tests/unit/renderer/right/SpecTab.structured.test.tsx \
  tests/unit/renderer/right/RightPanel.draft-flow.test.tsx \
  tests/unit/renderer/AppShell.test.tsx
```

Expected: PASS.

**Step 2: Run quality-gate E2E + KAT-188 parity test**

Run:

```bash
npm run test:e2e:quality-gate
npx playwright test tests/e2e/kat-188-task-tracking-parity.spec.ts
```

Expected: PASS.

**Step 3: Validate acceptance checklist**

Checklist:
- Left panel task tracking matches mock 14 structure.
- No-activity and high-activity detail states are both verified.
- Left/right task states remain synchronized.
- Runtime snapshot updates are deterministic and replay-safe.
- Evidence images exist under `test-results/kat-188/`.

**Step 4: Prepare Linear evidence note**

Include:
- unit and E2E command outputs
- artifact paths in `test-results/kat-188/`
- note confirming comment/thread deferment remains intentional and unchanged

**Step 5: Commit verification notes**

```bash
git add docs/plans/2026-03-04-kat-188-task-tracking-state-parity-implementation-plan.md
git commit -m "docs(app): finalize KAT-188 verification checklist"
```

## Verification Notes (Executed 2026-03-04)

### Command Results

- `npm run lint` ✅ PASS
- `npx vitest run tests/unit/shared/types/task-tracking.test.ts tests/unit/main/task-activity-projector.test.ts tests/unit/main/ipc-handlers.test.ts tests/unit/renderer/hooks/useIpcSessionConversation.test.ts tests/unit/renderer/left/TaskTrackingSection.test.tsx tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/right/SpecTab.structured.test.tsx tests/unit/renderer/right/RightPanel.draft-flow.test.tsx tests/unit/renderer/AppShell.test.tsx` ✅ PASS
- `npm run test:e2e:quality-gate` ✅ PASS (15 passed, 1 skipped)
- `npx playwright test tests/e2e/kat-188-task-tracking-parity.spec.ts` ✅ PASS

### Evidence Artifacts

- `test-results/kat-188/mock14-task-tracking.png`
- `test-results/kat-188/task-detail-no-activity.png`
- `test-results/kat-188/task-detail-high-activity.png`
- `test-results/kat-188/mock19-wave-merge-strategy.png`

### Acceptance Checklist Confirmation

- Left panel task tracking layout and progression states match mock 14 structure.
- No-activity and high-activity detail states are both captured and asserted.
- Left and right task rows are synchronized by stable task IDs.
- Runtime snapshot projector remains deterministic and replay-safe.
- Comment/thread deferment behavior remains unchanged and intentional.
