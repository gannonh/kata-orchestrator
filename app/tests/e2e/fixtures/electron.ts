import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  _electron as electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page
} from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const mainEntry = path.resolve(__dirname, '../../../dist/main/index.js')

type ElectronFixtures = {
  electronApp: ElectronApplication
  appWindow: Page
  managedTestRootDir: string
  managedWorkspaceBaseDir: string
  managedRepoCacheBaseDir: string
  managedStateFilePath: string
}

export const test = base.extend<ElectronFixtures>({
  managedTestRootDir: async ({}, use) => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kata-managed-provisioning-e2e-'))
    await use(rootDir)
    await fs.rm(rootDir, { recursive: true, force: true })
  },
  managedWorkspaceBaseDir: async ({ managedTestRootDir }, use) => {
    const workspaceBaseDir = path.join(managedTestRootDir, 'workspaces')
    await fs.mkdir(workspaceBaseDir, { recursive: true })
    await use(workspaceBaseDir)
  },
  managedRepoCacheBaseDir: async ({ managedTestRootDir }, use) => {
    const repoCacheBaseDir = path.join(managedTestRootDir, 'repos')
    await fs.mkdir(repoCacheBaseDir, { recursive: true })
    await use(repoCacheBaseDir)
  },
  managedStateFilePath: async ({ managedTestRootDir }, use) => {
    const stateFilePath = path.join(managedTestRootDir, 'state.json')
    await fs.writeFile(
      stateFilePath,
      JSON.stringify(
        {
          spaces: {},
          sessions: {},
          runs: {},
          activeSpaceId: null,
          activeSessionId: null
        },
        null,
        2
      ),
      'utf8'
    )
    await use(stateFilePath)
  },
  electronApp: async (
    { managedTestRootDir, managedWorkspaceBaseDir, managedRepoCacheBaseDir, managedStateFilePath },
    use
  ) => {
    const launchArgs = process.env.CI
      ? ['--no-sandbox', '--disable-setuid-sandbox', mainEntry]
      : [mainEntry]
    const electronApp = await electron.launch({
      args: launchArgs,
      env: {
        ...process.env,
        HOME: managedTestRootDir,
        KATA_WORKSPACE_BASE_DIR: managedWorkspaceBaseDir,
        KATA_REPO_CACHE_BASE_DIR: managedRepoCacheBaseDir,
        KATA_STATE_FILE: managedStateFilePath
      }
    })

    await use(electronApp)

    await electronApp.close().catch((error) => {
      console.warn('[fixture teardown] electronApp.close() failed:', error)
    })
  },
  appWindow: async ({ electronApp }, use) => {
    const appWindow = await electronApp.firstWindow()
    await appWindow.waitForLoadState('load')
    await appWindow.waitForSelector('#root > *', { state: 'attached' })

    await use(appWindow)
  }
})

export { expect }
