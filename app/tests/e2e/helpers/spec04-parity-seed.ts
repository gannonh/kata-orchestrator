import { expect, type ElectronApplication, type Page } from '@playwright/test'
import type { TaskActivitySnapshot } from '../../../src/shared/types/task-tracking'

import { ensureHomeSpacesView, ensureWorkspaceShell } from './shell-view'

type SeedSpec04ParityTimelineParams = {
  appWindow: Page
  electronApp: ElectronApplication
}

type SpecDocumentSnapshot = {
  markdown: string
  appliedRunId?: string
} | null

type SeedSpecContext = {
  spaceId: string
  sessionId: string
  initialSpecDocument: SpecDocumentSnapshot
}

export type Spec04ParityTimelineSeed = {
  showMock10SpecDraftReview: () => Promise<void>
  showMock11ArchitectureProposal: () => Promise<void>
  showMock12TechStackProposal: () => Promise<void>
  showMock14TaskTracking: () => Promise<void>
  cleanup: () => Promise<void>
}

const RUN_ID = 'run-kat-189-e2e'
const BASELINE_PROMPT = 'Build session parity sweep baseline.'
const MOCK10_SPEC_UPDATED_CONTENT = [
  'Spec Updated',
  '',
  '## Goal',
  'Ship parity evidence package.',
  '',
  '## Tasks',
  '- [ ] Capture Mock 10 parity evidence',
  '- [ ] Capture Mock 11 parity evidence'
].join('\n')
const MOCK11_ARCHITECTURE_CONTENT = [
  'Architecture Proposal',
  '',
  '## Why',
  '- Electron + TypeScript keeps desktop iteration stable',
  '- Deterministic run:event injection keeps local parity tests stable',
  '',
  '## How to keep Tech stable later',
  '- Keep provider adapter boundaries explicit'
].join('\n')
const MOCK11_ARCHITECTURE_SPEC_MARKDOWN = [
  '## Goal',
  'Electron + TypeScript keeps desktop iteration stable.',
  '',
  '## Acceptance Criteria',
  '1. Keep architecture rationale visible in the right panel',
  '',
  '## Non-goals',
  '- Do not introduce network dependencies into parity tests',
  '',
  '## Assumptions',
  '- Mock11 captures architecture proposal review state',
  '',
  '## Verification Plan',
  '1. Assert right panel Goal reflects architecture rationale',
  '',
  '## Rollback Plan',
  '1. Re-apply the baseline draft state',
  '',
  '## Tasks',
  '- [ ] Capture architecture proposal parity evidence',
  '- [ ] Validate deterministic mock11 panel reflection'
].join('\n')
const MOCK12_TECH_STACK_PROPOSAL_CONTENT = [
  'Tech-Stack Proposal',
  '',
  '## Why',
  '- Electron + TypeScript keeps desktop iteration stable',
  '- Deterministic run:event injection keeps parity assertions stable',
  '',
  '## How to keep Tech stable later',
  '- Keep provider adapter boundaries explicit',
  '- Reuse deterministic seed helpers for every proposal state',
  '',
  '## Revised views',
  '- Mock 12: show inline approval actions before click',
  '- Mock 13: show follow-up user approval after click',
  '',
  'Approve this plan with 1 check? Clarifications',
  '- Approve the plan...',
  '- Keep the last switch...'
].join('\n')
const MOCK14_TASK_TITLES = [
  'Review the latest prompt',
  'Apply the structured draft',
  'Keep the runtime wiring stable'
]
const MOCK14_HIGH_ACTIVITY_DETAIL = "I'm starting implementation for the structured draft task."
const MOCK14_TASK_TRACKING_SPEC_MARKDOWN = [
  '## Goal',
  'Build session parity sweep baseline.',
  '',
  '## Acceptance Criteria',
  '1. Keep left and right task titles synchronized for mock14 parity checks',
  '2. Preserve deterministic task activity snapshot assertions in e2e',
  '',
  '## Non-goals',
  '- Do not introduce network dependencies for mock parity',
  '',
  '## Assumptions',
  '- The right-panel markdown task list is the canonical source for task titles',
  '',
  '## Verification Plan',
  '1. Run focused mock14 parity assertions',
  '',
  '## Rollback Plan',
  '1. Restore baseline seed state in timeline cleanup',
  '',
  '## Tasks',
  '- [ ] Review the latest prompt',
  '- [/] Apply the structured draft',
  '- [x] Keep the runtime wiring stable'
].join('\n')

