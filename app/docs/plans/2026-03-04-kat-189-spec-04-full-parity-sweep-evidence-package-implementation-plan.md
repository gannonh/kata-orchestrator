# KAT-189 Spec 04 Full Parity Sweep + Evidence Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify Spec 04 mock-state parity (10-14), close any remaining UI gaps found during that sweep, and ship one consolidated evidence package for KAT-189.

**Architecture:** Add one deterministic Playwright/Electron sweep test that drives the build-session timeline through mock-equivalent states and captures named artifacts. Keep fixes tightly scoped to assertions that fail in that sweep, then generate a single evidence-package markdown with parity matrix + command results + artifact links.

**Tech Stack:** Electron, React 19, TypeScript, Playwright, Vitest, shadcn/ui, Linear evidence workflow.

---

**Execution Rules:**

- Apply `@test-driven-development` for each code/test change (red -> green -> refactor).
- Apply `@verification-before-completion` before claiming KAT-189 is done.
- Keep commits small and scoped to one task.
- If parity gaps are discovered, fix only what is required for Spec 04 state parity.

### Task 1: Create Spec 04 Parity Sweep Test Harness

**Files:**

- Create: `tests/e2e/helpers/spec04-parity-seed.ts`
- Create: `tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts`

**Step 1: Write the failing E2E spec and import a missing seed helper**

```ts
import { test } from './fixtures/electron'
import { seedSpec04ParityTimeline } from './helpers/spec04-parity-seed'

test.describe('KAT-189 spec04 parity sweep @uat', () => {
  test('drives spec timeline', async ({ appWindow, electronApp }) => {
    await seedSpec04ParityTimeline({ appWindow, electronApp })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts`  
Expected: FAIL with module-not-found for `spec04-parity-seed`.

**Step 3: Implement the seed helper with deterministic run-event injection**

```ts
export async function seedSpec04ParityTimeline({ appWindow, electronApp }: SeedParams): Promise<void> {
  await installRunSubmitStub(electronApp, 'run-kat-189-e2e')
  await appWindow.getByLabel('Message input').fill('Build session parity sweep baseline.')
  await appWindow.getByRole('button', { name: 'Send' }).click()

  await broadcastRunEvent(electronApp, {
    type: 'message_appended',
    runId: 'run-kat-189-e2e',
    message: {
      id: 'agent-spec-updated',
      role: 'agent',
      content: 'Spec Updated\n\n## Goal\nShip parity evidence package.',
      createdAt: '2026-03-04T12:00:00.000Z'
    }
  })
}
```

**Step 4: Run test to verify harness passes basic flow**

Run: `npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts`  
Expected: PASS with one green test (harness smoke).

**Step 5: Commit**

```bash
git add tests/e2e/helpers/spec04-parity-seed.ts tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts
git commit -m "test(e2e): scaffold KAT-189 spec04 parity sweep harness"
```

### Task 2: Add Mock 10 and Mock 11 Assertions + Artifacts

**Files:**

- Modify: `tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts`
- Create: `test-results/kat-189/mock10-spec-draft-review.png` (artifact)
- Create: `test-results/kat-189/mock11-architecture-proposal.png` (artifact)

**Step 1: Write failing assertions for Mock 10/11 parity conditions**

```ts
await expect(appWindow.getByText('Spec Updated', { exact: true })).toBeVisible()
await expect(appWindow.getByRole('heading', { name: 'Spec', exact: true })).toBeVisible()
await expect(appWindow.getByRole('heading', { name: 'Goal', exact: true })).toBeVisible()
await expect(appWindow.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
await expect(appWindow.getByText('## Why')).toBeVisible() // mock11 architecture section
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts -g "mock10-11"`  
Expected: FAIL on missing architecture content/assertion mismatch.

**Step 3: Expand timeline seed and capture screenshots after each state settles**

```ts
await seedMock10SpecDraftState({ appWindow, electronApp })
await appWindow.screenshot({ path: 'test-results/kat-189/mock10-spec-draft-review.png', fullPage: true })

await seedMock11ArchitectureState({ appWindow, electronApp })
await appWindow.screenshot({ path: 'test-results/kat-189/mock11-architecture-proposal.png', fullPage: true })
```

**Step 4: Run test to verify Mock 10/11 assertions pass**

Run: `npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts -g "mock10-11"`  
Expected: PASS and both images created under `test-results/kat-189/`.

**Step 5: Commit**

```bash
git add tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts test-results/kat-189/mock10-spec-draft-review.png test-results/kat-189/mock11-architecture-proposal.png
git commit -m "test(e2e): cover KAT-189 mock10-11 parity states"
```

### Task 3: Add Mock 12 and Mock 13 Tech-Stack/Approval Assertions + Artifacts

