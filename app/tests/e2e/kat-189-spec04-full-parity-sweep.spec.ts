import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from './fixtures/electron'
import {
  MOCK14_HIGH_ACTIVITY_DETAIL,
  MOCK14_TASK_TITLES,
  seedSpec04ParityTimeline
} from './helpers/spec04-parity-seed'

const evidenceDir = path.resolve(process.cwd(), 'test-results/kat-189')
const mock10Path = path.join(evidenceDir, 'mock10-spec-draft-review.png')
const mock11Path = path.join(evidenceDir, 'mock11-architecture-proposal.png')
const mock12Path = path.join(evidenceDir, 'mock12-tech-stack-a.png')
const mock13Path = path.join(evidenceDir, 'mock13-tech-stack-b.png')
const mock14Path = path.join(evidenceDir, 'mock14-task-tracking.png')

test.describe('KAT-189 spec04 parity sweep @quality-gate @ci @uat', () => {
  test('mock10-11 captures spec draft review and architecture proposal parity', async ({ appWindow, electronApp }) => {
    const timeline = await seedSpec04ParityTimeline({ appWindow, electronApp })

    try {
      await fs.mkdir(evidenceDir, { recursive: true })

      const rightPanel = appWindow.getByTestId('right-panel')
      const rightTabs = rightPanel.getByRole('tablist', { name: 'Right panel tabs' })
      await rightTabs.getByRole('tab', { name: 'Spec' }).click()

      const expandRightColumnButton = rightPanel.getByRole('button', { name: 'Expand right column' })
      if (
        (await expandRightColumnButton.count()) > 0 &&
        (await expandRightColumnButton.isVisible()) &&
        (await expandRightColumnButton.isEnabled())
      ) {
        await expandRightColumnButton.click()
      }

      const messageList = appWindow.getByTestId('message-list')
      await timeline.showMock10SpecDraftReview()
      await expect(rightPanel.getByRole('heading', { name: 'Spec', exact: true })).toBeVisible({ timeout: 10_000 })
      await expect(rightPanel.getByRole('button', { name: 'Apply Draft to Spec' })).toHaveCount(0)
      await expect(rightPanel.getByText('Spec Updated')).toBeVisible({ timeout: 10_000 })
      await expect(rightPanel.getByRole('heading', { name: 'Goal', exact: true })).toBeVisible({ timeout: 10_000 })
      await expect(rightPanel.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible({ timeout: 10_000 })

      await appWindow.screenshot({ path: mock10Path, fullPage: true })

      await timeline.showMock11ArchitectureProposal()
      await expect(messageList.getByText('Architecture Proposal')).toBeVisible({ timeout: 10_000 })
      await expect(messageList.getByText('Electron + TypeScript keeps desktop iteration stable')).toBeVisible({
        timeout: 10_000
      })
      await expect(rightPanel.getByText('Electron + TypeScript keeps desktop iteration stable.')).toBeVisible({
        timeout: 10_000
      })

      await appWindow.screenshot({ path: mock11Path, fullPage: true })
    } finally {
      await timeline.cleanup()
    }
  })

  test('mock12-13 captures tech-stack approval actions and progression parity', async ({ appWindow, electronApp }) => {
    const timeline = await seedSpec04ParityTimeline({ appWindow, electronApp })

    try {
      await fs.mkdir(evidenceDir, { recursive: true })

      const messageList = appWindow.getByTestId('message-list')
      await timeline.showMock12TechStackProposal()

      await expect(appWindow.getByRole('button', { name: 'Approve the plan...' })).toBeVisible({ timeout: 10_000 })
      await expect(appWindow.getByRole('button', { name: 'Keep the last switch...' })).toBeVisible({ timeout: 10_000 })
      await expect(appWindow.getByRole('button', { name: 'Clarifications' })).toBeVisible({ timeout: 10_000 })

      await appWindow.screenshot({ path: mock12Path, fullPage: true })

      await appWindow.getByRole('button', { name: 'Approve the plan...' }).click()
      await expect(
        messageList.getByText('Approve the plan and continue with this tech stack.', { exact: true })
      ).toBeVisible({ timeout: 10_000 })

      await appWindow.screenshot({ path: mock13Path, fullPage: true })
    } finally {
      await timeline.cleanup()
    }
  })

  test('mock14 captures task-tracking sync parity', async ({ appWindow, electronApp }) => {
    const timeline = await seedSpec04ParityTimeline({ appWindow, electronApp })

    try {
      await fs.mkdir(evidenceDir, { recursive: true })

      const rightPanel = appWindow.getByTestId('right-panel')
      const rightTabs = rightPanel.getByRole('tablist', { name: 'Right panel tabs' })
      await rightTabs.getByRole('tab', { name: 'Spec' }).click()

      const expandRightColumnButton = rightPanel.getByRole('button', { name: 'Expand right column' })
      if (
        (await expandRightColumnButton.count()) > 0 &&
        (await expandRightColumnButton.isVisible()) &&
        (await expandRightColumnButton.isEnabled())
      ) {
        await expandRightColumnButton.click()
      }

      await timeline.showMock14TaskTracking()

      const taskTrackingSection = appWindow.getByTestId('task-tracking-section')
      await expect(taskTrackingSection).toBeVisible({ timeout: 10_000 })
      await expect(taskTrackingSection.getByText('1 in progress')).toBeVisible({ timeout: 10_000 })
      await expect(taskTrackingSection.getByText('1 done')).toBeVisible({ timeout: 10_000 })
      await expect(taskTrackingSection.getByText('1 waiting')).toBeVisible({ timeout: 10_000 })

      for (const title of MOCK14_TASK_TITLES) {
        await expect(taskTrackingSection.getByText(title)).toBeVisible({ timeout: 10_000 })
        await expect(rightPanel.getByText(title)).toBeVisible({ timeout: 10_000 })
      }

      await expect(taskTrackingSection.getByText(MOCK14_HIGH_ACTIVITY_DETAIL)).toBeVisible({ timeout: 10_000 })
      await expect(taskTrackingSection.getByLabel('Active specialist')).toBeVisible({ timeout: 10_000 })
      await expect(rightPanel.getByText(MOCK14_HIGH_ACTIVITY_DETAIL)).toHaveCount(0)
      await expect(rightPanel.getByLabel('Active specialist')).toHaveCount(0)

      await appWindow.screenshot({ path: mock14Path, fullPage: true })
    } finally {
      await timeline.cleanup()
    }
  })
})
