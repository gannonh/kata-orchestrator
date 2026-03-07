import { expect, test } from './fixtures/electron'
import { ensureHomeSpacesView, ensureWorkspaceShell } from './helpers/shell-view'

test.describe('Desktop app navigation @uat', () => {
  test('switches left panel tabs and renders each view @uat @ci @quality-gate', async ({ appWindow }) => {
    await ensureWorkspaceShell(appWindow)

    const leftTabs = appWindow.getByRole('tablist', { name: /Left panel (tabs|modules)/ })
    const leftPanelContent = appWindow.getByTestId('left-panel-content')

    await leftTabs.getByRole('tab', { name: /Agents/ }).click()
    await expect(leftPanelContent.getByRole('heading', { name: 'Agents' })).toBeVisible()

    await leftTabs.getByRole('tab', { name: /Context/ }).click()
    await expect(leftPanelContent.getByRole('heading', { name: 'Context' })).toBeVisible()
    const buildModeCopy = appWindow.getByText('Project specs, tasks, and notes are stored as markdown files in')
    const coordinatorModeCopy = appWindow.getByText('Context about the task, shared with all agents on demand.')

    if ((await buildModeCopy.count()) > 0) {
      await expect(buildModeCopy).toBeVisible()
      await expect(leftPanelContent.locator('code', { hasText: './notes' })).toBeVisible()
    } else {
      await expect(coordinatorModeCopy).toBeVisible()
    }
    await expect(leftPanelContent.getByText('Spec').first()).toBeVisible()

    await leftTabs.getByRole('tab', { name: /Changes/ }).click()
    await expect(leftPanelContent.getByRole('heading', { name: 'Changes' })).toBeVisible()
    await expect(appWindow.getByText('Your code lives in:')).toBeVisible()
    await expect(appWindow.getByText('No changes yet')).toBeVisible()

    await leftTabs.getByRole('tab', { name: /Files/ }).click()
    await expect(leftPanelContent.getByRole('heading', { name: 'Files' })).toBeVisible()
    await expect(appWindow.getByLabel('Search files')).toBeVisible()
  })

  test('switches right panel tabs and preserves notes state @uat @ci @quality-gate', async ({ appWindow }) => {
    await ensureWorkspaceShell(appWindow)

    const rightPanel = appWindow.getByTestId('right-panel')
    const rightTabs = rightPanel.getByRole('tablist', { name: 'Right panel tabs' })
    const noteScaffold = 'Start drafting a specification for what you want to build. Or brainstorm with an agent <-'

    await rightPanel.getByLabel('New tab').click()
    await rightPanel.getByRole('menuitem', { name: 'New Note' }).click()
    await expect(appWindow.getByText(noteScaffold)).toBeVisible()

    await rightTabs.getByRole('tab', { name: 'Spec' }).click()
    await expect(rightPanel.getByRole('heading', { name: /^Spec$/ })).toBeVisible()
    await expect(appWindow.getByText(noteScaffold)).toHaveCount(0)

    await rightTabs.getByRole('tab', { name: 'New Note' }).click()
    await expect(appWindow.getByText(noteScaffold)).toBeVisible()
  })

  test('navigates home, hides workspace content, and opens workspace on selected space @uat @ci @quality-gate', async ({
    appWindow
  }) => {
    await ensureHomeSpacesView(appWindow)
    await expect(appWindow.getByRole('heading', { name: 'Home' })).toBeVisible()
    await expect(appWindow.getByRole('tablist', { name: 'Center panel tabs' })).toHaveCount(0)

    await appWindow.getByRole('button', { name: 'Use my existing folder/worktree (developer-managed)' }).click()
    await appWindow.getByRole('textbox', { name: 'Workspace path' }).fill('/tmp')
    await appWindow.getByRole('button', { name: 'Create space' }).click()
    await expect(appWindow.getByRole('button', { name: 'Open selected space' })).toBeEnabled()
    await appWindow.getByRole('button', { name: 'Open selected space' }).click()
    await expect(appWindow.getByRole('tablist', { name: 'Center panel tabs' })).toBeVisible()
    await expect(appWindow.getByRole('tab', { name: /Coordinator/ })).toBeVisible()
  })
})
