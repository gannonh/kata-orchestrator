import { expect, test, type Page } from '@playwright/test'

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
}
