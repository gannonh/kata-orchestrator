# KAT-162 End-to-End Demo Proof + Quality Gate for Slice A Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add one deterministic, CI-compatible end-to-end proof scenario for Slice A (`prompt -> run -> draft apply -> persist -> relaunch`) and produce linked evidence that satisfies KAT-162 hard-gate requirements.

**Architecture:** Reuse existing Playwright Electron fixtures and deterministic `run:submit`/`run:event` injection patterns from prior Slice A verification tickets. Build a focused KAT-162 spec plus a small evidence-writer helper, then execute full desktop quality gate and publish an evidence package document mapped to acceptance items.

**Tech Stack:** Electron, React 19, TypeScript, Playwright, Vitest, npm workspaces, Linear.

---

**Execution Rules:**

- Apply `@test-driven-development` on every test/code change (red -> green -> refactor).
- Apply `@verification-before-completion` before posting KAT-162 completion evidence.
- Keep changes DRY and YAGNI; avoid broad renderer refactors in this verification ticket.
- Keep commits small and scoped to one task.

### Task 1: Add KAT-162 Evidence Writer Helper

**Files:**
- Create: `tests/e2e/helpers/kat-162-evidence.ts`
- Test (via import): `tests/e2e/kat-162-slice-a-demo-proof.spec.ts`

**Step 1: Write the failing helper import in a new test stub**

```ts
import { writeKat162Evidence } from './helpers/kat-162-evidence'

void writeKat162Evidence
```

**Step 2: Run test command to verify it fails**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: FAIL with module-not-found for `./helpers/kat-162-evidence`.

**Step 3: Write minimal helper implementation**

```ts
import fs from 'node:fs/promises'
import path from 'node:path'

type Kat162EvidenceInput = {
  testName: string
  stateFilePath: string
  runId: string
  artifacts: string[]
  assertions: Record<string, unknown>
}

export async function writeKat162Evidence(input: Kat162EvidenceInput): Promise<string> {
  const outputDir = path.resolve(process.cwd(), 'test-results/kat-162')
  await fs.mkdir(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `${input.testName}-${Date.now()}.json`)
  await fs.writeFile(
    outputPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), ...input }, null, 2),
    'utf8'
  )
  return outputPath
}
```

**Step 4: Run command to verify helper resolves**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: FAIL now on missing test file/body, not helper import.

**Step 5: Commit**

```bash
git add tests/e2e/helpers/kat-162-evidence.ts
git commit -m "test(e2e): add KAT-162 evidence writer helper"
```

### Task 2: Scaffold KAT-162 E2E Scenario (Red -> Green Smoke)

**Files:**
- Create: `tests/e2e/kat-162-slice-a-demo-proof.spec.ts`
- Modify: `tests/e2e/helpers/run-event.ts` (only if shared helper behavior needs extension)

**Step 1: Write a failing spec skeleton with required tags and one assertion**

```ts
import { expect, test } from './fixtures/electron'
import { ensureSendButtonReady, ensureWorkspaceShell } from './helpers/shell-view'

test.describe('KAT-162 slice A demo proof @ci @quality-gate @uat', () => {
  test('covers prompt to relaunch continuity flow', async ({ appWindow }) => {
    await ensureWorkspaceShell(appWindow)
    await ensureSendButtonReady(appWindow)
    await expect(appWindow.getByLabel('Message input')).toBeVisible()
  })
})
```

**Step 2: Run the new spec and verify first failure after adding next assertion**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: FAIL when you add a not-yet-implemented deterministic run assertion.

**Step 3: Implement deterministic run submit stub and baseline send action**

```ts
await electronApp.evaluate(({ ipcMain }) => {
  try { ipcMain.removeHandler('run:submit') } catch {}
  ipcMain.handle('run:submit', async () => ({ runId: 'run-kat-162-e2e' }))
})

await appWindow.getByLabel('Message input').fill('KAT-162 demo proof baseline prompt')
await appWindow.getByRole('button', { name: 'Send' }).click()
await expect(appWindow.getByTestId('message-list').getByText('KAT-162 demo proof baseline prompt')).toBeVisible()
```

**Step 4: Re-run spec and verify smoke test passes**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: PASS with one green test (prompt send + stubbed run submit).

**Step 5: Commit**

```bash
git add tests/e2e/kat-162-slice-a-demo-proof.spec.ts
git commit -m "test(e2e): scaffold KAT-162 demo proof scenario"
```

