# KAT-103 Managed Workspace Git Provisioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship managed workspace provisioning for copy-local, clone-from-GitHub, and new-repo flows with explicit branch behavior, deterministic naming defaults/overrides, actionable IPC errors, and robust E2E coverage.

**Architecture:** Keep `space:create` as the single renderer entrypoint, but delegate managed provisioning to a new main-process service that owns git/fs operations and returns normalized results. Use a global managed repo cache (`~/.kata/repos` by default) plus per-space worktrees at `<space>/repo`, while keeping external mode pass-through. Share naming and input contracts through `src/shared` so renderer, preload, and main stay aligned.

**Tech Stack:** Electron IPC, Node fs/path/child_process, TypeScript, Vitest (unit), Testing Library (renderer), Playwright Electron (E2E).

---

Implementation guidance:
- Apply @test-driven-development for each task.
- Apply @verification-before-completion before closing KAT-103.
- Use @playwright for E2E authoring/debugging.
- Keep commits small and frequent.

### Task 1: Extend shared input contracts for provisioning + naming model

**Files:**
- Modify: `src/shared/types/space.ts`
- Modify: `tests/unit/shared/types/space.test.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `tests/unit/preload/index.test.ts`

**Step 1: Write failing tests for new `CreateSpaceInput` shape**

```ts
it('supports managed provisioning payloads for copy-local/clone-github/new-repo', () => {
  const copyLocal: CreateSpaceInput = {
    workspaceMode: 'managed',
    provisioningMethod: 'copy-local',
    sourceLocalPath: '/Users/me/dev/repo',
    repoUrl: 'https://github.com/org/repo',
    branch: 'main'
  }
  const cloneGitHub: CreateSpaceInput = {
    workspaceMode: 'managed',
    provisioningMethod: 'clone-github',
    sourceRemoteUrl: 'https://github.com/org/repo.git',
    repoUrl: 'https://github.com/org/repo',
    branch: 'main'
  }
  const newRepo: CreateSpaceInput = {
    workspaceMode: 'managed',
    provisioningMethod: 'new-repo',
    newRepoParentDir: '/Users/me/dev',
    newRepoFolderName: 'new-project',
    repoUrl: '',
    branch: 'main'
  }
  expect(copyLocal.provisioningMethod).toBe('copy-local')
  expect(cloneGitHub.provisioningMethod).toBe('clone-github')
  expect(newRepo.provisioningMethod).toBe('new-repo')
})
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- tests/unit/shared/types/space.test.ts tests/unit/preload/index.test.ts`  
Expected: FAIL (missing new fields/types in contracts).

**Step 3: Implement minimal type + preload updates**

```ts
export const PROVISIONING_METHODS = ['copy-local', 'clone-github', 'new-repo'] as const
export type ProvisioningMethod = (typeof PROVISIONING_METHODS)[number]

export type CreateSpaceInput = {
  name?: string
  prompt?: string
  spaceNameOverride?: string
  repoUrl: string
  branch: string
  workspaceMode?: WorkspaceMode
  orchestrationMode?: OrchestrationMode
} & (
  | {
      workspaceMode?: 'managed'
      provisioningMethod: 'copy-local'
      sourceLocalPath: string
    }
  | {
      workspaceMode?: 'managed'
      provisioningMethod: 'clone-github'
      sourceRemoteUrl: string
    }
  | {
      workspaceMode?: 'managed'
      provisioningMethod: 'new-repo'
      newRepoParentDir: string
      newRepoFolderName: string
    }
  | {
      workspaceMode: 'external'
      rootPath: string
      provisioningMethod?: never
    }
)
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- tests/unit/shared/types/space.test.ts tests/unit/preload/index.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/types/space.ts src/preload/index.ts src/preload/index.d.ts tests/unit/shared/types/space.test.ts tests/unit/preload/index.test.ts
git commit -m "feat(app): extend space create contracts for managed provisioning methods"
```

### Task 2: Add deterministic space-name derivation and collision helpers

**Files:**
- Create: `src/shared/space-name.ts`
- Create: `tests/unit/shared/space-name.test.ts`

**Step 1: Write failing tests for defaults/override/collision**

```ts
it('derives default name from repo + branch and applies numeric collision suffixes', () => {
  const taken = new Set(['kata-cloud main', 'kata-cloud main (2)'])
  expect(resolveSpaceName({ repoLabel: 'kata-cloud', branch: 'main', override: '', existingNames: taken }))
    .toBe('kata-cloud main (3)')
})

