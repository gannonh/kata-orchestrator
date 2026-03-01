import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { _electron as electron, type ElectronApplication } from '@playwright/test'
import { expect, test } from './fixtures/electron'
import { writeKat101Evidence } from './helpers/evidence'
import { ensureHomeSpacesView } from './helpers/shell-view'

type SpaceListEntry = {
  id: string
  name: string
  rootPath: string
  branch: string
  workspaceMode?: string
}

type PersistedState = {
  spaces: Record<
    string,
    {
      id: string
      name: string
      rootPath: string
      branch: string
      workspaceMode?: string
    }
  >
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

async function listSpaces(appWindow: import('@playwright/test').Page): Promise<SpaceListEntry[]> {
  const allSpaces = await appWindow.evaluate(async () => {
    const api = (window as { kata?: { spaceList?: () => Promise<unknown> } }).kata
    return await api?.spaceList?.()
  })

  return (allSpaces as SpaceListEntry[] | undefined) ?? []
}

async function findNewSpace(
  appWindow: import('@playwright/test').Page,
  knownIds: Set<string>
): Promise<SpaceListEntry> {
  const spaces = await listSpaces(appWindow)
  const newSpace = spaces.find((space) => !knownIds.has(space.id))
  expect(newSpace).toBeDefined()
  return newSpace as SpaceListEntry
}

async function readPersistedState(stateFilePath: string): Promise<PersistedState> {
  const raw = await fsPromises.readFile(stateFilePath, 'utf8')
  return JSON.parse(raw) as PersistedState
}

test.describe('managed provisioning @uat @ci', () => {
  test('creates managed space via copy-local and opens workspace @quality-gate', async ({
    appWindow,
    managedTestRootDir
  }) => {
    const localSourcePath = path.join(managedTestRootDir, 'fixtures', 'copy-local-source')
    await createSeedRepo(localSourcePath)

    await ensureHomeSpacesView(appWindow)
    const beforeIds = new Set((await listSpaces(appWindow)).map((s) => s.id))

    await appWindow.getByRole('textbox', { name: 'Local repo path' }).fill(localSourcePath)
    await appWindow.getByRole('button', { name: 'Create space' }).click()

    await expect.poll(async () => (await listSpaces(appWindow)).length, { timeout: 10_000 }).toBeGreaterThan(beforeIds.size)
    const createdSpace = await findNewSpace(appWindow, beforeIds)
    expect(createdSpace.workspaceMode).toBe('managed')
    expect(createdSpace.rootPath.endsWith('/repo')).toBe(true)
    expect(fs.existsSync(createdSpace.rootPath)).toBe(true)
    expect(runGit(createdSpace.rootPath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()).toBe('main')

    await appWindow.getByRole('button', { name: 'Open selected space' }).click()
    await expect(appWindow.getByTestId('app-shell-root')).toBeVisible()
  })

  test('creates managed space via clone-github fallback URL with local bare remote fixture', async ({
    appWindow,
    managedTestRootDir
  }) => {
    const upstreamRepoPath = path.join(managedTestRootDir, 'fixtures', 'clone-source')
    await createSeedRepo(upstreamRepoPath)

    const bareRemotePath = path.join(managedTestRootDir, 'fixtures', 'clone-remote.git')
    await fsPromises.mkdir(path.dirname(bareRemotePath), { recursive: true })
    runGit(path.dirname(bareRemotePath), ['clone', '--bare', upstreamRepoPath, bareRemotePath])

    await ensureHomeSpacesView(appWindow)
    const beforeIds = new Set((await listSpaces(appWindow)).map((s) => s.id))

    await appWindow.getByRole('button', { name: 'Use clone github provisioning' }).click()
    await expect(appWindow.getByText(/GitHub CLI not available/i)).toBeVisible()
    await appWindow.getByRole('textbox', { name: 'Repository URL' }).fill(bareRemotePath)
    await appWindow.getByRole('button', { name: 'Create space' }).click()

    await expect.poll(async () => (await listSpaces(appWindow)).length, { timeout: 10_000 }).toBeGreaterThan(beforeIds.size)
    const createdSpace = await findNewSpace(appWindow, beforeIds)
    expect(createdSpace.workspaceMode).toBe('managed')
    expect(fs.existsSync(createdSpace.rootPath)).toBe(true)
    expect(runGit(createdSpace.rootPath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()).toBe('main')
  })

  test('creates managed space via new-repo flow', async ({ appWindow, managedTestRootDir }) => {
    const newRepoParentDir = path.join(managedTestRootDir, 'fixtures', 'new-repo-parent')
    await fsPromises.mkdir(newRepoParentDir, { recursive: true })

    await ensureHomeSpacesView(appWindow)
    const beforeIds = new Set((await listSpaces(appWindow)).map((s) => s.id))

    await appWindow.getByRole('button', { name: 'Use new repo provisioning' }).click()
    await appWindow.getByRole('textbox', { name: 'New repo parent directory' }).fill(newRepoParentDir)
    await appWindow.getByRole('textbox', { name: 'New repo name' }).fill('managed-new-project')
    await appWindow.getByRole('button', { name: 'Create space' }).click()

    await expect.poll(async () => (await listSpaces(appWindow)).length, { timeout: 10_000 }).toBeGreaterThan(beforeIds.size)
    const createdSpace = await findNewSpace(appWindow, beforeIds)
    expect(createdSpace.workspaceMode).toBe('managed')
    expect(fs.existsSync(createdSpace.rootPath)).toBe(true)
    expect(fs.existsSync(path.join(createdSpace.rootPath, 'README.md'))).toBe(true)
    expect(runGit(createdSpace.rootPath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()).toBe('main')
    expect(fs.existsSync(path.join(newRepoParentDir, 'managed-new-project'))).toBe(true)
    expect(fs.existsSync(path.join(newRepoParentDir, 'managed-new-project', '.git'))).toBe(true)
  })

  test('shows validation error for new-repo when parent directory input is blank', async ({ appWindow }) => {
    const sourceFolderName = `managed-new-project-blank-parent-${Date.now()}`

    await ensureHomeSpacesView(appWindow)
    const beforeIds = new Set((await listSpaces(appWindow)).map((s) => s.id))

    await appWindow.getByRole('button', { name: 'Use new repo provisioning' }).click()
    await appWindow.getByRole('textbox', { name: 'New repo name' }).fill(sourceFolderName)
    await appWindow.getByRole('button', { name: 'Create space' }).click()

    await expect(appWindow.getByRole('alert')).toContainText('newRepoParentDir must be an absolute path')
    await expect.poll(async () => (await listSpaces(appWindow)).length, { timeout: 10_000 }).toBe(beforeIds.size)
  })

  test('persists spaces across app restart @quality-gate', async ({
    appWindow,
    electronApp,
    managedTestRootDir,
    managedWorkspaceBaseDir,
    managedRepoCacheBaseDir,
    managedStateFilePath
  }) => {
    const localSourcePath = path.join(managedTestRootDir, 'fixtures', 'persist-source')
    await createSeedRepo(localSourcePath)

    await ensureHomeSpacesView(appWindow)
    const beforeIds = new Set((await listSpaces(appWindow)).map((s) => s.id))

    await appWindow.getByRole('textbox', { name: 'Local repo path' }).fill(localSourcePath)
    await appWindow.getByRole('button', { name: 'Create space' }).click()
    await expect.poll(async () => (await listSpaces(appWindow)).length, { timeout: 10_000 }).toBeGreaterThan(beforeIds.size)
    const createdSpace = await findNewSpace(appWindow, beforeIds)
    const persistedSpaceName = createdSpace.name
    const persistedSpaceId = createdSpace.id

    const preRelaunchSpaces = await listSpaces(appWindow)
    await expect.poll(() => fs.existsSync(managedStateFilePath)).toBe(true)
    const persistedState = await readPersistedState(managedStateFilePath)
    const persistedSpace = Object.values(persistedState.spaces).find((space) => space.id === persistedSpaceId)
    expect(persistedSpace).toBeDefined()
    expect(persistedSpace?.workspaceMode).toBe('managed')
    expect(persistedSpace?.branch).toBe('main')
    expect(persistedSpace?.rootPath.endsWith('/repo')).toBe(true)

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
      await ensureHomeSpacesView(relaunchedWindow)
      await expect(
        relaunchedWindow.getByRole('button', { name: `Select space ${persistedSpaceName}` })
      ).toBeVisible()
      const postRelaunchSpaces = await listSpaces(relaunchedWindow)
      await writeKat101Evidence({
        testName: 'persists-spaces-across-app-restart',
        stateFilePath: managedStateFilePath,
        spaceName: persistedSpaceName,
        preRelaunchCount: preRelaunchSpaces.length,
        postRelaunchCount: postRelaunchSpaces.length,
        persistedSpace
      })
    } finally {
      await relaunched.close().catch((error) => {
        console.warn('[fixture teardown] relaunched.close() failed:', error)
      })
    }
  })

  test('writes state to default userData/app-state.json when KATA_STATE_FILE is absent @quality-gate @ci', async ({
    managedTestRootDir,
    managedWorkspaceBaseDir,
    managedRepoCacheBaseDir
  }) => {
    const localSourcePath = path.join(managedTestRootDir, 'fixtures', 'default-state-path-source')
    await createSeedRepo(localSourcePath)

    const launchArgs = process.env.CI
      ? ['--no-sandbox', '--disable-setuid-sandbox', mainEntry]
      : [mainEntry]

    const appWithoutStateOverride: ElectronApplication = await electron.launch({
      args: launchArgs,
      env: {
        ...process.env,
        HOME: managedTestRootDir,
        KATA_STATE_FILE: '',
        KATA_WORKSPACE_BASE_DIR: managedWorkspaceBaseDir,
        KATA_REPO_CACHE_BASE_DIR: managedRepoCacheBaseDir
      }
    })

    let appWithoutStateOverrideClosed = false
    let defaultStatePath = ''
    let preRelaunchCount = 0
    let persistedSpace:
      | {
          id: string
          name: string
          rootPath: string
          branch: string
          workspaceMode?: string
        }
      | undefined

    try {
      const appWindow = await appWithoutStateOverride.firstWindow()
      await appWindow.waitForLoadState('load')
      await ensureHomeSpacesView(appWindow)
      const beforeIds = new Set((await listSpaces(appWindow)).map((s) => s.id))

      await appWindow.getByRole('textbox', { name: 'Local repo path' }).fill(localSourcePath)
      await appWindow.getByRole('button', { name: 'Create space' }).click()
      await expect.poll(async () => (await listSpaces(appWindow)).length, { timeout: 10_000 }).toBeGreaterThan(beforeIds.size)
      const createdSpace = await findNewSpace(appWindow, beforeIds)
      const defaultPathSpaceName = createdSpace.name
      const defaultPathSpaceId = createdSpace.id

      const userDataPath = await appWithoutStateOverride.evaluate(async ({ app }) => app.getPath('userData'))
      defaultStatePath = path.join(userDataPath, 'app-state.json')
      preRelaunchCount = (await listSpaces(appWindow)).length
      await appWithoutStateOverride.close()
      appWithoutStateOverrideClosed = true

      await expect.poll(() => fs.existsSync(defaultStatePath)).toBe(true)
      const persistedState = await readPersistedState(defaultStatePath)
      persistedSpace = Object.values(persistedState.spaces).find((space) => space.id === defaultPathSpaceId)
      expect(persistedSpace).toBeDefined()
      expect(persistedSpace?.workspaceMode).toBe('managed')
      expect(persistedSpace?.branch).toBe('main')
      expect(persistedSpace?.rootPath.endsWith('/repo')).toBe(true)

      const relaunched: ElectronApplication = await electron.launch({
        args: launchArgs,
        env: {
          ...process.env,
          HOME: managedTestRootDir,
          KATA_STATE_FILE: '',
          KATA_WORKSPACE_BASE_DIR: managedWorkspaceBaseDir,
          KATA_REPO_CACHE_BASE_DIR: managedRepoCacheBaseDir
        }
      })

      try {
        const relaunchedWindow = await relaunched.firstWindow()
        await relaunchedWindow.waitForLoadState('load')
        await ensureHomeSpacesView(relaunchedWindow)
        await expect(
          relaunchedWindow.getByRole('button', { name: `Select space ${defaultPathSpaceName}` })
        ).toBeVisible()
        const postRelaunchSpaces = await listSpaces(relaunchedWindow)
        await writeKat101Evidence({
          testName: 'writes-default-userdata-state-path',
          stateFilePath: defaultStatePath,
          spaceName: defaultPathSpaceName,
          preRelaunchCount,
          postRelaunchCount: postRelaunchSpaces.length,
          persistedSpace
        })
      } finally {
        await relaunched.close().catch((error) => {
          console.warn('[fixture teardown] relaunched.close() failed:', error)
        })
      }
    } finally {
      if (!appWithoutStateOverrideClosed) {
        await appWithoutStateOverride.close().catch((error) => {
          console.warn('[fixture teardown] appWithoutStateOverride.close() failed:', error)
        })
      }
    }
  })
})
