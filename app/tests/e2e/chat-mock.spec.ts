import { expect, test } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

test.describe('Desktop mock chat @uat', () => {
  test('sends a message and receives a streamed assistant reply @uat @ci @quality-gate', async ({ appWindow }) => {
    await ensureWorkspaceShell(appWindow)

    const prompt = 'Please summarize merged wave status.'

    await appWindow.getByLabel('Message input').fill(prompt)
    await appWindow.getByRole('button', { name: 'Send' }).click()

    await expect(appWindow.getByLabel('Message input')).toHaveValue('')
    await expect(appWindow.getByText(prompt)).toBeVisible()
    await expect(appWindow.getByRole('status', { name: 'Thinking' })).toBeVisible({ timeout: 5_000 })
    await expect(appWindow.getByRole('status', { name: 'Stopped' })).toBeVisible({ timeout: 15_000 })

    await expect(appWindow.getByText('Draft ready for review.')).toBeVisible()
  })
})
