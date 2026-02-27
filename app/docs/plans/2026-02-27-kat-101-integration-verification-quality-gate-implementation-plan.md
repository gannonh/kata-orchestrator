# KAT-101 Integration Verification and Quality Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove Slice 0 integration end-to-end by enforcing automated quality-gate assertions for Home startup, create-space persistence across relaunch, and persisted state-file correctness with evidence artifacts.

**Architecture:** Extend the existing Playwright managed-provisioning integration suite instead of introducing a new harness. Keep deterministic temp-dir fixtures for CI/local reproducibility, then add one controlled-state-file persistence path and one default-userData persistence path. Emit structured evidence JSON per run so success cases produce artifacts, not just failure traces.

**Tech Stack:** Electron, Playwright (`@playwright/test`), Node `fs/path`, TypeScript, existing `npm run test:ci:local` gate.

---

Implementation guidance:
- Apply @test-driven-development for each task.
- Apply @verification-before-completion before claiming done.
- Use @playwright for E2E authoring/debugging.
- Keep commits small and frequent.

### Task 1: Add failing quality-gate persistence assertions for controlled state path

**Files:**
- Modify: `tests/e2e/managed-provisioning.spec.ts`

**Step 1: Write the failing test assertions**

Add/adjust the existing persistence test so it includes `@quality-gate` and requires state-file payload verification:

```ts
test('persists spaces across app restart @quality-gate', async ({
  appWindow,
  electronApp,
  managedStateFilePath,
  // ...
}) => {
  // existing create-space flow

  await expect.poll(() => fs.existsSync(managedStateFilePath)).toBe(true)
  const persistedRaw = await fsPromises.readFile(managedStateFilePath, 'utf8')
  const persisted = JSON.parse(persistedRaw) as {
    spaces: Record<string, { name: string; workspaceMode?: string; branch: string; rootPath: string }>
  }

  const persistedSpace = Object.values(persisted.spaces).find((space) => space.name === 'Persisted Space')
  expect(persistedSpace).toBeDefined()
  expect(persistedSpace?.workspaceMode).toBe('managed')
  expect(persistedSpace?.branch).toBe('main')
  expect(persistedSpace?.rootPath.endsWith('/repo')).toBe(true)
})
```

**Step 2: Run test to verify it fails first**

Run: `npm run test:e2e:quality-gate -- --grep "persists spaces across app restart"`
Expected: FAIL before implementation is complete (missing assertions/tag or assertion failure).

**Step 3: Implement minimal code to satisfy the test**

In `tests/e2e/managed-provisioning.spec.ts`:
- add `@quality-gate` tag to the persistence test name
- add file existence + JSON payload assertions (as above)
- keep relaunch verification (`Select space Persisted Space`) intact

**Step 4: Re-run test to verify pass**

Run: `npm run test:e2e:quality-gate -- --grep "persists spaces across app restart"`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/e2e/managed-provisioning.spec.ts
git commit -m "test(app): enforce quality-gate persistence assertions for KAT-101"
```

### Task 2: Add default userData `app-state.json` integration test (no KATA_STATE_FILE override)

**Files:**
- Modify: `tests/e2e/managed-provisioning.spec.ts`

**Step 1: Write failing E2E test**

Add a new test that launches Electron without a usable `KATA_STATE_FILE`, creates a space, then verifies default userData state path:

```ts
test('writes state to default userData/app-state.json when KATA_STATE_FILE is absent @quality-gate @ci', async ({
  managedTestRootDir,
  managedWorkspaceBaseDir,
  managedRepoCacheBaseDir
}) => {
  const launchArgs = process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox', mainEntry] : [mainEntry]

  const appWithoutOverride = await electron.launch({
    args: launchArgs,
    env: {
      ...process.env,
      HOME: managedTestRootDir,
      KATA_STATE_FILE: '',
      KATA_WORKSPACE_BASE_DIR: managedWorkspaceBaseDir,
      KATA_REPO_CACHE_BASE_DIR: managedRepoCacheBaseDir
    }
  })

  const userDataPath = await appWithoutOverride.evaluate(async ({ app }) => app.getPath('userData'))
  const defaultStatePath = path.join(userDataPath, 'app-state.json')

  // create space via UI, close app, then assert defaultStatePath exists and contains created space
})
```

**Step 2: Run test to verify it fails first**

Run: `npm run test:e2e:ci -- --grep "default userData/app-state.json"`
Expected: FAIL before implementation is complete.

**Step 3: Implement minimal test flow**

In `tests/e2e/managed-provisioning.spec.ts`:
- complete the test flow: Home visible -> create managed space -> close app
- assert `defaultStatePath` exists
- parse JSON and assert created space data exists
- keep cleanup safe with `finally` and `close().catch(...)`

**Step 4: Re-run test to verify pass**

Run: `npm run test:e2e:ci -- --grep "default userData/app-state.json"`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/e2e/managed-provisioning.spec.ts
git commit -m "test(app): verify default userData app-state persistence path"
```

