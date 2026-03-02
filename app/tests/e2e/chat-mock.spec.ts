import { expect, test } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

// KAT-159: MockChatPanel was replaced by ChatPanel wired to useIpcSessionConversation.
// With sessionId=null (hardcoded in AppShell), submitPrompt early-returns without
// doing anything. These mock chat tests are superseded by the real run lifecycle
// tests in kat-159-run-lifecycle.spec.ts.
test.describe('Desktop mock chat @uat', () => {
  test.skip('sends a message and receives a streamed assistant reply @uat @ci @quality-gate', async ({ appWindow }) => {
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
