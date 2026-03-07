import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

const evidenceDir = path.resolve(process.cwd(), 'test-results/kat-158')
const emptyStatePath = path.join(evidenceDir, 'state-empty.png')
const pendingStatePath = path.join(evidenceDir, 'state-pending.png')
const errorStatePath = path.join(evidenceDir, 'state-error.png')
const idleStatePath = path.join(evidenceDir, 'state-idle.png')

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

async function hasRunCredentials(appWindow: Page): Promise<boolean> {
  const authStatus = await appWindow.evaluate(async () => {
    return (await window.kata?.authStatus?.('openai-codex')) ?? 'none'
  })

  return authStatus === 'oauth' || authStatus === 'api_key'
}

test.describe('KAT-158 session shell run-state evidence @uat', () => {
  test('captures required empty/pending/error/idle screenshots via send and retry controls @uat', async ({
    appWindow
  }) => {
    await ensureWorkspaceShell(appWindow)
    await fs.mkdir(evidenceDir, { recursive: true })
    const runCredentialsAvailable = await hasRunCredentials(appWindow)

    const messageInput = appWindow.getByLabel('Message input')
    const sendButton = appWindow.getByRole('button', { name: 'Send' })

    await expectRunStatus(appWindow, 'Ready', 5_000)
    await appWindow.screenshot({ path: emptyStatePath, fullPage: true })

    await messageInput.fill('Capture pending state evidence for KAT-158')
    await sendButton.click()
    await expectRunStatus(appWindow, 'Thinking', 5_000)
    await appWindow.screenshot({ path: pendingStatePath, fullPage: true })

    const firstTerminalState = await waitForTerminalRunStatus(appWindow, 10_000)

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