it('prefers explicit override when present', () => {
  expect(resolveSpaceName({ repoLabel: 'kata-cloud', branch: 'main', override: 'My custom space', existingNames: new Set() }))
    .toBe('My custom space')
})
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- tests/unit/shared/space-name.test.ts`  
Expected: FAIL (module missing).

**Step 3: Implement helpers**

```ts
export function deriveDefaultSpaceName(repoLabel: string, branch: string): string {
  const safeRepo = repoLabel.trim() || 'repo'
  const safeBranch = branch.trim() || 'main'
  return `${safeRepo} ${safeBranch}`
}

export function ensureUniqueSpaceName(base: string, existingNames: Set<string>): string {
  if (!existingNames.has(base)) return base
  let index = 2
  while (existingNames.has(`${base} (${index})`)) index += 1
  return `${base} (${index})`
}

export function resolveSpaceName(input: {
  repoLabel: string
  branch: string
  override?: string
  existingNames: Set<string>
}): string {
  const raw = input.override?.trim() || deriveDefaultSpaceName(input.repoLabel, input.branch)
  return ensureUniqueSpaceName(raw, input.existingNames)
}
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- tests/unit/shared/space-name.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shared/space-name.ts tests/unit/shared/space-name.test.ts
git commit -m "feat(app): add deterministic space naming and collision helpers"
```

### Task 3: Create provisioning service contract with validation and normalized errors

**Files:**
- Create: `src/main/workspace-provisioning.ts`
- Create: `tests/unit/main/workspace-provisioning.test.ts`

**Step 1: Write failing tests for validation and error normalization**

```ts
it('rejects non-absolute source paths for copy-local', async () => {
  await expect(provisionManagedWorkspace({
    workspaceBaseDir: '/tmp/ws',
    repoCacheBaseDir: '/tmp/cache',
    input: {
      workspaceMode: 'managed',
      provisioningMethod: 'copy-local',
      sourceLocalPath: 'relative/path',
      repoUrl: 'https://github.com/org/repo',
      branch: 'main'
    }
  })).rejects.toThrow('sourceLocalPath must be an absolute path')
})
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- tests/unit/main/workspace-provisioning.test.ts`  
Expected: FAIL (service/module missing).

**Step 3: Implement validation + error envelope**

```ts
export class WorkspaceProvisioningError extends Error {
  constructor(
    public readonly category: 'validation' | 'git' | 'filesystem',
    message: string,
    public readonly remediation?: string
  ) {
    super(message)
  }
}

export async function provisionManagedWorkspace(args: ProvisionManagedWorkspaceArgs): Promise<ProvisionedWorkspace> {
  // validate workspace mode + method-specific fields
  // throw WorkspaceProvisioningError with actionable remediation hints
}
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- tests/unit/main/workspace-provisioning.test.ts`  
Expected: PASS for validation/error contract tests.

**Step 5: Commit**

```bash
git add src/main/workspace-provisioning.ts tests/unit/main/workspace-provisioning.test.ts
git commit -m "feat(app): add workspace provisioning service contract and validation"
```

### Task 4: Implement copy-local provisioning with cache reuse + per-space worktree

**Files:**
- Modify: `src/main/workspace-provisioning.ts`
- Modify: `tests/unit/main/workspace-provisioning.test.ts`

**Step 1: Add failing tests for copy-local happy path**

```ts
it('copies local repo into cache and creates a worktree at <space>/repo', async () => {
  const result = await provisionManagedWorkspace({
    workspaceBaseDir: '/tmp/workspaces',
    repoCacheBaseDir: '/tmp/repos',
    input: {
      workspaceMode: 'managed',
      provisioningMethod: 'copy-local',
      sourceLocalPath: '/Users/me/dev/kata-cloud',
      repoUrl: 'https://github.com/gannonh/kata-cloud',
      branch: 'main'
    },
    runGit: mockRunGit,
    fsApi: mockFsApi
  })
  expect(result.rootPath).toMatch(/\/tmp\/workspaces\/.+\/repo$/)
  expect(mockRunGit).toHaveBeenCalledWith(expect.objectContaining({ args: ['worktree', 'add', expect.any(String), 'main'] }))
})
```

**Step 2: Run test to verify failure**

Run: `npm run test -- tests/unit/main/workspace-provisioning.test.ts -t "copies local repo"`  
Expected: FAIL.

**Step 3: Implement copy-local flow**

```ts
// 1) materialize cache repo if missing
// 2) run git fetch --all --prune in cache
// 3) ensure branch exists (local or remote-tracking create)
// 4) git worktree add <workspaceRepoPath> <branch>
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- tests/unit/main/workspace-provisioning.test.ts`  
Expected: PASS for copy-local and existing tests.

**Step 5: Commit**

```bash
git add src/main/workspace-provisioning.ts tests/unit/main/workspace-provisioning.test.ts
git commit -m "feat(app): implement copy-local managed repo provisioning"
```

### Task 5: Implement clone-from-GitHub provisioning with fetch/reuse semantics

**Files:**
- Modify: `src/main/workspace-provisioning.ts`
- Modify: `tests/unit/main/workspace-provisioning.test.ts`

**Step 1: Add failing clone tests**

```ts
it('clones remote when cache is missing and fetches when cache exists', async () => {
  // first call expects git clone
  // second call expects git fetch --all --prune, not clone
})
```

**Step 2: Run test to verify failure**

Run: `npm run test -- tests/unit/main/workspace-provisioning.test.ts -t "clones remote"`  
Expected: FAIL.

**Step 3: Implement clone/reuse behavior**

```ts
if (!cacheRepoExists) {
  await runGit({ cwd: repoCacheBaseDir, args: ['clone', sourceRemoteUrl, cacheRepoPath] })
} else {
  await runGit({ cwd: cacheRepoPath, args: ['fetch', '--all', '--prune'] })
}
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- tests/unit/main/workspace-provisioning.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/workspace-provisioning.ts tests/unit/main/workspace-provisioning.test.ts
git commit -m "feat(app): implement clone-github cache reuse and fetch behavior"
```

### Task 6: Implement new-repo provisioning and explicit branch behavior

**Files:**
- Modify: `src/main/workspace-provisioning.ts`
- Modify: `tests/unit/main/workspace-provisioning.test.ts`

**Step 1: Add failing tests for new repo + branch creation/tracking rules**

```ts
it('initializes new managed repo and provisions requested branch worktree', async () => {
  // verifies git init + initial commit path + worktree add
})

