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

async function expectTerminalRunStatus(appWindow: Page, timeout: number): Promise<'Stopped' | 'Error'> {
  const stoppedStatus = appWindow.getByRole('status', { name: 'Stopped' })
  const errorStatus = appWindow.getByRole('status', { name: 'Error' })
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await stoppedStatus.isVisible().catch(() => false)) {
      return 'Stopped'
    }
    if (await errorStatus.isVisible().catch(() => false)) {
      return 'Error'
    }

    await appWindow.waitForTimeout(100)
  }

  throw new Error(`Expected terminal run status (Stopped or Error) within ${timeout}ms`)
}

test.describe('KAT-158 session shell run-state evidence @uat', () => {
  test('captures required empty/pending/error/idle screenshots via send and retry controls @uat', async ({
    appWindow
  }) => {
    await ensureWorkspaceShell(appWindow)
    await fs.mkdir(evidenceDir, { recursive: true })

    const messageInput = appWindow.getByLabel('Message input')
    const sendButton = appWindow.getByRole('button', { name: 'Send' })

    await expectRunStatus(appWindow, 'Ready', 5_000)
    await appWindow.screenshot({ path: emptyStatePath, fullPage: true })

    await messageInput.fill('Capture pending state evidence for KAT-158')
    await sendButton.click()
    await expectRunStatus(appWindow, 'Thinking', 1_000)
    await appWindow.screenshot({ path: pendingStatePath, fullPage: true })

    const firstTerminalStatus = await expectTerminalRunStatus(appWindow, 30_000)

    if (firstTerminalStatus === 'Error') {
      await appWindow.screenshot({ path: errorStatePath, fullPage: true })
    } else {
      await messageInput.fill('/error trigger deterministic failure for KAT-158')
      await sendButton.click()
      await expectRunStatus(appWindow, 'Error', 5_000)
      await appWindow.screenshot({ path: errorStatePath, fullPage: true })
    }

    const retryButton = appWindow.getByRole('button', { name: 'Retry' })
    await expect(retryButton).toBeVisible()
    await retryButton.click()

    await expectRunStatus(appWindow, 'Thinking', 1_000)
    const postRetryTerminalStatus = await expectTerminalRunStatus(appWindow, 30_000)
    expect(postRetryTerminalStatus).toBe('Stopped')
    await appWindow.screenshot({ path: idleStatePath, fullPage: true })
  })
})
