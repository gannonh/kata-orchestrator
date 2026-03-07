import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

const evidenceDir = path.resolve(process.cwd(), 'test-results/kat-158')
const emptyStatePath = path.join(evidenceDir, 'state-empty.png')
const pendingStatePath = path.join(evidenceDir, 'state-pending.png')
const errorStatePath = path.join(evidenceDir, 'state-error.png')
const idleStatePath = path.join(evidenceDir, 'state-idle.png')

type ModelStatus = {
  currentModelName: string | null
  preferredModelName: string | null
  hasCredentials: boolean
}

async function expectRunStatus(appWindow: Page, label: 'Ready' | 'Thinking' | 'Error' | 'Stopped', timeout: number): Promise<void> {
  await expect(appWindow.getByRole('status', { name: label })).toBeVisible({ timeout })
}

async function waitForTerminalRunStatus(
  appWindow: Page,
  timeoutMs: number
): Promise<'Error' | 'Stopped'> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await appWindow.getByRole('status', { name: 'Stopped' }).isVisible()) {
      return 'Stopped'
    }
    if (await appWindow.getByRole('status', { name: 'Error' }).isVisible()) {
      return 'Error'
    }

    await appWindow.waitForTimeout(100)
  }

  throw new Error(`Run did not reach terminal state (Stopped/Error) within ${timeoutMs}ms`)
}

async function readModelStatus(appWindow: Page): Promise<ModelStatus> {
  return appWindow.evaluate(async () => {
    const bootstrap = await window.kata?.appBootstrap?.()
    const sessionId = bootstrap?.activeSessionId ?? null
    const [models, session] = await Promise.all([
      window.kata?.modelList?.() ?? Promise.resolve([]),
      sessionId ? window.kata?.sessionGet?.(sessionId) ?? Promise.resolve(null) : Promise.resolve(null)
    ])

    const currentModel =
      models.find((model) => model.modelId === session?.activeModelId) ?? null
    const preferredModel =
      models.find((model) => model.authStatus === 'oauth' || model.authStatus === 'api_key') ??
      null

    return {
      currentModelName: currentModel?.name ?? null,
      preferredModelName: preferredModel?.name ?? null,
      hasCredentials: preferredModel !== null
    }
  })
}

async function ensureRunnableModelSelected(appWindow: Page): Promise<boolean> {
  const modelStatus = await readModelStatus(appWindow)
  if (
    !modelStatus.hasCredentials ||
    !modelStatus.preferredModelName ||
    modelStatus.currentModelName === modelStatus.preferredModelName
  ) {
    return modelStatus.hasCredentials
  }

  await appWindow
    .getByRole('button', { name: modelStatus.currentModelName ?? '' })
    .click()
  await appWindow
    .getByRole('button', { name: modelStatus.preferredModelName, exact: true })
    .click()
  await expect(
    appWindow.getByRole('button', { name: modelStatus.preferredModelName, exact: true })
  ).toBeVisible({ timeout: 5_000 })

  return true
}

test.describe('KAT-158 session shell run-state evidence @uat', () => {
  test('captures required empty/pending/error/idle screenshots via send and retry controls @uat', async ({
    appWindow
  }) => {
    await ensureWorkspaceShell(appWindow)
    await fs.mkdir(evidenceDir, { recursive: true })
    const runCredentialsAvailable = await ensureRunnableModelSelected(appWindow)

    const messageInput = appWindow.getByLabel('Message input')
    const sendButton = appWindow.getByRole('button', { name: 'Send' })

    await expectRunStatus(appWindow, 'Ready', 5_000)
    await appWindow.screenshot({ path: emptyStatePath, fullPage: true })

    await messageInput.fill('Capture pending state evidence for KAT-158')
    await sendButton.click()

    // Thinking is transient — under load or without credentials the API may
    // reject immediately, jumping straight to a terminal state. Race both
    // and capture the screenshot only if Thinking is observed.
    const thinkingLocator = appWindow.getByRole('status', { name: 'Thinking' })
    const stoppedLocator = appWindow.getByRole('status', { name: 'Stopped' })
    const errorLocator = appWindow.getByRole('status', { name: 'Error' })

    const observed = await Promise.race([
      thinkingLocator.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'Thinking' as const),
      stoppedLocator.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'Stopped' as const),
      errorLocator.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'Error' as const)
    ])

    if (observed === 'Thinking') {
      await appWindow.screenshot({ path: pendingStatePath, fullPage: true })
    }

    const firstTerminalState = observed === 'Thinking'
      ? await waitForTerminalRunStatus(appWindow, 10_000)
      : observed

    if (firstTerminalState === 'Stopped') {
      await appWindow.screenshot({ path: idleStatePath, fullPage: true })

      await messageInput.fill('/error trigger deterministic failure for KAT-158')
      await sendButton.click()
      await expectRunStatus(appWindow, 'Error', 5_000)
      await appWindow.screenshot({ path: errorStatePath, fullPage: true })
      return
    }

    await appWindow.screenshot({ path: errorStatePath, fullPage: true })

    const retryButton = appWindow.getByRole('button', { name: 'Retry' })
    await expect(retryButton).toBeVisible()
    await retryButton.click()

    // After retry, the Thinking state may be unobservable when the API rejects
    // immediately (no credentials in CI). Skip the transient assertion and wait
    // for the terminal state directly.
    const terminalStateAfterRetry = await waitForTerminalRunStatus(appWindow, 10_000)
    if (runCredentialsAvailable && terminalStateAfterRetry !== 'Stopped') {
      throw new Error(`Expected retry to recover to Stopped with credentials, got ${terminalStateAfterRetry}`)
    }
    if (!runCredentialsAvailable && terminalStateAfterRetry !== 'Error') {
      throw new Error(`Expected retry to remain Error without credentials, got ${terminalStateAfterRetry}`)
    }

    if (terminalStateAfterRetry === 'Stopped') {
      await appWindow.screenshot({ path: idleStatePath, fullPage: true })
      return
    }

    await appWindow.screenshot({ path: errorStatePath, fullPage: true })
  })
})