it('creates local tracking branch when only remote branch exists', async () => {
  // verifies checkout -b <branch> --track origin/<branch>
})
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- tests/unit/main/workspace-provisioning.test.ts -t "initializes new managed repo"`  
Expected: FAIL.

**Step 3: Implement new repo + branch resolver**

```ts
// new-repo:
// git init, configure default branch when needed, optional bootstrap commit
// branch resolver:
// - if local branch exists: use it
// - else if origin/<branch> exists: create tracking local branch
// - else create local branch from current HEAD
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- tests/unit/main/workspace-provisioning.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/workspace-provisioning.ts tests/unit/main/workspace-provisioning.test.ts
git commit -m "feat(app): implement new-repo provisioning and explicit branch resolution"
```

### Task 7: Integrate provisioning service into IPC `space:create`

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `tests/unit/main/ipc-handlers.test.ts`
- Modify: `src/main/index.ts`
- Modify: `tests/unit/main/index.test.ts`

**Step 1: Add failing IPC tests for managed paths and actionable errors**

```ts
it('space:create delegates managed provisioning and persists returned rootPath/branch/name', async () => {
  // inject mocked provisionManagedWorkspace and assert save payload
})

it('space:create returns actionable provisioning errors', async () => {
  // mock throw WorkspaceProvisioningError('git', 'Clone failed', 'Check GitHub auth')
  // expect reject message to contain remediation
})
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- tests/unit/main/ipc-handlers.test.ts tests/unit/main/index.test.ts`  
Expected: FAIL.

**Step 3: Implement IPC integration**

```ts
// managed branch in space:create:
// const provisioned = await provisionManagedWorkspace(...)
// const resolvedName = resolveSpaceName(...)
// persist SpaceRecord with resolvedName/rootPath/repoUrl/branch
//
// external branch stays pass-through and keeps existing rootPath checks
```

Also add optional env-driven overrides in `index.ts` for deterministic E2E directories:

```ts
registerIpcHandlers(undefined, {
  workspaceBaseDir: process.env.KATA_WORKSPACE_BASE_DIR,
  repoCacheBaseDir: process.env.KATA_REPO_CACHE_BASE_DIR
})
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- tests/unit/main/ipc-handlers.test.ts tests/unit/main/index.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/index.ts tests/unit/main/ipc-handlers.test.ts tests/unit/main/index.test.ts
git commit -m "feat(app): wire managed provisioning service into space:create IPC"
```

### Task 8: Update Home create flow UI for 3 provisioning methods + name override

**Files:**
- Modify: `src/renderer/components/home/CreateSpacePanel.tsx`
- Modify: `src/renderer/components/home/HomeSpacesScreen.tsx`
- Modify: `tests/unit/renderer/home/HomeSpacesScreen.test.tsx`
- Create: `tests/unit/renderer/home/CreateSpacePanel.test.tsx`

**Step 1: Add failing renderer tests for method selector and payload construction**

```tsx
it('submits copy-local payload with explicit source path', async () => {
  // select "Copy local repo", fill source path, click Create
  // expect spaceCreate called with provisioningMethod: 'copy-local'
})

