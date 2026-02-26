import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { _electron as electron, type ElectronApplication } from '@playwright/test'
import { expect, test } from './fixtures/electron'

type SpaceListEntry = {
  id: string
  name: string
  rootPath: string
  branch: string
  workspaceMode?: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const mainEntry = path.resolve(__dirname, '../../dist/main/index.js')

function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Kata',
      GIT_AUTHOR_EMAIL: 'kata@local',
      GIT_COMMITTER_NAME: 'Kata',
      GIT_COMMITTER_EMAIL: 'kata@local'
    }
  }).toString('utf8')
}

function ensureMainBranch(cwd: string): void {
  const currentBranch = runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  if (currentBranch !== 'main') {
    runGit(cwd, ['checkout', '-b', 'main'])
  }
}

async function createSeedRepo(repoDir: string): Promise<void> {
  await fsPromises.mkdir(repoDir, { recursive: true })
  runGit(repoDir, ['init'])
  await fsPromises.writeFile(path.join(repoDir, 'README.md'), '# fixture\n', 'utf8')
  runGit(repoDir, ['add', 'README.md'])
  runGit(repoDir, ['commit', '-m', 'Initial commit'])
  ensureMainBranch(repoDir)
}

async function createBranchCommit(repoDir: string, branch: string): Promise<void> {
  runGit(repoDir, ['checkout', '-b', branch])
  await fsPromises.writeFile(path.join(repoDir, `${branch.replace(/[\\/]/g, '-')}.txt`), `${branch}\n`, 'utf8')
  runGit(repoDir, ['add', '.'])
  runGit(repoDir, ['commit', '-m', `Add ${branch} fixture`])
  runGit(repoDir, ['checkout', 'main'])
}

async function openHomeView(appWindow: import('@playwright/test').Page): Promise<void> {
  await appWindow.getByRole('button', { name: 'Open Home spaces view' }).click()
  await expect(appWindow.getByTestId('create-space-panel')).toBeVisible()
}

async function getSpaceByName(appWindow: import('@playwright/test').Page, name: string): Promise<SpaceListEntry> {
  const allSpaces = await appWindow.evaluate(async () => {
    const api = (window as { kata?: { spaceList?: () => Promise<unknown> } }).kata
    return await api?.spaceList?.()
  })

  const matched = ((allSpaces as SpaceListEntry[] | undefined) ?? []).find((space) => space.name === name)
  expect(matched).toBeDefined()
  return matched as SpaceListEntry
}

