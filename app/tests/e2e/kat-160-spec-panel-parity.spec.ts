import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { expect, test, type Page } from './fixtures/electron'
import { ensureSendButtonReady, ensureWorkspaceShell } from './helpers/shell-view'

const evidenceDir = path.resolve(process.cwd(), 'test-results/kat-160')
const generatingStatePath = path.join(evidenceDir, 'state-generating.png')
const structuredStatePath = path.join(evidenceDir, 'state-structured.png')

async function expectRunStatus(appWindow: Page, label: 'Ready' | 'Thinking', timeout: number): Promise<void> {
  await expect(appWindow.getByRole('status', { name: label })).toBeVisible({ timeout })
}

test.describe('KAT-160 spec panel parity evidence @uat', () => {
  test('captures generating and structured states', async ({ appWindow, managedTestRootDir }) => {
    test.skip(
      process.env.CI === 'true' || process.env.CI === '1' || process.env.KATA_E2E_HEADLESS === '1',
      'Requires local OAuth session and is excluded from CI/headless quality gates.'
    )
    test.setTimeout(120_000)

    const sourceAuthPath = path.join(os.homedir(), '.codex', 'auth.json')
    try {
      await fs.access(sourceAuthPath)
    } catch {
      test.skip(true, 'Local Codex auth is required for this @uat parity capture.')
    }

    const managedAuthPath = path.join(managedTestRootDir, '.codex', 'auth.json')
    await fs.mkdir(path.dirname(managedAuthPath), { recursive: true })
    await fs.copyFile(sourceAuthPath, managedAuthPath)

    await ensureWorkspaceShell(appWindow)
    await fs.mkdir(evidenceDir, { recursive: true })

    const rightPanel = appWindow.getByTestId('right-panel')
    const rightTabs = rightPanel.getByRole('tablist', { name: 'Right panel tabs' })
    await rightTabs.getByRole('tab', { name: 'Spec' }).click()
    await ensureSendButtonReady(appWindow)

    const prompt = 'Respond with OK only.'
    await appWindow.getByLabel('Message input').fill(prompt)
    await appWindow.getByRole('button', { name: 'Send' }).click()

    await expectRunStatus(appWindow, 'Thinking', 1_000)
    await appWindow.screenshot({ path: generatingStatePath, fullPage: true })
    await expect(appWindow.getByRole('status', { name: 'Stopped' })).toBeVisible({ timeout: 90_000 })

    await expect(rightPanel.getByRole('button', { name: 'Apply Draft to Spec' })).toHaveCount(0)
    await appWindow.evaluate(
      async (markdown: string) => {
        const bootstrap = await window.kata?.appBootstrap?.()
        const spaceId = bootstrap?.activeSpaceId
        const sessionId = bootstrap?.activeSessionId
        const specSave = window.kata?.specSave
        if (!spaceId || !sessionId || typeof specSave !== 'function') {
          throw new Error('Missing specSave prerequisites for KAT-160 parity capture.')
        }

        await specSave({
          spaceId,
          sessionId,
          markdown
        })
      },
      ['## Goal', prompt, '', '## Tasks', '- [ ] Capture parity evidence'].join('\n')
    )
    await appWindow.reload({ waitUntil: 'load' })
    await appWindow.waitForSelector('#root > *', { state: 'attached' })
    await ensureWorkspaceShell(appWindow)
    await ensureSendButtonReady(appWindow)
    await rightTabs.getByRole('tab', { name: 'Spec' }).click()

    await expect(rightPanel.getByRole('heading', { name: 'Goal', exact: true })).toBeVisible()
    await expect(rightPanel.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
    await expect(rightPanel.getByText(prompt)).toBeVisible()

    await appWindow.screenshot({ path: structuredStatePath, fullPage: true })
  })
})