it('prefills space name from repo+branch and honors override', async () => {
  // expect default derived name
  // edit name input and assert override is sent
})
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- tests/unit/renderer/home/CreateSpacePanel.test.tsx tests/unit/renderer/home/HomeSpacesScreen.test.tsx`  
Expected: FAIL.

**Step 3: Implement minimal UI/data updates**

```tsx
const [provisioningMethod, setProvisioningMethod] = useState<'copy-local' | 'clone-github' | 'new-repo'>('copy-local')
const [spaceNameOverride, setSpaceNameOverride] = useState('')

// build CreateSpaceInput by method
// keep workspaceMode === 'external' behavior unchanged
```

Include fields aligned to ticket mock:
- Copy local repo: local path picker/input
- Clone from GitHub: remote URL input
- New repo: parent dir + folder name

**Step 4: Run tests to verify pass**

Run: `npm run test -- tests/unit/renderer/home/CreateSpacePanel.test.tsx tests/unit/renderer/home/HomeSpacesScreen.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/home/CreateSpacePanel.tsx src/renderer/components/home/HomeSpacesScreen.tsx tests/unit/renderer/home/CreateSpacePanel.test.tsx tests/unit/renderer/home/HomeSpacesScreen.test.tsx
git commit -m "feat(app): add managed provisioning method UI and space name override"
```

### Task 9: Add robust E2E coverage for managed provisioning matrix

**Files:**
- Modify: `tests/e2e/fixtures/electron.ts`
- Create: `tests/e2e/managed-provisioning.spec.ts`

**Step 1: Add failing E2E tests (tagged `@ci` and core path `@quality-gate`)**

```ts
test('creates managed space via copy-local and opens workspace @uat @ci @quality-gate', async ({ appWindow }) => {
  // open home, choose copy-local, submit, verify space row + open workflow
})

test('creates managed space via clone-github with branch tracking @uat @ci', async ({ appWindow }) => {
  // use deterministic local bare remote fixture URL
})

test('creates managed space via new-repo @uat @ci', async ({ appWindow }) => {
  // parent dir + folder name flow
})
```

**Step 2: Run E2E to verify failure**

Run: `npm run test:e2e:ci -- --grep "managed provisioning"`  
Expected: FAIL (new UI/flows not implemented yet or selectors missing).

**Step 3: Implement deterministic fixture setup**

```ts
// fixtures/electron.ts
// create temp dirs for workspaces + repo cache
// pass env into electron.launch:
// KATA_WORKSPACE_BASE_DIR, KATA_REPO_CACHE_BASE_DIR
```

Use local git fixtures in test setup (temp bare repos) to avoid network flake.

**Step 4: Run E2E to verify pass**

Run: `npm run test:e2e:ci -- --grep "managed provisioning"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/e2e/fixtures/electron.ts tests/e2e/managed-provisioning.spec.ts
git commit -m "test(app): add deterministic e2e coverage for managed provisioning flows"
```

### Task 10: Final verification gate + evidence prep

**Files:**
- Modify (if needed): `docs/plans/2026-02-26-kat-103-managed-workspace-git-provisioning-design.md`
- Modify (if needed): `docs/plans/2026-02-26-kat-103-managed-workspace-git-provisioning-implementation-plan.md`

**Step 1: Run full local quality gate**

Run: `npm run test:ci:local`  
Expected: PASS (lint + coverage + quality-gate E2E + full UAT subset as configured).

**Step 2: Run targeted managed-provisioning E2E again**

Run: `npm run test:e2e:ci -- --grep "managed provisioning"`  
Expected: PASS with stable deterministic fixtures.

**Step 3: Capture evidence artifacts**

```bash
mkdir -p artifacts/kat-103
# Save screenshots/video paths from Playwright run output into artifacts/kat-103/README.md
```

**Step 4: Prepare Linear completion evidence note draft**

```md
## Completion Evidence
- PR: <link>
- Tests: <unit + e2e pass summary>
- Acceptance coverage: managed copy/clone/new + naming + external pass-through + actionable errors
- Screenshots/video: <artifact paths>
```

**Step 5: Commit any final documentation/evidence references**

```bash
git add docs/plans artifacts/kat-103
git commit -m "docs(app): finalize KAT-103 verification evidence summary"
```