### Task 3: Add structured evidence artifact output for successful integration runs

**Files:**
- Create: `tests/e2e/helpers/evidence.ts`
- Modify: `tests/e2e/managed-provisioning.spec.ts`

**Step 1: Write failing usage in test**

In `tests/e2e/managed-provisioning.spec.ts`, call a helper that does not yet exist:

```ts
import { writeKat101Evidence } from './helpers/evidence'

await writeKat101Evidence({
  testName: 'persists-spaces-across-app-restart',
  stateFilePath: managedStateFilePath,
  spaceName: 'Persisted Space',
  preRelaunchCount,
  postRelaunchCount,
  persistedSpace
})
```

**Step 2: Run test to verify it fails first**

Run: `npm run test:e2e:quality-gate -- --grep "persists spaces across app restart"`
Expected: FAIL (missing helper/module).

**Step 3: Implement minimal helper and wire both KAT-101 tests**

Create `tests/e2e/helpers/evidence.ts`:

```ts
import fs from 'node:fs/promises'
import path from 'node:path'

export async function writeKat101Evidence(input: {
  testName: string
  stateFilePath: string
  spaceName: string
  preRelaunchCount: number
  postRelaunchCount: number
  persistedSpace: unknown
}): Promise<string> {
  const outDir = path.resolve(process.cwd(), 'test-results/kat-101')
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `${input.testName}-${Date.now()}.json`)
  await fs.writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...input
      },
      null,
      2
    ),
    'utf8'
  )
  return outPath
}
```

Then call `writeKat101Evidence(...)` from both KAT-101 integration tests.

**Step 4: Re-run targeted tests to verify pass**

Run: `npm run test:e2e:quality-gate -- --grep "persist|default userData/app-state.json"`
Expected: PASS; JSON evidence files appear under `test-results/kat-101/`.

**Step 5: Commit**

```bash
git add tests/e2e/helpers/evidence.ts tests/e2e/managed-provisioning.spec.ts
git commit -m "test(app): emit KAT-101 integration evidence artifacts"
```

### Task 4: Run full local CI gate and remediate any integration failures with TDD loops

**Files:**
- Modify (as needed): `tests/e2e/managed-provisioning.spec.ts`
- Modify (as needed): `tests/e2e/helpers/shell-view.ts`
- Modify (as needed): `src/main/index.ts`
- Modify (as needed): `src/main/ipc-handlers.ts`
- Modify (as needed): `src/main/state-store.ts`
- Modify/Create tests matching each discovered defect under `tests/unit/main/` or `tests/e2e/`

**Step 1: Run full gate and capture first failure (if any)**

Run: `npm run test:ci:local`
Expected: PASS when complete; if FAIL, capture first actionable error.

**Step 2: Add/adjust a failing regression test for the first failure**

Examples:
- startup regression -> extend `tests/e2e/managed-provisioning.spec.ts`
- persistence serialization bug -> add/extend `tests/unit/main/state-store.test.ts`
- IPC behavior mismatch -> add/extend `tests/unit/main/ipc-handlers.test.ts`

**Step 3: Implement minimal production fix**

Apply the smallest change in the corresponding source file (`src/main/index.ts`, `src/main/ipc-handlers.ts`, `src/main/state-store.ts`, or renderer wiring files).

**Step 4: Re-run targeted test, then full gate**

Run targeted test first, then:

Run: `npm run test:ci:local`
Expected: PASS.

**Step 5: Commit**

```bash
git add <tests-and-source-files-for-fix>
git commit -m "fix(app): resolve KAT-101 integration gate regression"
```

### Task 5: Final verification and evidence review before completion

**Files:**
- Review: `test-results/kat-101/*.json`
- Review: `playwright-report/` (if failures occurred)

**Step 1: Verify evidence artifacts are present and coherent**

Check that at least one artifact includes:
- resolved state file path
- persisted space snapshot
- pre/post relaunch counts

**Step 2: Re-run final confidence checks**

Run:
- `npm run test:e2e:quality-gate -- --grep "persist|default userData/app-state.json"`
- `npm run test:ci:local`

Expected: PASS.

**Step 3: Commit any last test-only updates (if needed)**

```bash
git add tests/e2e test-results/kat-101
git commit -m "test(app): finalize KAT-101 integration verification evidence"
```

