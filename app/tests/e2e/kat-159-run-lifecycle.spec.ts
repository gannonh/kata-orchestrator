import { expect, test } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

test.describe('KAT-159: Run lifecycle @ci', () => {
  test('chat panel renders in workspace shell @ci @quality-gate', async ({ appWindow }) => {
    await ensureWorkspaceShell(appWindow)

    // ChatPanel structure: message list, run status badge, chat input
    await expect(appWindow.getByTestId('message-list')).toBeVisible()
    await expect(appWindow.getByRole('status', { name: 'Ready' })).toBeVisible()
    await expect(appWindow.getByLabel('Message input')).toBeVisible()
    await expect(appWindow.getByRole('button', { name: 'Send' })).toBeVisible()
  })

  test('message input is visible and interactable @ci', async ({ appWindow }) => {
    await ensureWorkspaceShell(appWindow)

    const input = appWindow.getByLabel('Message input')
    await expect(input).toBeVisible()
    await expect(input).toBeEnabled()

    await input.fill('Hello from E2E test')
    await expect(input).toHaveValue('Hello from E2E test')
  })

  // Future tests (requires sessionId wiring, KAT-159 follow-up):
  // - Submit prompt dispatches SUBMIT_PROMPT and shows user message bubble
  // - Run status transitions: empty -> pending -> idle on successful run
  // - Run status transitions: empty -> pending -> error on failed run
  // - Retry from error state re-submits the last prompt
  // - Message list auto-scrolls on new messages
  // - Run history replays on mount when sessionId is set
})