**Files:**

- Modify: `tests/e2e/helpers/spec04-parity-seed.ts`
- Modify: `tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts`
- Create: `test-results/kat-189/mock12-tech-stack-a.png` (artifact)
- Create: `test-results/kat-189/mock13-tech-stack-b.png` (artifact)

**Step 1: Write failing assertions for proposal actions and state progression**

```ts
await expect(appWindow.getByRole('button', { name: 'Approve the plan...' })).toBeVisible()
await expect(appWindow.getByRole('button', { name: 'Keep the last switch...' })).toBeVisible()
await expect(appWindow.getByRole('button', { name: 'Clarifications' })).toBeVisible()
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts -g "mock12-13"`  
Expected: FAIL until timeline includes proposal/action payload.

**Step 3: Seed the decision-card payload and capture both mock12/mock13 screenshots**

```ts
const decisionProposal = [
  '## Why',
  '- Electron + TypeScript keeps desktop iteration stable',
  '',
  '## How to keep Tech stable later',
  '- Keep provider adapter boundaries explicit',
  '',
  '## Revised views',
  '- Left panel tasks synchronized with spec tasks',
  '',
  'Approve this plan with 1 check? Clarifications',
  '- Approve the plan...',
  '- Keep the last switch...'
].join('\n')
```

Then click `Approve the plan...` and verify follow-up user message appears.

**Step 4: Run test to verify Mock 12/13 assertions pass**

Run: `npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts -g "mock12-13"`  
Expected: PASS with both screenshots saved.

**Step 5: Commit**

```bash
git add tests/e2e/helpers/spec04-parity-seed.ts tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts test-results/kat-189/mock12-tech-stack-a.png test-results/kat-189/mock13-tech-stack-b.png
git commit -m "test(e2e): cover KAT-189 mock12-13 proposal and approval parity"
```

### Task 4: Add Mock 14 Task-Tracking Sync Assertions + Artifact

**Files:**

- Modify: `tests/e2e/helpers/spec04-parity-seed.ts`
- Modify: `tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts`
- Create: `test-results/kat-189/mock14-task-tracking.png` (artifact)

**Step 1: Write failing assertions for left/right task parity in tracking state**

```ts
const taskTrackingSection = appWindow.getByTestId('task-tracking-section')
await expect(taskTrackingSection).toBeVisible()
await expect(taskTrackingSection.getByText('Apply the structured draft')).toBeVisible()
await expect(appWindow.getByTestId('right-panel').getByText('Apply the structured draft')).toBeVisible()
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts -g "mock14"`  
Expected: FAIL until task snapshot injection and persisted structured tasks are aligned.

**Step 3: Inject `task_activity_snapshot` state and persist structured spec tasks before reload**

```ts
await broadcastRunEvent(electronApp, {
  type: 'task_activity_snapshot',
  snapshot: {
    sessionId,
    runId: 'run-kat-189-e2e',
    items: [
      { id: 'task-review-the-latest-prompt', title: 'Review the latest prompt', status: 'not_started', activityLevel: 'none', updatedAt: '2099-01-01T00:00:10.000Z' },
      { id: 'task-apply-the-structured-draft', title: 'Apply the structured draft', status: 'in_progress', activityLevel: 'high', activityDetail: "I'm starting implementation for the space creation flow.", activeAgentId: 'developer', updatedAt: '2099-01-01T00:00:11.000Z' },
      { id: 'task-keep-the-runtime-wiring-stable', title: 'Keep the runtime wiring stable', status: 'complete', activityLevel: 'none', updatedAt: '2099-01-01T00:00:12.000Z' }
    ],
    counts: { not_started: 1, in_progress: 1, blocked: 0, complete: 1 }
  }
})
```

**Step 4: Run test to verify Mock 14 assertions pass**

Run: `npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts -g "mock14"`  
Expected: PASS with `mock14-task-tracking.png` created.

**Step 5: Commit**

```bash
git add tests/e2e/helpers/spec04-parity-seed.ts tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts test-results/kat-189/mock14-task-tracking.png
git commit -m "test(e2e): cover KAT-189 mock14 task-tracking parity"
```

### Task 5: Close Any Sweep-Detected Parity Gaps (Conditional, Minimal)

**Files (only as needed by failing assertions):**

