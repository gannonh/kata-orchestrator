import fs from 'node:fs/promises'

import { expect, test } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

test.describe('KAT-187 approval actions parity @uat', () => {
  test('renders inline approval actions and captures post-click evidence', async ({
    appWindow,
    electronApp,
    managedStateFilePath
  }) => {
    await ensureWorkspaceShell(appWindow)
    await expect.poll(async () => {
      const raw = await fs.readFile(managedStateFilePath, 'utf8')
      const parsed = JSON.parse(raw) as { activeSessionId?: string | null }
      return parsed.activeSessionId ?? null
    }).not.toBeNull()

    const decisionProposal = [
      '## Why',
      '- Electron + TypeScript keeps desktop iteration stable',
      '',
      '## How to keep Tech stable later',
      '- Keep provider adapter boundaries explicit',
      '',
      'Approve this plan with 1 check? Clarifications',
      '- Approve the plan...',
      '- Keep the last switch...'
    ].join('\n')

    const didStubRunSubmit = await electronApp.evaluate(({ ipcMain }) => {
      const handlers = (ipcMain as unknown as { _invokeHandlers?: Map<string, unknown> })._invokeHandlers
      const existingHandler = handlers?.get('run:submit')
      if (typeof existingHandler !== 'function') {
        return false
      }

      const globalState = globalThis as { __kat187_prevRunSubmitHandler?: unknown }
      globalState.__kat187_prevRunSubmitHandler = existingHandler
      ipcMain.removeHandler('run:submit')
      ipcMain.handle('run:submit', async () => ({ runId: 'run-kat-187-e2e' }))
      return true
    })

    try {
      await appWindow.getByLabel('Message input').fill('seed decision card')
      await appWindow.getByRole('button', { name: 'Send' }).click()

      await electronApp.evaluate(({ BrowserWindow }, payload) => {
        const windows = BrowserWindow.getAllWindows()
        if (windows.length === 0) {
          throw new Error('No BrowserWindow available for run:event injection')
        }

        for (const targetWindow of windows) {
          targetWindow.webContents.send('run:event', payload)
        }
      }, {
        type: 'message_appended',
        runId: 'run-kat-187-seed',
        message: {
          id: 'agent-seed-1',
          role: 'agent',
          content: decisionProposal,
          createdAt: '2026-03-03T00:00:01.000Z'
        }
      })

      await expect(
        appWindow.getByText('Approve this plan with 1 check? Clarifications', { exact: true })
      ).toBeVisible({ timeout: 10_000 })
      await expect(appWindow.getByRole('button', { name: 'Approve the plan...' })).toBeVisible({ timeout: 10_000 })
      await expect(appWindow.getByRole('button', { name: 'Keep the last switch...' })).toBeVisible()
      await expect(appWindow.getByRole('button', { name: 'Clarifications' })).toBeVisible()

      await appWindow.screenshot({
        path: 'test-results/kat-187/mock12-actions-visible.png',
        fullPage: true
      })

      await appWindow.getByRole('button', { name: 'Approve the plan...' }).click()

      await expect(appWindow.getByText('Approve the plan and continue with this tech stack.')).toBeVisible()

      await appWindow.screenshot({
        path: 'test-results/kat-187/mock13-actions-post-click.png',
        fullPage: true
      })
    } finally {
      if (didStubRunSubmit) {
        await electronApp.evaluate(({ ipcMain }) => {
          const globalState = globalThis as { __kat187_prevRunSubmitHandler?: unknown }
          const previousHandler = globalState.__kat187_prevRunSubmitHandler
          delete globalState.__kat187_prevRunSubmitHandler

          ipcMain.removeHandler('run:submit')
          if (typeof previousHandler === 'function') {
            ipcMain.handle('run:submit', previousHandler as (...args: unknown[]) => unknown)
          }
        })
      }
    }
  })
})
