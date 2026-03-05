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
const EVIDENCE_DIR = path.resolve(process.cwd(), 'test-results/kat-162')
const BASELINE_PROMPT = 'KAT-162 demo proof baseline prompt'
const DRAFT_MARKDOWN = ['## Goal', 'KAT-162 demo proof goal.', '', '## Tasks', '- [ ] Capture evidence'].join('\n')
const ARTIFACTS = [
  'test-results/kat-162/01-prompt-submitted.png',
  'test-results/kat-162/02-run-completed-with-draft.png',
  'test-results/kat-162/03-draft-applied-spec.png',
  'test-results/kat-162/04-post-relaunch-restored-session.png'
]

type PersistedState = {
  runs: Record<
    string,
    {
      id: string
      sessionId: string
      prompt: string
      messages: Array<{ role: 'user' | 'agent'; content: string }>
      draftAppliedAt?: string
    }
  >
  specDocuments: Record<string, { markdown: string; updatedAt: string; appliedRunId?: string; appliedAt?: string }>
  activeSpaceId: string | null
  activeSessionId: string | null
}

async function readPersistedState(stateFilePath: string): Promise<PersistedState> {
  const raw = await fs.readFile(stateFilePath, 'utf8')
  return JSON.parse(raw) as PersistedState
}

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

    const previousOpenAiApiKey = await electronApp.evaluate(() => process.env.OPENAI_API_KEY ?? null)
    await electronApp.evaluate(() => {
      if (!process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = 'kat-162-e2e-dummy-key'
      }
    })

    const bootstrap = await appWindow.evaluate(async () => {
      const state = await window.kata?.appBootstrap?.()
      return {
        activeSpaceId: state?.activeSpaceId ?? null,
        activeSessionId: state?.activeSessionId ?? null
      }
    })
    if (!bootstrap.activeSpaceId || !bootstrap.activeSessionId) {
      throw new Error('Missing active space/session before KAT-162 run submission.')
    }

    let runId: string | null = null
    await appWindow.getByLabel('Message input').fill(BASELINE_PROMPT)
    await appWindow.getByRole('button', { name: 'Send' }).click()
    await expect(appWindow.getByTestId('message-list').getByText(BASELINE_PROMPT)).toBeVisible()
    await appWindow.screenshot({
      path: path.join(EVIDENCE_DIR, '01-prompt-submitted.png'),
      fullPage: true
    })

    await expect.poll(async () => {
      const state = await readPersistedState(managedStateFilePath)
      const run = Object.values(state.runs).find(
        (candidate) =>
          candidate.sessionId === bootstrap.activeSessionId && candidate.prompt === BASELINE_PROMPT
      )
      runId = run?.id ?? null
      return runId
    }, { timeout: 15_000 }).not.toBeNull()
    if (!runId) {
      throw new Error('Expected persisted KAT-162 run id before run:event injection.')
    }

    await broadcastRunEvent(electronApp, {
      type: 'message_appended',
      runId,
      message: {
        id: 'agent-kat-162-draft-ready',
        role: 'agent',
        content: DRAFT_MARKDOWN,
        createdAt: '2026-03-05T10:00:00.000Z'
      }
    })
    await broadcastRunEvent(electronApp, { type: 'run_state_changed', runState: 'idle' })

    const rightPanel = appWindow.getByTestId('right-panel')
    await expect(rightPanel.getByRole('button', { name: 'Apply Draft to Spec' })).toBeVisible({ timeout: 10_000 })
    await appWindow.screenshot({
      path: path.join(EVIDENCE_DIR, '02-run-completed-with-draft.png'),
      fullPage: true
    })
    await rightPanel.getByRole('button', { name: 'Apply Draft to Spec' }).click()
    await expect(rightPanel.getByRole('heading', { name: 'Goal', exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(rightPanel.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(rightPanel.getByText(`Applied from ${runId}`)).toBeVisible({ timeout: 10_000 })
    await appWindow.screenshot({
      path: path.join(EVIDENCE_DIR, '03-draft-applied-spec.png'),
      fullPage: true
    })

    const relaunchStateFilePath = path.join(managedTestRootDir, 'state-kat-162-relaunch.json')
    let persistedReady = false
    await expect.poll(async () => {
      const persisted = await readPersistedState(managedStateFilePath)
      if (!persisted.activeSpaceId || !persisted.activeSessionId) {
        return false
      }

      const persistedRun = persisted.runs[runId]
      const specDocumentKey = `${persisted.activeSpaceId}:${persisted.activeSessionId}`
      const persistedSpec = persisted.specDocuments[specDocumentKey]

      const hasPromptMessage = Array.isArray(persistedRun?.messages)
        && persistedRun.messages.some((message) => message.role === 'user' && message.content === BASELINE_PROMPT)

      persistedReady = Boolean(
        persistedRun
          && hasPromptMessage
          && persistedRun.draftAppliedAt
          && persistedSpec
          && persistedSpec.appliedRunId === runId
          && persistedSpec.markdown.includes('## Goal')
      )
      return persistedReady
    }, { timeout: 15_000 }).toBe(true)
    if (!persistedReady) {
      throw new Error('Persisted state did not contain expected run/spec data before relaunch.')
    }
    await fs.copyFile(managedStateFilePath, relaunchStateFilePath)
    await appWindow.evaluate(async (inputRunId) => {
      if (!inputRunId) {
        return
      }
      try {
        await window.kata?.runAbort?.({ runId: inputRunId })
      } catch {
        // Best-effort cleanup: run may already be settled.
      }
    }, runId)
    await electronApp.evaluate((previousKey) => {
      if (previousKey === null) {
        delete process.env.OPENAI_API_KEY
      } else {
        process.env.OPENAI_API_KEY = previousKey
      }
    }, previousOpenAiApiKey)

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
      await expect(relaunchedWindow.getByTestId('right-panel').getByText(`Applied from ${runId}`)).toBeVisible()
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
      runId,
      artifacts: ARTIFACTS,
      assertions: {
        promptVisibleAfterRelaunch: true,
        appliedRunBadgeVisibleAfterRelaunch: true,
        workspaceShellRestoredWithoutHome: true
      }
    })

    expect(evidencePath).toContain('test-results/kat-162/')

    // Worker-scoped Electron fixture is reused across e2e files.
    // Reset to a ready shell state so subsequent specs are not affected.
    await appWindow.reload({ waitUntil: 'load' })
    await appWindow.waitForSelector('#root > *', { state: 'attached' })
    await ensureWorkspaceShell(appWindow)
    await ensureSendButtonReady(appWindow)
  })
})