- Modify: `src/renderer/components/layout/LeftPanel.tsx`
- Modify: `src/renderer/components/left/LeftStatusSection.tsx`
- Modify: `src/renderer/components/center/ChatPanel.tsx`
- Modify: `src/renderer/components/center/MessageBubble.tsx`
- Modify: `src/renderer/components/right/TaskList.tsx`
- Modify: `src/renderer/components/layout/RightPanel.tsx`
- Modify: `tests/unit/renderer/left/LeftPanel.test.tsx`
- Modify: `tests/unit/renderer/left/LeftStatusSection.test.tsx`
- Modify: `tests/unit/renderer/center/ChatPanel.test.tsx`
- Modify: `tests/unit/renderer/center/MessageBubble.test.tsx`
- Modify: `tests/unit/renderer/right/TaskList.test.tsx`

**Step 1: Write/adjust one failing unit test per discovered parity gap**

Example:

```tsx
it('shows high-activity detail and specialist badge when activityLevel is high', () => {
  render(<TaskTrackingSection snapshot={snapshotWithHighActivity} />)
  expect(screen.getByText("I'm starting implementation for the space creation flow.")).toBeTruthy()
  expect(screen.getByLabelText('Active specialist')).toBeTruthy()
})
```

**Step 2: Run targeted unit test to verify it fails**

Run: `npx vitest run tests/unit/renderer/<target-file>.test.tsx`  
Expected: FAIL on current mismatch.

**Step 3: Implement minimal renderer fix for that one mismatch**

```ts
// Example pattern: preserve existing behavior and only patch failing parity path
const isHighActivity = item.activityLevel === 'high' && Boolean(item.activityDetail)
```

**Step 4: Run targeted unit + KAT-189 E2E sweep to verify pass**

Run:

```bash
npx vitest run tests/unit/renderer/<target-file>.test.tsx
npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/... tests/unit/renderer/...
git commit -m "fix(renderer): close KAT-189 parity sweep gap for <state>"
```

### Task 6: Build Consolidated Evidence Package Document

**Files:**

- Create: `docs/plans/2026-03-04-kat-189-spec-04-evidence-package.md`

**Step 1: Write the evidence package skeleton with a parity matrix**

```md
## Spec 04 Parity Matrix
| Mock | Required State | Test Assertion | Artifact | Status |
| --- | --- | --- | --- | --- |
| 10 | Spec draft review | kat-189 mock10 assertion block | test-results/kat-189/mock10-spec-draft-review.png | pass |
```

**Step 2: Run markdown lint/check (or preview render) and verify links resolve**

Run: `rg -n "test-results/kat-189/" docs/plans/2026-03-04-kat-189-spec-04-evidence-package.md`  
Expected: PASS with all 5 artifact paths present.

**Step 3: Fill command outputs and acceptance coverage summary**

Include:

- lint command result
- targeted unit/e2e command results
- parity matrix summary (`5/5 states verified`)
- deferred items block (only if owner ticket exists)

**Step 4: Re-run KAT-189 E2E to ensure artifact names match doc exactly**

Run: `npx playwright test tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts`  
Expected: PASS and file names unchanged.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-04-kat-189-spec-04-evidence-package.md
git commit -m "docs(app): add KAT-189 consolidated spec04 evidence package"
```

### Task 7: Verification Gate and Linear Completion Payload

**Files:**

- Modify: `docs/plans/2026-03-04-kat-189-spec-04-evidence-package.md` (final command output section)

**Step 1: Run final verification commands**

Run:

```bash
npm run lint
npx vitest run tests/unit/renderer/left/LeftPanel.test.tsx tests/unit/renderer/left/LeftStatusSection.test.tsx tests/unit/renderer/center/ChatPanel.test.tsx tests/unit/renderer/center/MessageBubble.test.tsx tests/unit/renderer/right/TaskList.test.tsx
npx playwright test tests/e2e/kat-160-spec-panel-parity.spec.ts tests/e2e/kat-185-agent-roster-sidebar.spec.ts tests/e2e/kat-187-approval-actions.spec.ts tests/e2e/kat-188-task-tracking-parity.spec.ts tests/e2e/kat-189-spec04-full-parity-sweep.spec.ts
```

Expected: PASS (allow documented skips for local-auth-only captures).

**Step 2: Add command summaries to evidence package doc**

```md
## Verification Results (2026-03-04)
- npm run lint: PASS
- vitest targeted renderer suite: PASS
- playwright spec04 parity suite: PASS
```

**Step 3: Prepare Linear completion comment body**

```md
## Completion Evidence (KAT-189)
- PR: <link>
- Tests: <command summary>
- Spec 04 parity: mock10-14 verified
- Artifacts: test-results/kat-189/*.png
- Evidence package: docs/plans/2026-03-04-kat-189-spec-04-evidence-package.md
```

**Step 4: Re-check git status is clean except intended files**

Run: `git status --short`  
Expected: only intended tracked changes.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-04-kat-189-spec-04-evidence-package.md
git commit -m "docs(app): finalize KAT-189 verification gate results"
```
