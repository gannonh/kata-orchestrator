import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type ElectronApplication } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'
import type { TaskActivitySnapshot } from '../../src/shared/types/task-tracking'

const evidenceDir = path.resolve(process.cwd(), 'test-results/kat-188')

const snapshotMock14Path = path.join(evidenceDir, 'mock14-task-tracking.png')
const detailNoActivityPath = path.join(evidenceDir, 'task-detail-no-activity.png')
const detailHighActivityPath = path.join(evidenceDir, 'task-detail-high-activity.png')
const snapshotMock19Path = path.join(evidenceDir, 'mock19-wave-merge-strategy.png')
const shouldCaptureEvidence = process.env.KATA_CAPTURE_EVIDENCE === '1'

const RUN_ID = 'run-kat-188-e2e'
const HIGH_ACTIVITY_DETAIL = "I'm starting implementation for the space creation flow."
const TASK_TITLES = [
  'Review the latest prompt',
  'Apply the structured draft',
  'Keep the runtime wiring stable'
]

type TaskSnapshotPayload = TaskActivitySnapshot

type ActiveWorkspaceContext = {
  spaceId: string
  sessionId: string
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

async function resolveActiveSessionContext(
  appWindow: import('@playwright/test').Page
): Promise<ActiveWorkspaceContext> {
  const context = await appWindow.evaluate(async () => {
    const api = (window as {
      kata?: {
        appBootstrap?: () => Promise<{ activeSpaceId: string | null; activeSessionId: string | null }>
        sessionCreate?: (input: { spaceId: string; label: string }) => Promise<{ id: string }>
        sessionSetActive?: (sessionId: string) => Promise<unknown>
        spaceSetActive?: (spaceId: string) => Promise<unknown>
      }
    }).kata

    const bootstrap = await api?.appBootstrap?.()
    const spaceId = bootstrap?.activeSpaceId ?? null
    const activeSessionId = bootstrap?.activeSessionId ?? null
    if (!spaceId) {
      return null
    }

    if (activeSessionId) {
      return { spaceId, sessionId: activeSessionId }
    }

    const createdSession = await api?.sessionCreate?.({
      spaceId,
      label: 'KAT-188 Task Tracking Evidence'
    })
    const sessionId = createdSession?.id ?? null
    if (!sessionId) {
      return null
    }
    await api?.sessionSetActive?.(sessionId)
    await api?.spaceSetActive?.(spaceId)
    return { spaceId, sessionId }
  })

  if (!context) {
    throw new Error('Unable to resolve active space/session for KAT-188 evidence test.')
  }

  return context
}

function buildStructuredDraftMarkdown(prompt: string): string {
  return [
    '## Goal',
    prompt,
    '',
    '## Acceptance Criteria',
    '1. Produce a structured spec draft from the latest run',
    '2. Keep the shell behavior deterministic for renderer tests',
    '',
    '## Non-goals',
    '- Do not call external services from the right panel',
    '',
    '## Assumptions',
    '- The latest prompt is the source of truth for the draft',
    '',
    '## Verification Plan',
    '1. Run the renderer unit tests',
    '',
    '## Rollback Plan',
    '1. Clear the generated draft state',
    '',
    '## Tasks',
    '- [ ] Review the latest prompt',
    '- [/] Apply the structured draft',
    '- [x] Keep the runtime wiring stable'
  ].join('\n')
}

test.describe('KAT-188 task tracking parity evidence @uat', () => {
  test('captures mock14 and high-activity parity states for task tracking', async ({
    appWindow,
    electronApp,
    managedStateFilePath: _managedStateFilePath
  }) => {
    await ensureWorkspaceShell(appWindow)
    await fs.mkdir(evidenceDir, { recursive: true })

    const activeContext = await resolveActiveSessionContext(appWindow)
    let sessionId = activeContext.sessionId

    const rightPanel = appWindow.getByTestId('right-panel')
    const rightTabs = rightPanel.getByRole('tablist', { name: 'Right panel tabs' })
    await rightTabs.getByRole('tab', { name: 'Spec' }).click()
    const expandRightColumnButton = rightPanel.getByRole('button', { name: 'Expand right column' })
    if ((await expandRightColumnButton.count()) > 0) {
      await expandRightColumnButton.click()
    }
    await expect(rightPanel.getByRole('heading', { name: 'Spec', exact: true })).toBeVisible()
    await appWindow.evaluate(
      async ({ inputSpaceId, inputSessionId }: { inputSpaceId: string; inputSessionId: string }) => {
        const specSave = window.kata?.specSave
        if (typeof specSave !== 'function') {
          return
        }

        await specSave({
          spaceId: inputSpaceId,
          sessionId: inputSessionId,
          markdown: ''
        })
      },
      {
        inputSpaceId: activeContext.spaceId,
        inputSessionId: sessionId
      }
    )

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

      const runtimeContext = await appWindow.evaluate(async () => {
        const bootstrap = await window.kata?.appBootstrap?.()
        return {
          spaceId: bootstrap?.activeSpaceId ?? null,
          sessionId: bootstrap?.activeSessionId ?? null
        }
      })
      if (!runtimeContext.spaceId || !runtimeContext.sessionId) {
        throw new Error('Unable to resolve active context before applying KAT-188 structured draft.')
      }
      sessionId = runtimeContext.sessionId

      // Persist the structured draft so that after reload the spec panel
      // renders in structured_view mode (requires non-empty markdown with
      // an appliedRunId).
      const draftMarkdown = buildStructuredDraftMarkdown(
        'Build session task tracking parity baseline.'
      )
      await appWindow.evaluate(
        async ({ sid, ssid, md, rid }: { sid: string; ssid: string; md: string; rid: string }) => {
          await window.kata?.specSave?.({
            spaceId: sid,
            sessionId: ssid,
            markdown: md,
            appliedRunId: rid
          })
        },
        {
          sid: runtimeContext.spaceId,
          ssid: sessionId,
          md: draftMarkdown,
          rid: RUN_ID
        }
      )

      // useSpecDocument only fetches on mount. Reload the page to
      // remount all hooks so the persisted draft gets picked up.
      await appWindow.reload({ waitUntil: 'load' })
      await appWindow.waitForSelector('#root > *', { state: 'attached' })
      await expect(appWindow.getByTestId('app-shell-root')).toBeVisible({ timeout: 10_000 })

      await rightTabs.getByRole('tab', { name: 'Spec' }).click()

      await expect(rightPanel.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible({ timeout: 10_000 })

      const noActivitySnapshot: TaskSnapshotPayload = {
        sessionId,
        runId: RUN_ID,
        items: [
          {
            id: 'task-review-the-latest-prompt',
            title: TASK_TITLES[0],
            status: 'not_started',
            activityLevel: 'none',
            updatedAt: '2099-01-01T00:00:10.000Z'
          },
          {
            id: 'task-apply-the-structured-draft',
            title: TASK_TITLES[1],
            status: 'in_progress',
            activityLevel: 'none',
            updatedAt: '2099-01-01T00:00:11.000Z'
          },
          {
            id: 'task-keep-the-runtime-wiring-stable',
            title: TASK_TITLES[2],
            status: 'complete',
            activityLevel: 'none',
            updatedAt: '2099-01-01T00:00:12.000Z'
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

      if (shouldCaptureEvidence) {
        await appWindow.screenshot({ path: snapshotMock14Path, fullPage: true })
        await taskTrackingSection.screenshot({ path: detailNoActivityPath })
      }

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

      if (shouldCaptureEvidence) {
        await taskTrackingSection.screenshot({ path: detailHighActivityPath })
        await appWindow.screenshot({ path: snapshotMock19Path, fullPage: true })
      }
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
