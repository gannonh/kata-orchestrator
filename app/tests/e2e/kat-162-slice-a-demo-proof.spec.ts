import { expect, test } from './fixtures/electron'
import { ensureSendButtonReady, ensureWorkspaceShell } from './helpers/shell-view'

test.describe('KAT-162 slice A demo proof @ci @quality-gate @uat', () => {
  test('covers prompt to relaunch continuity flow', async ({ appWindow, electronApp }) => {
    await ensureWorkspaceShell(appWindow)
    await ensureSendButtonReady(appWindow)
    await expect(appWindow.getByLabel('Message input')).toBeVisible()

    await electronApp.evaluate(({ ipcMain }) => {
      const deterministicRunId = 'run-kat-162-e2e'
      ;(globalThis as { __kat162DeterministicRunId?: string | null }).__kat162DeterministicRunId = null

      try { ipcMain.removeHandler('run:submit') } catch {}
      ipcMain.handle('run:submit', async () => {
        ;(globalThis as { __kat162DeterministicRunId?: string | null }).__kat162DeterministicRunId = deterministicRunId
        return { runId: deterministicRunId }
      })
    })

    await appWindow.getByLabel('Message input').fill('KAT-162 demo proof baseline prompt')
    await appWindow.getByRole('button', { name: 'Send' }).click()
    await expect(appWindow.getByTestId('message-list').getByText('KAT-162 demo proof baseline prompt')).toBeVisible()

    await expect.poll(async () => {
      return electronApp.evaluate(() => (
        globalThis as { __kat162DeterministicRunId?: string | null }
      ).__kat162DeterministicRunId ?? null)
    }).toBe('run-kat-162-e2e')
  })
})
