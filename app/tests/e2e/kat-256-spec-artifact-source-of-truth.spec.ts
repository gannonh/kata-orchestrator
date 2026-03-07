import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from './fixtures/electron'
import { ensureWorkspaceShell } from './helpers/shell-view'

type ActiveWorkspaceContext = {
  spaceId: string
  sessionId: string
}

type PersistedSpecDocument = {
  sourcePath: string
  raw: string
  markdown: string
  frontmatter: {
    status: 'drafting' | 'ready'
    updatedAt: string
    sourceRunId?: string
  }
  diagnostics: Array<{
    code: string
    message: string
  }>
  updatedAt: string
  lastGoodMarkdown?: string
}

const evidenceDir = path.resolve(process.cwd(), 'test-results/kat-256')

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
      label: 'KAT-256 Spec Artifact Evidence'
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
    throw new Error('Unable to resolve active space/session for KAT-256.')
  }

  return context
}

async function getSpecDocument(
  appWindow: import('@playwright/test').Page,
  context: ActiveWorkspaceContext
): Promise<PersistedSpecDocument> {
  const document = await appWindow.evaluate(
    async ({ spaceId, sessionId }) => {
      return await window.kata?.specGet?.({ spaceId, sessionId })
    },
    context
  )

  if (!document) {
    throw new Error('specGet returned null for KAT-256.')
  }

  return document as PersistedSpecDocument
}

async function reloadRenderer(appWindow: import('@playwright/test').Page): Promise<void> {
  await appWindow.reload({ waitUntil: 'load' })
  await appWindow.waitForSelector('#root > *', { state: 'attached' })
  await expect(appWindow.getByTestId('app-shell-root')).toBeVisible({ timeout: 10_000 })
  await appWindow.getByRole('tab', { name: 'Spec' }).click()
}

test.describe('KAT-256 spec artifact source of truth @uat', () => {
  test('creates the canonical notes/spec.md scaffold, reflects external edits after reload, and surfaces invalid frontmatter diagnostics', async ({
    appWindow,
    managedTestRootDir
  }) => {
    await ensureWorkspaceShell(appWindow, { workspacePath: managedTestRootDir })
    await fs.mkdir(evidenceDir, { recursive: true })

    const context = await resolveActiveSessionContext(appWindow)
    const initialDocument = await getSpecDocument(appWindow, context)
    const rightPanel = appWindow.getByTestId('right-panel')

    expect(initialDocument.sourcePath).toContain('/.kata/sessions/')
    expect(initialDocument.sourcePath).toMatch(/\/notes\/spec\.md$/)
    expect(initialDocument.frontmatter.status).toBe('drafting')
    expect(initialDocument.markdown).toContain('## Goal')
    await expect(rightPanel.getByRole('button', { name: 'Apply Draft to Spec' })).toHaveCount(0)

    const createdRaw = await fs.readFile(initialDocument.sourcePath, 'utf8')
    expect(createdRaw).toContain('status: drafting')
    expect(createdRaw).toContain('## Goal')
    expect(createdRaw).toContain('## Tasks')

    const externalEditRaw = [
      '---',
      'status: ready',
      'updatedAt: 2026-03-06T20:00:00.000Z',
      'sourceRunId: run-kat-256-external',
      '---',
      '',
      '## Goal',
      'Reflect external edit after reload.',
      '',
      '## Acceptance Criteria',
      '1. Reload the renderer and show the edited content.',
      '',
      '## Tasks',
      '- [x] Verify external edits'
    ].join('\n')
    await fs.writeFile(initialDocument.sourcePath, externalEditRaw, 'utf8')

    await reloadRenderer(appWindow)
    await expect(rightPanel.getByText('Reflect external edit after reload.')).toBeVisible()
    await expect(
      rightPanel.getByText('Reload the renderer and show the edited content.')
    ).toBeVisible()
    await expect(rightPanel.getByText('Trace: run-kat-256-external')).toBeVisible()
    await expect(rightPanel.getByRole('button', { name: 'Apply Draft to Spec' })).toHaveCount(0)

    const reloadedDocument = await getSpecDocument(appWindow, context)
    expect(reloadedDocument.frontmatter.status).toBe('ready')
    expect(reloadedDocument.frontmatter.sourceRunId).toBe('run-kat-256-external')

    const invalidFrontmatterRaw = [
      '---',
      'status: [bad',
      '---',
      '',
      '## Goal',
      'Reflect external edit after reload.',
      '',
      '## Acceptance Criteria',
      '1. Reload the renderer and show the edited content.',
      '',
      '## Tasks',
      '- [x] Verify external edits'
    ].join('\n')
    await fs.writeFile(initialDocument.sourcePath, invalidFrontmatterRaw, 'utf8')

    await reloadRenderer(appWindow)
    await expect(rightPanel.getByText('Spec artifact issue')).toBeVisible()
    await expect(rightPanel.getByText(/invalid_frontmatter_yaml/i)).toBeVisible()
    await expect(rightPanel.getByText(/notes\/spec\.md/i).first()).toBeVisible()
    await expect(rightPanel.getByText('Reflect external edit after reload.')).toBeVisible()
    await expect(rightPanel.getByRole('button', { name: 'Apply Draft to Spec' })).toHaveCount(0)

    const invalidDocument = await getSpecDocument(appWindow, context)
    expect(invalidDocument.diagnostics[0]?.code).toBe('invalid_frontmatter_yaml')

    await appWindow.screenshot({
      path: path.join(evidenceDir, `kat-256-invalid-frontmatter-${Date.now()}.png`),
      fullPage: true
    })

    await fs.writeFile(
      path.join(evidenceDir, `kat-256-evidence-${Date.now()}.json`),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          sourcePath: initialDocument.sourcePath,
          scaffoldRaw: createdRaw,
          reloadedDocument,
          invalidDocument
        },
        null,
        2
      ),
      'utf8'
    )
  })
})
