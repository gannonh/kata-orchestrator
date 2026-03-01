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

    await expectRunStatus(appWindow, 'Stopped', 10_000)

    await messageInput.fill('/error trigger deterministic failure for KAT-158')
    await sendButton.click()
    await expectRunStatus(appWindow, 'Error', 1_000)
    await appWindow.screenshot({ path: errorStatePath, fullPage: true })

    const retryButton = appWindow.getByRole('button', { name: 'Retry' })
    await expect(retryButton).toBeVisible()
    await retryButton.click()

    await expectRunStatus(appWindow, 'Thinking', 1_000)
    await expectRunStatus(appWindow, 'Stopped', 10_000)
    await appWindow.screenshot({ path: idleStatePath, fullPage: true })
  })
})