test.describe('managed provisioning @uat @ci', () => {
  test('creates managed space via copy-local and opens workspace @quality-gate', async ({
    appWindow,
    managedTestRootDir
  }) => {
    const localSourcePath = path.join(managedTestRootDir, 'fixtures', 'copy-local-source')
    await createSeedRepo(localSourcePath)

    await openHomeView(appWindow)

    await appWindow.getByRole('textbox', { name: 'Space name' }).fill('Managed Copy Local Space')
    await appWindow.getByRole('textbox', { name: 'Local repo path' }).fill(localSourcePath)
    await appWindow.getByRole('button', { name: 'Create space' }).click()

    await expect(appWindow.getByRole('button', { name: 'Select space Managed Copy Local Space' })).toBeVisible()

    const createdSpace = await getSpaceByName(appWindow, 'Managed Copy Local Space')
    expect(createdSpace.workspaceMode).toBe('managed')
    expect(createdSpace.rootPath.endsWith('/repo')).toBe(true)
    expect(fs.existsSync(createdSpace.rootPath)).toBe(true)
    expect(runGit(createdSpace.rootPath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()).toBe('main')

    await appWindow.getByRole('button', { name: 'Open selected space' }).click()
    await expect(appWindow.getByTestId('app-shell-root')).toBeVisible()
  })

  test('creates managed space via clone-github with local bare remote fixture', async ({
    appWindow,
    managedTestRootDir
  }) => {
    const upstreamRepoPath = path.join(managedTestRootDir, 'fixtures', 'clone-source')
    await createSeedRepo(upstreamRepoPath)
    await createBranchCommit(upstreamRepoPath, 'feature/e2e-clone')

    const bareRemotePath = path.join(managedTestRootDir, 'fixtures', 'clone-remote.git')
    await fsPromises.mkdir(path.dirname(bareRemotePath), { recursive: true })
    runGit(path.dirname(bareRemotePath), ['clone', '--bare', upstreamRepoPath, bareRemotePath])

    await openHomeView(appWindow)

    await appWindow.getByRole('button', { name: 'Use clone github provisioning' }).click()
    await appWindow.getByRole('textbox', { name: 'Space name' }).fill('Managed Clone Space')
    await appWindow.getByRole('textbox', { name: 'Remote repo URL' }).fill(bareRemotePath)
    await appWindow.getByRole('textbox', { name: 'Branch' }).fill('feature/e2e-clone')
    await appWindow.getByRole('button', { name: 'Create space' }).click()

    await expect(appWindow.getByRole('button', { name: 'Select space Managed Clone Space' })).toBeVisible()

    const createdSpace = await getSpaceByName(appWindow, 'Managed Clone Space')
    expect(createdSpace.workspaceMode).toBe('managed')
    expect(fs.existsSync(createdSpace.rootPath)).toBe(true)
    expect(runGit(createdSpace.rootPath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()).toBe('feature/e2e-clone')
  })

  test('creates managed space via new-repo flow', async ({ appWindow, managedTestRootDir }) => {
    const newRepoParentDir = path.join(managedTestRootDir, 'fixtures', 'new-repo-parent')
    await fsPromises.mkdir(newRepoParentDir, { recursive: true })

    await openHomeView(appWindow)

    await appWindow.getByRole('button', { name: 'Use new repo provisioning' }).click()
    await appWindow.getByRole('textbox', { name: 'Space name' }).fill('Managed New Repo Space')
    await appWindow.getByRole('textbox', { name: 'Source repo parent directory' }).fill(newRepoParentDir)
    await appWindow.getByRole('textbox', { name: 'Source repo folder name' }).fill('managed-new-project')
    await appWindow.getByRole('button', { name: 'Create space' }).click()

    await expect(appWindow.getByRole('button', { name: 'Select space Managed New Repo Space' })).toBeVisible()

    const createdSpace = await getSpaceByName(appWindow, 'Managed New Repo Space')
    expect(createdSpace.workspaceMode).toBe('managed')
    expect(fs.existsSync(createdSpace.rootPath)).toBe(true)
    expect(fs.existsSync(path.join(createdSpace.rootPath, 'README.md'))).toBe(true)
    expect(runGit(createdSpace.rootPath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()).toBe('main')
    expect(fs.existsSync(path.join(newRepoParentDir, 'managed-new-project'))).toBe(true)
    expect(fs.existsSync(path.join(newRepoParentDir, 'managed-new-project', '.git'))).toBe(true)
  })

  test('creates managed space via new-repo when parent directory input is blank', async ({ appWindow }) => {
    const sourceFolderName = `managed-new-project-blank-parent-${Date.now()}`

    await openHomeView(appWindow)

    await appWindow.getByRole('button', { name: 'Use new repo provisioning' }).click()
    await appWindow.getByRole('textbox', { name: 'Space name' }).fill('Managed New Repo Blank Parent')
    await appWindow.getByRole('textbox', { name: 'Source repo folder name' }).fill(sourceFolderName)
    await appWindow.getByRole('button', { name: 'Create space' }).click()

    await expect(appWindow.getByRole('button', { name: 'Select space Managed New Repo Blank Parent' })).toBeVisible()

    const createdSpace = await getSpaceByName(appWindow, 'Managed New Repo Blank Parent')
    expect(createdSpace.workspaceMode).toBe('managed')
    expect(fs.existsSync(createdSpace.rootPath)).toBe(true)
    expect(runGit(createdSpace.rootPath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()).toBe('main')
  })

  test('persists spaces across app restart', async ({
    appWindow,
    electronApp,
    managedTestRootDir,
    managedWorkspaceBaseDir,
    managedRepoCacheBaseDir,
    managedStateFilePath
  }) => {
    const localSourcePath = path.join(managedTestRootDir, 'fixtures', 'persist-source')
    await createSeedRepo(localSourcePath)

    await openHomeView(appWindow)

    await appWindow.getByRole('textbox', { name: 'Space name' }).fill('Persisted Space')
    await appWindow.getByRole('textbox', { name: 'Local repo path' }).fill(localSourcePath)
    await appWindow.getByRole('button', { name: 'Create space' }).click()
    await expect(appWindow.getByRole('button', { name: 'Select space Persisted Space' })).toBeVisible()

    await electronApp.close()

    const launchArgs = process.env.CI
      ? ['--no-sandbox', '--disable-setuid-sandbox', mainEntry]
      : [mainEntry]

    const relaunched: ElectronApplication = await electron.launch({
      args: launchArgs,
      env: {
        ...process.env,
        KATA_WORKSPACE_BASE_DIR: managedWorkspaceBaseDir,
        KATA_REPO_CACHE_BASE_DIR: managedRepoCacheBaseDir,
        KATA_STATE_FILE: managedStateFilePath
      }
    })

    try {
      const relaunchedWindow = await relaunched.firstWindow()
      await relaunchedWindow.waitForLoadState('load')
      await relaunchedWindow.getByRole('button', { name: 'Open Home spaces view' }).click()
      await expect(relaunchedWindow.getByRole('button', { name: 'Select space Persisted Space' })).toBeVisible()
    } finally {
      await relaunched.close().catch(() => {
        // Relaunched app may already be closed due to earlier failure.
      })
    }
  })
})
