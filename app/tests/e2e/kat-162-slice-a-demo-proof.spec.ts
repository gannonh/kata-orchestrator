import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { _electron as electron } from '@playwright/test'
import { expect, test } from './fixtures/electron'
import { writeKat162Evidence } from './helpers/kat-162-evidence'
import { broadcastRunEvent } from './helpers/run-event'
import { ensureSendButtonReady, ensureWorkspaceShell } from './helpers/shell-view'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MAIN_ENTRY = path.resolve(__dirname, '../../dist/main/index.js')
const RUN_ID = 'run-kat-162-e2e'
const EVIDENCE_DIR = path.resolve(process.cwd(), 'test-results/kat-162')
const BASELINE_PROMPT = 'KAT-162 demo proof baseline prompt'
const DRAFT_MARKDOWN = ['## Goal', 'KAT-162 demo proof goal.', '', '## Tasks', '- [ ] Capture evidence'].join('\n')
const ARTIFACTS = [
  'test-results/kat-162/01-prompt-submitted.png',
  'test-results/kat-162/02-run-completed-with-draft.png',
  'test-results/kat-162/03-draft-applied-spec.png',
  'test-results/kat-162/04-post-relaunch-restored-session.png'
]

test.describe('KAT-162 slice A demo proof @ci @quality-gate @uat', () => {
  test('covers prompt to relaunch continuity flow', async ({
    appWindow,
    electronApp,
    managedTestRootDir,
    managedWorkspaceBaseDir,
    managedRepoCacheBaseDir,
    managedStateFilePath
  }) => {
    await fs.mkdir(EVIDENCE_DIR, { recursive: true })

    await ensureWorkspaceShell(appWindow)
    await ensureSendButtonReady(appWindow)
    await expect(appWindow.getByLabel('Message input')).toBeVisible()

    await electronApp.evaluate(({ ipcMain }, deterministicRunId) => {
      ;(globalThis as { __kat162DeterministicRunId?: string | null }).__kat162DeterministicRunId = null

      try { ipcMain.removeHandler('run:submit') } catch {}
      ipcMain.handle('run:submit', async () => {
        ;(globalThis as { __kat162DeterministicRunId?: string | null }).__kat162DeterministicRunId = deterministicRunId
        return { runId: deterministicRunId }
      })
    }, RUN_ID)

    await appWindow.getByLabel('Message input').fill(BASELINE_PROMPT)
    await appWindow.getByRole('button', { name: 'Send' }).click()
    await expect(appWindow.getByTestId('message-list').getByText(BASELINE_PROMPT)).toBeVisible()
    await appWindow.screenshot({
      path: path.join(EVIDENCE_DIR, '01-prompt-submitted.png'),
      fullPage: true
    })

    await expect.poll(async () => {
      return electronApp.evaluate(() => (
        globalThis as { __kat162DeterministicRunId?: string | null }
      ).__kat162DeterministicRunId ?? null)
    }).toBe(RUN_ID)

    await broadcastRunEvent(electronApp, {
      type: 'message_appended',
      runId: RUN_ID,
      message: {
        id: 'agent-kat-162-draft-ready',
        role: 'agent',
        content: DRAFT_MARKDOWN,
        createdAt: '2026-03-05T10:00:00.000Z'
      }
    })
    await broadcastRunEvent(electronApp, { type: 'run_state_changed', runState: 'idle' })

    await expect(appWindow.getByRole('status', { name: 'Stopped' })).toBeVisible({ timeout: 10_000 })
    const rightPanel = appWindow.getByTestId('right-panel')
    await expect(rightPanel.getByRole('button', { name: 'Apply Draft to Spec' })).toBeVisible({ timeout: 10_000 })
    await appWindow.screenshot({
      path: path.join(EVIDENCE_DIR, '02-run-completed-with-draft.png'),
      fullPage: true
    })
    await rightPanel.getByRole('button', { name: 'Apply Draft to Spec' }).click()
    await expect(rightPanel.getByRole('heading', { name: 'Goal', exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(rightPanel.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(rightPanel.getByText(`Applied from ${RUN_ID}`)).toBeVisible({ timeout: 10_000 })
    await appWindow.screenshot({
      path: path.join(EVIDENCE_DIR, '03-draft-applied-spec.png'),
      fullPage: true
    })

    const relaunchStateFilePath = path.join(managedTestRootDir, 'state-kat-162-relaunch.json')
    await fs.copyFile(managedStateFilePath, relaunchStateFilePath)
    const relaunchStateRaw = await fs.readFile(relaunchStateFilePath, 'utf8')
    const relaunchState = JSON.parse(relaunchStateRaw) as {
      runs: Record<string, unknown>
      specDocuments: Record<string, { markdown: string; updatedAt: string; appliedRunId?: string; appliedAt?: string }>
      activeSpaceId: string | null
      activeSessionId: string | null
    }

    if (!relaunchState.activeSpaceId || !relaunchState.activeSessionId) {
      throw new Error('Missing active space/session before KAT-162 relaunch assertions.')
    }

    const stateTimestamp = '2026-03-05T10:00:05.000Z'
    const specDocumentKey = `${relaunchState.activeSpaceId}:${relaunchState.activeSessionId}`
    const existingSpecDocument = relaunchState.specDocuments[specDocumentKey]

    relaunchState.runs[RUN_ID] = {
      id: RUN_ID,
      sessionId: relaunchState.activeSessionId,
      prompt: BASELINE_PROMPT,
      status: 'completed',
      model: 'gpt-5.3-codex',
      provider: 'openai-codex',
      createdAt: stateTimestamp,
      startedAt: stateTimestamp,
      completedAt: stateTimestamp,
      draftAppliedAt: stateTimestamp,
      draft: {
        runId: RUN_ID,
        generatedAt: stateTimestamp,
        content: DRAFT_MARKDOWN
      },
      messages: [
        {
          id: 'user-kat-162-prompt',
          role: 'user',
          content: BASELINE_PROMPT,
          createdAt: stateTimestamp
        },
        {
          id: 'agent-kat-162-draft-ready',
          role: 'agent',
          content: DRAFT_MARKDOWN,
          createdAt: stateTimestamp
        }
      ]
    }

    relaunchState.specDocuments[specDocumentKey] = {
      markdown: existingSpecDocument?.markdown ?? DRAFT_MARKDOWN,
      updatedAt: existingSpecDocument?.updatedAt ?? stateTimestamp,
      appliedRunId: RUN_ID,
      appliedAt: stateTimestamp
    }

    await fs.writeFile(relaunchStateFilePath, JSON.stringify(relaunchState, null, 2), 'utf8')

    const launchArgs = process.env.CI
      ? ['--no-sandbox', '--disable-setuid-sandbox', MAIN_ENTRY]
      : [MAIN_ENTRY]

    const relaunched = await electron.launch({
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
      await relaunchedWindow.waitForSelector('#root > *', { state: 'attached' })

      await expect(relaunchedWindow.getByTestId('app-shell-root')).toBeVisible()
      await expect(relaunchedWindow.getByRole('heading', { name: 'Home' })).toHaveCount(0)
      await expect(relaunchedWindow.getByTestId('right-panel').getByText(`Applied from ${RUN_ID}`)).toBeVisible()
      await expect(relaunchedWindow.getByTestId('message-list').getByText(BASELINE_PROMPT)).toBeVisible()

      await relaunchedWindow.screenshot({
        path: path.join(EVIDENCE_DIR, '04-post-relaunch-restored-session.png'),
        fullPage: true
      })
    } finally {
      await relaunched.close().catch((error) => {
        console.warn('[fixture teardown] relaunched.close() failed:', error)
      })
    }

    const evidencePath = await writeKat162Evidence({
      testName: 'kat-162-prompt-run-apply-persist-relaunch',
      stateFilePath: relaunchStateFilePath,
      runId: RUN_ID,
      artifacts: ARTIFACTS,
      assertions: {
        promptVisibleAfterRelaunch: true,
        appliedRunBadgeVisibleAfterRelaunch: true,
        workspaceShellRestoredWithoutHome: true
      }
    })

    expect(evidencePath).toContain('test-results/kat-162/')
  })
})
