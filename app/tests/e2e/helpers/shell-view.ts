import { expect, test, type Page } from '@playwright/test'

export async function ensureSendButtonReady(appWindow: Page): Promise<void> {
  const messageInput = appWindow.getByLabel('Message input')
  const sendButton = appWindow.getByRole('button', { name: 'Send' })

  const canEnableSend = async (): Promise<boolean> => {
    if (
      (await sendButton.count()) === 0 ||
      !(await sendButton.isVisible()) ||
      (await messageInput.count()) === 0 ||
      !(await messageInput.isVisible())
    ) {
      return false
    }

    if (await sendButton.isEnabled()) {
      return true
    }

    const originalInput = await messageInput.inputValue()
    await messageInput.fill('parity-readiness-probe')
    const becameEnabled = await sendButton.isEnabled()
    await messageInput.fill(originalInput)
    return becameEnabled
  }

  if (await canEnableSend()) {
    return
  }

  await ensureHomeSpacesView(appWindow)
  const openSelectedSpaceButton = appWindow.getByRole('button', { name: 'Open selected space' })
  await expect(openSelectedSpaceButton).toBeEnabled({ timeout: 10_000 })
  await openSelectedSpaceButton.click()
  await expect(appWindow.getByTestId('app-shell-root')).toBeVisible({ timeout: 10_000 })

  if (!(await canEnableSend())) {
    throw new Error('Send input did not recover to a ready state after reopening selected space.')
  }
}

type EnsureWorkspaceShellOptions = {
  workspacePath?: string
}

export async function ensureHomeSpacesView(appWindow: Page): Promise<void> {
  const homeHeading = appWindow.getByRole('heading', { name: 'Home' })
  if ((await homeHeading.count()) === 0) {
    const navButton = appWindow.getByRole('button', { name: 'Open Home spaces view' })
    await expect(navButton).toBeVisible({ timeout: 5_000 })
    await navButton.click()
  }

  await expect(appWindow.getByTestId('create-space-panel')).toBeVisible()
}

export async function ensureWorkspaceShell(
  appWindow: Page,
  { workspacePath = '/tmp' }: EnsureWorkspaceShellOptions = {}
): Promise<void> {
  const appShellRoot = appWindow.getByTestId('app-shell-root')
  if ((await appShellRoot.count()) > 0) {
    await expect(appShellRoot).toBeVisible()
    await ensureSendButtonReady(appWindow)
    return
  }

  await test.step('Navigate to Home spaces view', async () => {
    await ensureHomeSpacesView(appWindow)
  })

  await test.step('Create developer-managed space', async () => {
    await appWindow
      .getByRole('button', { name: 'Use my existing folder/worktree (developer-managed)' })
      .click()
    await appWindow.getByRole('textbox', { name: 'Workspace path' }).fill(workspacePath)
    await appWindow.getByRole('button', { name: 'Create space' }).click()
  })

  await test.step('Open workspace shell', async () => {
    const openSelectedSpaceButton = appWindow.getByRole('button', { name: 'Open selected space' })
    await expect(openSelectedSpaceButton).toBeEnabled()
    await openSelectedSpaceButton.click()
    await expect(appShellRoot).toBeVisible()
  })

  await test.step('Wait for send composer readiness', async () => {
    await ensureSendButtonReady(appWindow)
  })
}
