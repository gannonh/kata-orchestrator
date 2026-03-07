import type { Page } from '@playwright/test'

import { expect, test } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

async function ensureCoordinatorSidebarMode(appWindow: Page) {
  await ensureWorkspaceShell(appWindow)

  await appWindow.evaluate(async () => {
    const bootstrap = await window.kata.appBootstrap()
    const spaceId = bootstrap.activeSpaceId
    if (!spaceId) {
      throw new Error('Active workspace space is required for coordinator sidebar test setup.')
    }

    const session = await window.kata.sessionCreate({
      spaceId,
      label: `Coordinator sidebar ${Date.now()}`
    })
    await window.kata.sessionSetActive(session.id)
  })

  await appWindow.reload()
  await ensureWorkspaceShell(appWindow)
}

test.describe('KAT-170: coordinator sidebar behavior @ci', () => {
  test('renders agents by default, switches to context, and restores from collapse @ci', async ({
    appWindow
  }) => {
    await ensureCoordinatorSidebarMode(appWindow)
    const leftPanelContent = appWindow.getByTestId('left-panel-content')

    await expect(appWindow.getByRole('heading', { name: 'Agents' })).toBeVisible()
    await expect(appWindow.getByText('MVP Planning Coordinator')).toBeVisible()

    await appWindow.getByRole('tab', { name: 'Context' }).click()
    await expect(appWindow.getByRole('heading', { name: 'Context' })).toBeVisible()
    await expect(leftPanelContent.getByText('Spec').first()).toBeVisible()

    await appWindow.getByRole('button', { name: 'Collapse sidebar navigation' }).click()
    await expect(appWindow.getByRole('button', { name: 'Expand sidebar navigation' })).toBeVisible()
    await appWindow.getByRole('button', { name: 'Expand sidebar navigation' }).click()
    await expect(appWindow.getByRole('heading', { name: 'Context' })).toBeVisible()
  })
})