### Task 3: Add Draft-Apply Assertions and Visual Artifacts

**Files:**
- Modify: `tests/e2e/kat-162-slice-a-demo-proof.spec.ts`
- Create runtime artifacts: `test-results/kat-162/01-prompt-submitted.png`, `test-results/kat-162/02-run-completed-with-draft.png`, `test-results/kat-162/03-draft-applied-spec.png`

**Step 1: Write failing assertions for run-complete and draft-apply state**

```ts
await expect(appWindow.getByRole('status', { name: 'Stopped' })).toBeVisible({ timeout: 10_000 })
const rightPanel = appWindow.getByTestId('right-panel')
await expect(rightPanel.getByRole('button', { name: 'Apply Draft to Spec' })).toBeVisible({ timeout: 10_000 })
await rightPanel.getByRole('button', { name: 'Apply Draft to Spec' }).click()
await expect(rightPanel.getByRole('heading', { name: 'Goal', exact: true })).toBeVisible({ timeout: 10_000 })
await expect(rightPanel.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible({ timeout: 10_000 })
```

**Step 2: Run spec and verify it fails on missing run-event progression**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: FAIL on `Stopped` or draft button visibility.

**Step 3: Inject deterministic run events and add screenshots**

```ts
import { broadcastRunEvent } from './helpers/run-event'

await broadcastRunEvent(electronApp, {
  type: 'message_appended',
  runId: 'run-kat-162-e2e',
  message: {
    id: 'agent-kat-162-draft-ready',
    role: 'agent',
    content: ['## Goal', 'KAT-162 demo proof goal.', '', '## Tasks', '- [ ] Capture evidence'].join('\n'),
    createdAt: '2026-03-05T10:00:00.000Z'
  }
})
await broadcastRunEvent(electronApp, { type: 'run_state_changed', runState: 'idle' })

await appWindow.screenshot({ path: 'test-results/kat-162/01-prompt-submitted.png', fullPage: true })
await appWindow.screenshot({ path: 'test-results/kat-162/02-run-completed-with-draft.png', fullPage: true })
await appWindow.screenshot({ path: 'test-results/kat-162/03-draft-applied-spec.png', fullPage: true })
```

**Step 4: Re-run spec and verify draft-apply assertions pass**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: PASS through prompt -> draft apply checkpoints.

**Step 5: Commit**

```bash
git add tests/e2e/kat-162-slice-a-demo-proof.spec.ts
git commit -m "test(e2e): add KAT-162 prompt-to-draft-apply proof assertions"
```

### Task 4: Add Persistence + Relaunch Proof in Same Scenario

**Files:**
- Modify: `tests/e2e/kat-162-slice-a-demo-proof.spec.ts`
- Reuse patterns from: `tests/e2e/kat-161-restart-resume.spec.ts`
- Create runtime artifact: `test-results/kat-162/04-post-relaunch-restored-session.png`

**Step 1: Add failing relaunch assertions**

```ts
await expect(relaunchedWindow.getByTestId('app-shell-root')).toBeVisible()
await expect(relaunchedWindow.getByRole('heading', { name: 'Home' })).toHaveCount(0)
await expect(relaunchedWindow.getByTestId('right-panel').getByText('Applied from run-kat-162-e2e')).toBeVisible()
await expect(relaunchedWindow.getByTestId('message-list').getByText('KAT-162 demo proof baseline prompt')).toBeVisible()
```

**Step 2: Run spec and verify relaunch assertions fail first**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: FAIL before relaunch state-copy + launch wiring is complete.

**Step 3: Implement relaunch block using copied state file**

```ts
const relaunchStateFilePath = path.join(managedTestRootDir, 'state-kat-162-relaunch.json')
await fsPromises.copyFile(managedStateFilePath, relaunchStateFilePath)

const relaunched = await electron.launch({
  args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox', mainEntry] : [mainEntry],
  env: {
    ...process.env,
    KATA_WORKSPACE_BASE_DIR: managedWorkspaceBaseDir,
    KATA_REPO_CACHE_BASE_DIR: managedRepoCacheBaseDir,
    KATA_STATE_FILE: relaunchStateFilePath,
    ...(process.env.CI || process.env.KATA_E2E_HEADLESS ? { KATA_E2E_HEADLESS: '1' } : {})
  }
})
```

Then capture:

```ts
await relaunchedWindow.screenshot({
  path: 'test-results/kat-162/04-post-relaunch-restored-session.png',
  fullPage: true
})
```

