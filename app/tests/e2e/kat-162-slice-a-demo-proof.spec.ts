import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from './fixtures/electron'
import { broadcastRunEvent } from './helpers/run-event'
import { ensureSendButtonReady, ensureWorkspaceShell } from './helpers/shell-view'

const RUN_ID = 'run-kat-162-e2e'
const EVIDENCE_DIR = path.resolve(process.cwd(), 'test-results/kat-162')

test.describe('KAT-162 slice A demo proof @ci @quality-gate @uat', () => {
  test('covers prompt to relaunch continuity flow', async ({ appWindow, electronApp }) => {
    await fs.mkdir(EVIDENCE_DIR, { recursive: true })

    await ensureWorkspaceShell(appWindow)
    await ensureSendButtonReady(appWindow)
    await expect(appWindow.getByLabel('Message input')).toBeVisible()

    await electronApp.evaluate(({ ipcMain }, deterministicRunId) => {
      ;(globalThis as { __kat162DeterministicRunId?: string | null }).__kat162DeterministicRunId = null

      try { ipcMain.removeHandler('run:submit') } catch {}
      ipcMain.handle('run:submit', async () => {
        ;(globalThis as { __kat162DeterministicRunId?: string | null }).__kat162DeterministicRunId = deterministicRunId
        return { runId: deterministicRunId }
      })
    }, RUN_ID)

    await appWindow.getByLabel('Message input').fill('KAT-162 demo proof baseline prompt')
    await appWindow.getByRole('button', { name: 'Send' }).click()
    await expect(appWindow.getByTestId('message-list').getByText('KAT-162 demo proof baseline prompt')).toBeVisible()
    await appWindow.screenshot({
      path: path.join(EVIDENCE_DIR, '01-prompt-submitted.png'),
      fullPage: true
    })

    await expect.poll(async () => {
      return electronApp.evaluate(() => (
        globalThis as { __kat162DeterministicRunId?: string | null }
      ).__kat162DeterministicRunId ?? null)
    }).toBe(RUN_ID)

    await broadcastRunEvent(electronApp, {
      type: 'message_appended',
      runId: RUN_ID,
      message: {
        id: 'agent-kat-162-draft-ready',
        role: 'agent',
        content: ['## Goal', 'KAT-162 demo proof goal.', '', '## Tasks', '- [ ] Capture evidence'].join('\n'),
        createdAt: '2026-03-05T10:00:00.000Z'
      }
    })
    await broadcastRunEvent(electronApp, { type: 'run_state_changed', runState: 'idle' })

    await expect(appWindow.getByRole('status', { name: 'Stopped' })).toBeVisible({ timeout: 10_000 })
    const rightPanel = appWindow.getByTestId('right-panel')
    await expect(rightPanel.getByRole('button', { name: 'Apply Draft to Spec' })).toBeVisible({ timeout: 10_000 })
    await appWindow.screenshot({
      path: path.join(EVIDENCE_DIR, '02-run-completed-with-draft.png'),
      fullPage: true
    })
    await rightPanel.getByRole('button', { name: 'Apply Draft to Spec' }).click()
    await expect(rightPanel.getByRole('heading', { name: 'Goal', exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(rightPanel.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible({ timeout: 10_000 })
    await appWindow.screenshot({
      path: path.join(EVIDENCE_DIR, '03-draft-applied-spec.png'),
      fullPage: true
    })
  })
})
