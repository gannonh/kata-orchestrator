import { expect, test } from './fixtures/electron'
import { ensureHomeSpacesView, ensureWorkspaceShell } from './helpers/shell-view'

test.describe('KAT-159: Run lifecycle @ci', () => {
  test.beforeEach(async ({ appWindow }) => {
    // Navigate home first to ensure a fresh session. Previous tests
    // (e.g. kat-158) may leave the run in Error/Stopped state. Opening
    // the workspace from Home creates a new session with Ready status.
    await ensureHomeSpacesView(appWindow)
    const openBtn = appWindow.getByRole('button', { name: 'Open selected space' })
    if (await openBtn.isEnabled()) {
      await openBtn.click()
      await expect(appWindow.getByTestId('app-shell-root')).toBeVisible()
    } else {
      await ensureWorkspaceShell(appWindow)
    }
  })

  test('chat panel renders in workspace shell @ci @quality-gate', async ({ appWindow }) => {
    // ChatPanel structure: message list, run status badge, chat input
    await expect(appWindow.getByTestId('message-list')).toBeVisible()
    await expect(appWindow.getByRole('status', { name: 'Ready' })).toBeVisible({ timeout: 10_000 })
    await expect(appWindow.getByLabel('Message input')).toBeVisible()
    await expect(appWindow.getByRole('button', { name: 'Send' })).toBeVisible()
  })

  test('message input is visible and interactable @ci', async ({ appWindow }) => {
    const input = appWindow.getByLabel('Message input')
    await expect(input).toBeVisible()
    await expect(input).toBeEnabled()

    await input.fill('Hello from E2E test')
    await expect(input).toHaveValue('Hello from E2E test')
  })
})
