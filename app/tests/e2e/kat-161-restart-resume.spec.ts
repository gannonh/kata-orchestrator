import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { _electron as electron, type ElectronApplication } from '@playwright/test'
import { expect, test } from './fixtures/electron'
import { writeKat161Evidence } from './helpers/kat-161-evidence'
import { ensureHomeSpacesView, ensureWorkspaceShell } from './helpers/shell-view'

type BootstrapState = {
  activeSpaceId: string | null
  activeSessionId: string | null
}

type PersistedState = {
  spaces: Record<string, unknown>
  sessions: Record<string, unknown>
  runs: Record<
    string,
    {
      id: string
      sessionId: string
      prompt: string
      status: string
      model: string
      provider: string
      createdAt: string
      messages: Array<{
        id: string
        role: 'user' | 'agent'
        content: string
        createdAt: string
      }>
      errorMessage?: string
    }
  >
  agentRoster?: Record<string, unknown>
  specDocuments?: Record<string, unknown>
  activeSpaceId: string | null
  activeSessionId: string | null
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const mainEntry = path.resolve(__dirname, '../../dist/main/index.js')
const evidenceDir = path.resolve(process.cwd(), 'test-results/kat-161')

async function readPersistedState(stateFilePath: string): Promise<PersistedState> {
  const raw = await fsPromises.readFile(stateFilePath, 'utf8')
  return JSON.parse(raw) as PersistedState
}

async function getBootstrapState(appWindow: import('@playwright/test').Page): Promise<BootstrapState> {
  return await appWindow.evaluate(async () => {
    const api = (window as { kata?: { appBootstrap?: () => Promise<BootstrapState> } }).kata
    return (
      (await api?.appBootstrap?.()) ?? {
        activeSpaceId: null,
        activeSessionId: null
      }
    )
  })
}

test.describe('KAT-161 relaunch resume persistence @uat', () => {
  test('restores active space/session and persisted spec-task state after relaunch', async ({
    appWindow,
    managedTestRootDir,
    managedWorkspaceBaseDir,
    managedRepoCacheBaseDir,
    managedStateFilePath
  }) => {
    await ensureWorkspaceShell(appWindow)
    await fsPromises.mkdir(evidenceDir, { recursive: true })

    let bootstrap = await getBootstrapState(appWindow)
    if (!bootstrap.activeSpaceId || !bootstrap.activeSessionId) {
      bootstrap = await appWindow.evaluate(async () => {
        const api = (window as {
          kata?: {
            appBootstrap?: () => Promise<BootstrapState>
            spaceList?: () => Promise<Array<{ id: string }>>
            sessionListBySpace?: (input: { spaceId: string }) => Promise<Array<{ id: string }>>
            sessionCreate?: (input: { spaceId: string; label: string }) => Promise<{ id: string }>
            sessionSetActive?: (sessionId: string) => Promise<unknown>
            spaceSetActive?: (spaceId: string) => Promise<unknown>
          }
        }).kata
        const firstSpaceId = (await api?.spaceList?.())?.[0]?.id ?? null
        if (!firstSpaceId) {
          return { activeSpaceId: null, activeSessionId: null }
        }

        const sessions = await api?.sessionListBySpace?.({ spaceId: firstSpaceId })
        let firstSessionId = sessions?.[0]?.id ?? null
        if (!firstSessionId) {
          const created = await api?.sessionCreate?.({ spaceId: firstSpaceId, label: 'Chat' })
          firstSessionId = created?.id ?? null
        }

        if (!firstSessionId) {
          return { activeSpaceId: firstSpaceId, activeSessionId: null }
        }

        await api?.sessionSetActive?.(firstSessionId)
        await api?.spaceSetActive?.(firstSpaceId)
        return (
          (await api?.appBootstrap?.()) ?? {
            activeSpaceId: firstSpaceId,
            activeSessionId: firstSessionId
          }
        )
      })
    }
    expect(bootstrap.activeSpaceId).toBeTruthy()
    expect(bootstrap.activeSessionId).toBeTruthy()

    const spaceId = bootstrap.activeSpaceId as string
    const sessionId = bootstrap.activeSessionId as string
    const markdown = [
      '## Goal',
      'Relaunch continuity goal.',
      '',
      '## Acceptance Criteria',
      '1. Resume from persisted selection',
      '',
      '## Tasks',
      '- [/] Keep task state after restart'
    ].join('\n')

    const persistedSpec = await appWindow.evaluate(
      async ({
        inputSpaceId,
        inputSessionId,
        inputMarkdown
      }: {
        inputSpaceId: string
        inputSessionId: string
        inputMarkdown: string
      }) => {
        return await window.kata?.specSave?.({
          spaceId: inputSpaceId,
          sessionId: inputSessionId,
          markdown: inputMarkdown,
          appliedRunId: 'run-kat-161',
          appliedAt: '2026-03-03T00:00:00.000Z'
        })
      },
      { inputSpaceId: spaceId, inputSessionId: sessionId, inputMarkdown: markdown }
    )
    expect(persistedSpec).toBeTruthy()

    const relaunchStateFilePath = path.join(managedTestRootDir, 'state-kat-161-relaunch.json')
    await fsPromises.copyFile(managedStateFilePath, relaunchStateFilePath)

    const launchArgs = process.env.CI
      ? ['--no-sandbox', '--disable-setuid-sandbox', mainEntry]
      : [mainEntry]
    const relaunched: ElectronApplication = await electron.launch({
      args: launchArgs,
      env: {
        ...process.env,
        KATA_WORKSPACE_BASE_DIR: managedWorkspaceBaseDir,
        KATA_REPO_CACHE_BASE_DIR: managedRepoCacheBaseDir,
        KATA_STATE_FILE: relaunchStateFilePath,
        ...(process.env.CI || process.env.KATA_E2E_HEADLESS ? { KATA_E2E_HEADLESS: '1' } : {})
      }
    })

    try {
      const relaunchedWindow = await relaunched.firstWindow()
      await relaunchedWindow.waitForLoadState('load')
      await expect(relaunchedWindow.getByTestId('app-shell-root')).toBeVisible()
      await expect(relaunchedWindow.getByRole('heading', { name: 'Home' })).toHaveCount(0)

      const rightPanel = relaunchedWindow.getByTestId('right-panel')
      await expect(rightPanel.getByRole('heading', { name: 'Goal', exact: true })).toBeVisible()
      await expect(rightPanel.getByText('Relaunch continuity goal.')).toBeVisible()
      await expect(rightPanel.getByText('Applied from run-kat-161')).toBeVisible()
      await expect(rightPanel.getByText('In Progress')).toBeVisible()

      await relaunchedWindow.screenshot({
        path: path.join(evidenceDir, `restored-session-spec-${Date.now()}.png`),
        fullPage: true
      })

      await writeKat161Evidence({
        testName: 'restore-active-session-spec-state',
        stateFilePath: relaunchStateFilePath,
        activeSpaceId: spaceId,
        activeSessionId: sessionId,
        details: {
          expectedAppliedRunId: 'run-kat-161',
          expectedTaskState: 'in_progress'
        }
      })
    } finally {
      await relaunched.close().catch((error) => {
        console.warn('[fixture teardown] relaunched.close() failed:', error)
      })
    }
  })

  test('reconciles interrupted run to failed fallback after relaunch', async ({
    managedTestRootDir,
    managedWorkspaceBaseDir,
    managedRepoCacheBaseDir
  }) => {
    await fsPromises.mkdir(evidenceDir, { recursive: true })
    const runningStatePath = path.join(managedTestRootDir, 'state-kat-161-running.json')

    const runningState: PersistedState = {
      spaces: {
        'space-1': {
          id: 'space-1',
          name: 'Resume Space',
          repoUrl: 'https://github.com/org/repo',
          rootPath: '/tmp',
          branch: 'main',
          orchestrationMode: 'team',
          createdAt: '2026-03-03T00:00:00.000Z',
          status: 'active'
        }
      },
      sessions: {
        'session-1': {
          id: 'session-1',
          spaceId: 'space-1',
          label: 'Chat',
          createdAt: '2026-03-03T00:00:00.000Z'
        }
      },
      runs: {
        'run-1': {
          id: 'run-1',
          sessionId: 'session-1',
          prompt: 'Resume after restart',
          status: 'running',
          model: 'gpt-5.3-codex',
          provider: 'openai-codex',
          createdAt: '2026-03-03T00:00:00.000Z',
          messages: [
            {
              id: 'user-1',
              role: 'user',
              content: 'Resume after restart',
              createdAt: '2026-03-03T00:00:00.000Z'
            }
          ]
        }
      },
      agentRoster: {},
      specDocuments: {},
      activeSpaceId: 'space-1',
      activeSessionId: 'session-1'
    }

    await fsPromises.writeFile(runningStatePath, JSON.stringify(runningState, null, 2), 'utf8')

    const launchArgs = process.env.CI
      ? ['--no-sandbox', '--disable-setuid-sandbox', mainEntry]
      : [mainEntry]
    const relaunched: ElectronApplication = await electron.launch({
      args: launchArgs,
      env: {
        ...process.env,
        KATA_WORKSPACE_BASE_DIR: managedWorkspaceBaseDir,
        KATA_REPO_CACHE_BASE_DIR: managedRepoCacheBaseDir,
        KATA_STATE_FILE: runningStatePath,
        ...(process.env.CI || process.env.KATA_E2E_HEADLESS ? { KATA_E2E_HEADLESS: '1' } : {})
      }
    })

    try {
      const relaunchedWindow = await relaunched.firstWindow()
      await relaunchedWindow.waitForLoadState('load')
      await expect(relaunchedWindow.getByTestId('app-shell-root')).toBeVisible()
      await expect(relaunchedWindow.getByRole('status', { name: 'Error' })).toBeVisible()

      const runs = await relaunchedWindow.evaluate(async () => {
        const api = (window as { kata?: { runList?: (sessionId: string) => Promise<unknown[]> } }).kata
        return (await api?.runList?.('session-1')) ?? []
      })
      const recoveredRun = (runs as Array<{ status?: string; errorMessage?: string }>).find(
        (run) => run.status === 'failed'
      )
      expect(recoveredRun).toBeDefined()
      expect(recoveredRun?.errorMessage).toBe(
        'Recovered after app restart: in-flight run was interrupted'
      )

      await relaunchedWindow.screenshot({
        path: path.join(evidenceDir, `interrupted-run-recovered-error-${Date.now()}.png`),
        fullPage: true
      })

      const persisted = await readPersistedState(runningStatePath)
      const persistedRun = persisted.runs['run-1']

      await writeKat161Evidence({
        testName: 'reconcile-interrupted-run-on-relaunch',
        stateFilePath: runningStatePath,
        activeSpaceId: persisted.activeSpaceId,
        activeSessionId: persisted.activeSessionId,
        details: {
          reconciledRunStatus: persistedRun?.status,
          reconciledRunError: persistedRun?.errorMessage
        }
      })
    } finally {
      await relaunched.close().catch((error) => {
        console.warn('[fixture teardown] relaunched.close() failed:', error)
      })
    }
  })
})