**Step 4: Re-run spec and verify full flow passes**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: PASS for full prompt -> run -> apply -> persist -> relaunch scenario.

**Step 5: Commit**

```bash
git add tests/e2e/kat-162-slice-a-demo-proof.spec.ts
git commit -m "test(e2e): add KAT-162 relaunch persistence proof"
```

### Task 5: Emit Structured Evidence JSON + Package Markdown

**Files:**
- Modify: `tests/e2e/kat-162-slice-a-demo-proof.spec.ts`
- Create: `docs/plans/2026-03-05-kat-162-evidence-package.md`

**Step 1: Add failing expectation that evidence JSON path is returned**

```ts
const evidencePath = await writeKat162Evidence({
  testName: 'kat-162-prompt-run-apply-persist-relaunch',
  stateFilePath: relaunchStateFilePath,
  runId: 'run-kat-162-e2e',
  artifacts: [],
  assertions: {}
})
expect(evidencePath).toContain('test-results/kat-162/')
```

**Step 2: Run spec and verify failure until full payload is wired**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: FAIL if payload or path handling is incomplete.

**Step 3: Populate full evidence payload and draft markdown package**

```ts
const artifacts = [
  'test-results/kat-162/01-prompt-submitted.png',
  'test-results/kat-162/02-run-completed-with-draft.png',
  'test-results/kat-162/03-draft-applied-spec.png',
  'test-results/kat-162/04-post-relaunch-restored-session.png'
]

await writeKat162Evidence({
  testName: 'kat-162-prompt-run-apply-persist-relaunch',
  stateFilePath: relaunchStateFilePath,
  runId: 'run-kat-162-e2e',
  artifacts,
  assertions: {
    promptVisibleAfterRelaunch: true,
    appliedRunBadgeVisibleAfterRelaunch: true,
    workspaceShellRestoredWithoutHome: true
  }
})
```

`docs/plans/2026-03-05-kat-162-evidence-package.md` content should include:

- command output summary section
- acceptance mapping table (`prompt`, `run`, `apply`, `persist`, `relaunch`)
- artifact list
- follow-up issues section (explicitly `None` or list issue IDs)

**Step 4: Re-run spec and verify JSON evidence writes successfully**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: PASS and new `test-results/kat-162/*.json` file created.

**Step 5: Commit**

```bash
git add tests/e2e/helpers/kat-162-evidence.ts tests/e2e/kat-162-slice-a-demo-proof.spec.ts docs/plans/2026-03-05-kat-162-evidence-package.md
git commit -m "docs(test): add KAT-162 evidence package mapping and json output"
```

### Task 6: Run Full Quality Gate and Finalize Linear-Ready Evidence Summary

**Files:**
- Modify: `docs/plans/2026-03-05-kat-162-evidence-package.md`

**Step 1: Run desktop quality gate**

Run: `npm run test:app:quality-gate`  
Expected: PASS (`lint`, `test:app:coverage`, and full app E2E all green including KAT-162 test).

**Step 2: If gate fails, write one failing test note and stop for fix**

Add temporary notes in evidence doc:

```md
## Quality Gate Failures (If Any)
- Command:
- Failing suite/spec:
- First failing assertion:
- Follow-up issue:
```

**Step 3: On pass, record exact command and test references**

Update markdown with:

- timestamp
- command used
- pass summary
- direct references:
  - `tests/e2e/kat-162-slice-a-demo-proof.spec.ts`
  - `test-results/kat-162/01-prompt-submitted.png`
  - `test-results/kat-162/02-run-completed-with-draft.png`
  - `test-results/kat-162/03-draft-applied-spec.png`
  - `test-results/kat-162/04-post-relaunch-restored-session.png`
  - generated evidence JSON filename

**Step 4: Re-run focused KAT-162 spec for deterministic reconfirmation**

Run: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`  
Expected: PASS on a clean rerun.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-05-kat-162-evidence-package.md
git commit -m "docs: finalize KAT-162 quality-gate evidence summary"
```

## Completion Checklist (Before Moving Issue State)

- KAT-162 scenario exists and passes in CI-compatible mode.
- Quality gate passes from repo root.
- Evidence artifacts and JSON summary are present under `test-results/kat-162/`.
- Evidence package markdown maps all hard-gate items to proof.
- Any residual debt is captured as explicit follow-up ticket IDs.

