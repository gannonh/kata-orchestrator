import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type ElectronApplication } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

const evidenceDir = path.resolve(process.cwd(), 'test-results/kat-188')

const snapshotMock14Path = path.join(evidenceDir, 'mock14-task-tracking.png')
const detailNoActivityPath = path.join(evidenceDir, 'task-detail-no-activity.png')
const detailHighActivityPath = path.join(evidenceDir, 'task-detail-high-activity.png')
const snapshotMock19Path = path.join(evidenceDir, 'mock19-wave-merge-strategy.png')

const RUN_ID = 'run-kat-188-e2e'
const HIGH_ACTIVITY_DETAIL = "I'm starting implementation for the space creation flow."
const TASK_TITLES = [
  'Review the latest prompt',
  'Apply the structured draft',
  'Keep the runtime wiring stable'
]

type TaskSnapshotPayload = {
  sessionId: string
  runId: string
  items: Array<{
    id: string
    title: string
    status: 'not_started' | 'in_progress' | 'blocked' | 'complete'
    activityLevel: 'none' | 'low' | 'high'
    activityDetail?: string
    activeAgentId?: string
    updatedAt: string
  }>
  counts: {
    not_started: number
    in_progress: number
    blocked: number
    complete: number
  }
}

async function broadcastRunEvent(
  electronApp: ElectronApplication,
  payload: unknown
): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }, event) => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length === 0) {
      throw new Error('No BrowserWindow available for run:event injection')
    }

    for (const targetWindow of windows) {
      targetWindow.webContents.send('run:event', event)
    }
  }, payload)
}

test.describe('KAT-188 task tracking parity evidence @uat', () => {
  test('captures mock14 and high-activity parity states for task tracking', async ({
    appWindow,
    electronApp,
    managedStateFilePath
  }) => {
    await ensureWorkspaceShell(appWindow)
    await fs.mkdir(evidenceDir, { recursive: true })

    const persistedRaw = await fs.readFile(managedStateFilePath, 'utf8')
    const persistedState = JSON.parse(persistedRaw) as { activeSessionId?: string | null }
    const sessionId = persistedState.activeSessionId
    expect(sessionId).toBeTruthy()

    const rightPanel = appWindow.getByTestId('right-panel')
    const taskTrackingSection = appWindow.getByTestId('task-tracking-section')

    await electronApp.evaluate(({ ipcMain }, runId) => {
      try {
        ipcMain.removeHandler('run:submit')
      } catch {
        // no prior handler
      }
      ipcMain.handle('run:submit', async () => ({ runId }))
    }, RUN_ID)

    try {
      await broadcastRunEvent(electronApp, {
        type: 'run_state_changed',
        runState: 'idle'
      })

      await appWindow.getByLabel('Message input').fill('Build session task tracking parity baseline.')
      await expect(appWindow.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 10_000 })
      await appWindow.getByRole('button', { name: 'Send' }).click()

      await broadcastRunEvent(electronApp, {
        type: 'message_appended',
        runId: RUN_ID,
        message: {
          id: 'agent-kat-188-draft',
          role: 'agent',
          content: 'Draft generated.',
          createdAt: '2026-03-04T12:00:00.000Z'
        }
      })

      await expect(rightPanel.getByRole('button', { name: 'Apply Draft to Spec' })).toBeVisible({ timeout: 10_000 })
      await rightPanel.getByRole('button', { name: 'Apply Draft to Spec' }).click()

      await expect(rightPanel.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible({ timeout: 10_000 })

      const noActivitySnapshot: TaskSnapshotPayload = {
        sessionId: sessionId!,
        runId: RUN_ID,
        items: [
          {
            id: 'task-review-the-latest-prompt',
            title: TASK_TITLES[0],
            status: 'not_started',
            activityLevel: 'none',
            updatedAt: '2026-03-04T12:00:10.000Z'
          },
          {
            id: 'task-apply-the-structured-draft',
            title: TASK_TITLES[1],
            status: 'in_progress',
            activityLevel: 'none',
            updatedAt: '2026-03-04T12:00:11.000Z'
          },
          {
            id: 'task-keep-the-runtime-wiring-stable',
            title: TASK_TITLES[2],
            status: 'complete',
            activityLevel: 'none',
            updatedAt: '2026-03-04T12:00:12.000Z'
          }
        ],
        counts: { not_started: 1, in_progress: 1, blocked: 0, complete: 1 }
      }

      await broadcastRunEvent(electronApp, {
        type: 'task_activity_snapshot',
        snapshot: noActivitySnapshot
      })

      await expect(taskTrackingSection).toBeVisible({ timeout: 10_000 })
      await expect(taskTrackingSection.getByText(/in progress/i)).toBeVisible()
      await expect(rightPanel.getByRole('checkbox', { name: TASK_TITLES[1] })).toBeVisible()

      for (const title of TASK_TITLES) {
        await expect(taskTrackingSection.getByText(title)).toBeVisible()
        await expect(rightPanel.getByText(title)).toBeVisible()
      }

      await expect(appWindow.getByText(HIGH_ACTIVITY_DETAIL)).toHaveCount(0)

      await appWindow.screenshot({ path: snapshotMock14Path, fullPage: true })
      await taskTrackingSection.screenshot({ path: detailNoActivityPath })

      const highActivitySnapshot: TaskSnapshotPayload = {
        ...noActivitySnapshot,
        items: noActivitySnapshot.items.map((item) =>
          item.id === 'task-apply-the-structured-draft'
            ? {
                ...item,
                status: 'in_progress',
                activityLevel: 'high',
                activityDetail: HIGH_ACTIVITY_DETAIL,
                activeAgentId: 'spec'
              }
            : item
        )
      }

      await broadcastRunEvent(electronApp, {
        type: 'task_activity_snapshot',
        snapshot: highActivitySnapshot
      })

      await expect(taskTrackingSection.getByText(HIGH_ACTIVITY_DETAIL)).toBeVisible({ timeout: 10_000 })
      await expect(taskTrackingSection.getByLabel('Active specialist')).toBeVisible()
      await expect(rightPanel.getByText(HIGH_ACTIVITY_DETAIL)).toBeVisible()
      await expect(rightPanel.getByLabel('Active specialist')).toBeVisible()

      await taskTrackingSection.screenshot({ path: detailHighActivityPath })
      await appWindow.screenshot({ path: snapshotMock19Path, fullPage: true })
    } finally {
      await electronApp.evaluate(({ ipcMain }) => {
        try {
          ipcMain.removeHandler('run:submit')
        } catch {
          // already removed
        }
      })
    }
  })
})