async function ensureSendButtonReady(appWindow: Page): Promise<void> {
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

async function installRunSubmitStub(
  electronApp: ElectronApplication,
  runId: string
): Promise<() => Promise<void>> {
  await electronApp.evaluate(({ ipcMain }, targetRunId) => {
    try {
      ipcMain.removeHandler('run:submit')
    } catch {
      // no prior handler
    }
    ipcMain.handle('run:submit', async () => ({ runId: targetRunId }))
  }, runId)

  return async () => {
    await electronApp.evaluate(({ ipcMain }) => {
      try {
        ipcMain.removeHandler('run:submit')
      } catch {
        // already removed
      }
    })
  }
}

async function captureAndResetSpecState(appWindow: Page): Promise<SeedSpecContext> {
  const result = await appWindow.evaluate(async () => {
    const kata = window.kata
    const bootstrap = await kata?.appBootstrap?.()
    const spaceId = bootstrap?.activeSpaceId ?? null
    const sessionId = bootstrap?.activeSessionId ?? null
    if (!spaceId || !sessionId) {
      return {
        ok: false as const,
        reason: 'Missing active space/session while seeding KAT-189 parity timeline.'
      }
    }

    const specGet = kata?.specGet
    const specSave = kata?.specSave
    if (typeof specGet !== 'function' || typeof specSave !== 'function') {
      return {
        ok: false as const,
        reason: 'specGet/specSave APIs are unavailable for KAT-189 parity seed.'
      }
    }

    const existingSpec = await specGet({ spaceId, sessionId })
    const initialSpecDocument =
      existingSpec && typeof existingSpec.markdown === 'string'
        ? {
            markdown: existingSpec.markdown,
            ...(typeof existingSpec.appliedRunId === 'string' && { appliedRunId: existingSpec.appliedRunId })
          }
        : null

    const clearInput: {
      spaceId: string
      sessionId: string
      markdown: string
      appliedRunId?: string
    } = {
      spaceId,
      sessionId,
      markdown: ''
    }

    // spec:save retains appliedRunId when omitted; set empty string to clear
    // prior applied state so "Apply Draft to Spec" deterministically appears.
    if (initialSpecDocument?.appliedRunId !== undefined) {
      clearInput.appliedRunId = ''
    }

    await specSave(clearInput)

    return {
      ok: true as const,
      context: {
        spaceId,
        sessionId,
        initialSpecDocument
      }
    }
  })

  if (!result.ok) {
    throw new Error(result.reason)
  }

  return result.context
}

async function restoreSpecState(appWindow: Page, context: SeedSpecContext): Promise<void> {
  const restoreInput = context.initialSpecDocument
    ? {
        spaceId: context.spaceId,
        sessionId: context.sessionId,
        markdown: context.initialSpecDocument.markdown,
        ...(context.initialSpecDocument.appliedRunId !== undefined && {
          appliedRunId: context.initialSpecDocument.appliedRunId
        })
      }
    : {
        spaceId: context.spaceId,
        sessionId: context.sessionId,
        markdown: ''
      }

  await appWindow.evaluate(
    async (input: { spaceId: string; sessionId: string; markdown: string; appliedRunId?: string }) => {
      const specSave = window.kata?.specSave
      if (typeof specSave !== 'function') {
        throw new Error('specSave API unavailable while restoring KAT-189 parity seed state.')
      }
      await specSave(input)
    },
    restoreInput
  )
}

async function resetRendererRuntimeState(appWindow: Page): Promise<void> {
  await appWindow.reload({ waitUntil: 'load' })
  await appWindow.waitForSelector('#root > *', { state: 'attached' })
  await ensureWorkspaceShell(appWindow)
  await ensureSendButtonReady(appWindow)
}

export async function seedSpec04ParityTimeline({
  appWindow,
  electronApp
}: SeedSpec04ParityTimelineParams): Promise<Spec04ParityTimelineSeed> {
  await ensureWorkspaceShell(appWindow)
  await ensureSendButtonReady(appWindow)
  const seedContext = await captureAndResetSpecState(appWindow)
  // Refresh renderer hooks so they pick up the cleared persisted spec state.
  await resetRendererRuntimeState(appWindow)
  const cleanupRunSubmitStub = await installRunSubmitStub(electronApp, RUN_ID)

  try {
    const messageInput = appWindow.getByLabel('Message input')
    const sendButton = appWindow.getByRole('button', { name: 'Send' })

    await expect(messageInput).toBeVisible({ timeout: 10_000 })
    await expect(sendButton).toBeVisible({ timeout: 10_000 })

    await messageInput.fill(BASELINE_PROMPT)
    await expect(sendButton).toBeEnabled({ timeout: 10_000 })
    await sendButton.click()

    return {
      showMock10SpecDraftReview: async () => {
        await broadcastRunEvent(electronApp, {
          type: 'message_appended',
          runId: RUN_ID,
          message: {
            id: 'agent-spec-updated',
            role: 'agent',
            content: MOCK10_SPEC_UPDATED_CONTENT,
            createdAt: '2026-03-04T12:00:00.000Z'
          }
        })
      },
      showMock11ArchitectureProposal: async () => {
        await broadcastRunEvent(electronApp, {
          type: 'message_appended',
          runId: RUN_ID,
          message: {
            id: 'agent-architecture-proposal',
            role: 'agent',
            content: MOCK11_ARCHITECTURE_CONTENT,
            createdAt: '2026-03-04T12:00:10.000Z'
          }
        })

        const rightPanel = appWindow.getByTestId('right-panel')
        const editMarkdownButton = rightPanel.getByRole('button', { name: 'Edit markdown' })
        await expect(editMarkdownButton).toBeVisible({ timeout: 10_000 })
        await editMarkdownButton.click()

        const specEditor = appWindow.getByLabel('Spec markdown editor')
        await expect(specEditor).toBeVisible({ timeout: 10_000 })
        await specEditor.fill(MOCK11_ARCHITECTURE_SPEC_MARKDOWN)
        await rightPanel.getByRole('button', { name: 'Save' }).click()

        await expect(rightPanel.getByRole('heading', { name: 'Goal', exact: true })).toBeVisible({
          timeout: 10_000
        })
        await expect(rightPanel.getByText('Electron + TypeScript keeps desktop iteration stable.')).toBeVisible({
          timeout: 10_000
        })
      },
      showMock12TechStackProposal: async () => {
        await broadcastRunEvent(electronApp, {
          type: 'message_appended',
          runId: RUN_ID,
          message: {
            id: 'agent-tech-stack-proposal',
            role: 'agent',
            content: MOCK12_TECH_STACK_PROPOSAL_CONTENT,
            createdAt: '2026-03-04T12:00:20.000Z'
          }
        })
      },
      showMock14TaskTracking: async () => {
        await appWindow.evaluate(
          async ({
            inputSpaceId,
            inputSessionId,
            markdown,
            appliedRunId
          }: {
            inputSpaceId: string
            inputSessionId: string
            markdown: string
            appliedRunId: string
          }) => {
            const specSave = window.kata?.specSave
            if (typeof specSave !== 'function') {
              throw new Error('specSave API unavailable while seeding mock14 task tracking state.')
            }

            await specSave({
              spaceId: inputSpaceId,
              sessionId: inputSessionId,
              markdown,
              appliedRunId
            })
          },
          {
            inputSpaceId: seedContext.spaceId,
            inputSessionId: seedContext.sessionId,
            markdown: MOCK14_TASK_TRACKING_SPEC_MARKDOWN,
            appliedRunId: RUN_ID
          }
        )

        await appWindow.reload({ waitUntil: 'load' })
        await appWindow.waitForSelector('#root > *', { state: 'attached' })
        await ensureWorkspaceShell(appWindow)

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

        await expect(rightPanel.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible({
          timeout: 10_000
        })
        await expect(rightPanel.getByText(MOCK14_TASK_TITLES[1])).toBeVisible({ timeout: 10_000 })

        const activeContext = await appWindow.evaluate(async () => {
          const bootstrap = await window.kata?.appBootstrap?.()
          return {
            sessionId: bootstrap?.activeSessionId ?? null
          }
        })

        if (!activeContext.sessionId) {
          throw new Error('Missing active session while seeding mock14 task activity snapshot.')
        }

        const snapshot: TaskActivitySnapshot = {
          sessionId: activeContext.sessionId,
          runId: RUN_ID,
          items: [
            {
              id: 'task-review-the-latest-prompt',
              title: MOCK14_TASK_TITLES[0],
              status: 'not_started',
              activityLevel: 'none',
              updatedAt: '2099-01-01T00:00:10.000Z'
            },
            {
              id: 'task-apply-the-structured-draft',
              title: MOCK14_TASK_TITLES[1],
              status: 'in_progress',
              activityLevel: 'high',
              activityDetail: MOCK14_HIGH_ACTIVITY_DETAIL,
              activeAgentId: 'spec',
              updatedAt: '2099-01-01T00:00:11.000Z'
            },
            {
              id: 'task-keep-the-runtime-wiring-stable',
              title: MOCK14_TASK_TITLES[2],
              status: 'complete',
              activityLevel: 'none',
              updatedAt: '2099-01-01T00:00:12.000Z'
            }
          ],
          counts: { not_started: 1, in_progress: 1, blocked: 0, complete: 1 }
        }

        await broadcastRunEvent(electronApp, {
          type: 'task_activity_snapshot',
          snapshot
        })
      },
      cleanup: async () => {
        let restoreError: unknown
        try {
          await restoreSpecState(appWindow, seedContext)
        } catch (error) {
          restoreError = error
        }

        try {
          await cleanupRunSubmitStub()
        } catch (error) {
          if (!restoreError) {
            restoreError = error
          }
        }

        try {
          await resetRendererRuntimeState(appWindow)
        } catch (error) {
          if (!restoreError) {
            restoreError = error
          }
        }

        if (restoreError) {
          throw restoreError
        }
      }
    }
  } catch (error) {
    try {
      await restoreSpecState(appWindow, seedContext)
    } finally {
      await cleanupRunSubmitStub()
      await resetRendererRuntimeState(appWindow)
    }
    throw error
  }
}
