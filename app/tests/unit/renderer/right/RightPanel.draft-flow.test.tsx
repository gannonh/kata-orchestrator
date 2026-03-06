import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RightPanel } from '../../../../src/renderer/components/layout/RightPanel'
import { mockProject } from '../../../../src/renderer/mock/project'
import type { PersistedSpecDocument } from '../../../../src/shared/types/spec-document'

vi.mock('lucide-react', () => ({
  ChevronDown: () => null,
  ChevronUp: () => null,
  Bot: () => null,
  FileText: () => null,
  Globe: () => null,
  Plus: () => null,
  Terminal: () => null,
  X: () => null
}))

const mockSpecGet = vi.fn()
const mockSpecSave = vi.fn()
const mockSpecApplyDraft = vi.fn()

function buildPersistedSpecDocument(
  markdown: string,
  overrides: Partial<PersistedSpecDocument> = {}
): PersistedSpecDocument {
  const updatedAt = overrides.updatedAt ?? '2026-03-03T00:00:00.000Z'
  const baseSourceRunId =
    overrides.frontmatter?.sourceRunId ?? overrides.appliedRunId
  const frontmatter = {
    status: 'drafting' as const,
    updatedAt,
    ...(baseSourceRunId !== undefined && { sourceRunId: baseSourceRunId }),
    ...overrides.frontmatter
  }

  return {
    sourcePath: '/tmp/repo/.kata/sessions/session-1/notes/spec.md',
    raw:
      overrides.raw ??
      [
        '---',
        `status: ${frontmatter.status}`,
        `updatedAt: ${frontmatter.updatedAt}`,
        ...(frontmatter.sourceRunId ? [`sourceRunId: ${frontmatter.sourceRunId}`] : []),
        '---',
        '',
        markdown
      ].join('\n'),
    markdown,
    frontmatter,
    diagnostics: overrides.diagnostics ?? [],
    updatedAt,
    ...(frontmatter.sourceRunId !== undefined && { appliedRunId: frontmatter.sourceRunId }),
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  mockSpecGet.mockResolvedValue(null)
  mockSpecSave.mockImplementation(
    async (input: { markdown: string; status?: 'drafting' | 'ready'; sourceRunId?: string }) =>
      buildPersistedSpecDocument(input.markdown, {
        updatedAt: '2026-03-05T00:00:00.000Z',
        frontmatter: {
          status: input.status ?? 'drafting',
          updatedAt: '2026-03-05T00:00:00.000Z',
          ...(input.sourceRunId !== undefined && { sourceRunId: input.sourceRunId })
        }
      })
  )
  mockSpecApplyDraft.mockImplementation(
    async (input: { draft: { runId: string; content: string } }) =>
      buildPersistedSpecDocument(input.draft.content, {
        updatedAt: '2026-03-05T00:01:00.000Z',
        frontmatter: {
          status: 'drafting',
          updatedAt: '2026-03-05T00:01:00.000Z',
          sourceRunId: input.draft.runId
        }
      })
  )

  window.kata = {
    ...window.kata,
    specGet: mockSpecGet,
    specSave: mockSpecSave,
    specApplyDraft: mockSpecApplyDraft
  }
})

afterEach(() => {
  cleanup()
  window.kata = undefined
})

describe('RightPanel draft flow', () => {
  it('applies the latest run draft into structured spec content and toggles task state', async () => {
    const onTaskActivitySnapshotChange = vi.fn()

    render(
      <RightPanel
        project={mockProject}
        spaceId="space-1"
        sessionId="session-1"
        onTaskActivitySnapshotChange={onTaskActivitySnapshotChange}
        taskActivitySnapshot={{
          sessionId: 'session-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-parse-spec-sections',
              title: 'Parse spec sections',
              status: 'in_progress',
              activityLevel: 'high',
              activityDetail: 'Starting implementation for the space creation flow.',
              activeAgentId: 'spec',
              updatedAt: '2026-03-04T00:00:00.000Z'
            }
          ],
          counts: { not_started: 0, in_progress: 1, blocked: 0, complete: 0 }
        }}
        latestDraft={{
          runId: 'run-1',
          generatedAt: '2026-03-02T12:00:00.000Z',
          content: [
            '## Goal',
            'Build a prompt-to-spec demo',
            '',
            '## Acceptance Criteria',
            '1. Render the structured sections',
            '',
            '## Non-goals',
            '- Do not ship comments',
            '',
            '## Assumptions',
            '- The latest prompt is available',
            '',
            '## Verification Plan',
            '1. Run the renderer tests',
            '',
            '## Rollback Plan',
            '1. Clear the spec panel state',
            '',
            '## Tasks',
            '- [ ] Parse spec sections'
          ].join('\n')
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Apply Draft to Spec' }))

    await waitFor(() => {
      expect(mockSpecApplyDraft).toHaveBeenCalledWith({
        spaceId: 'space-1',
        sessionId: 'session-1',
        draft: expect.objectContaining({ runId: 'run-1' })
      })
      expect(screen.getByText('Build a prompt-to-spec demo')).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()
      expect(screen.getByText('Starting implementation for the space creation flow.')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Parse spec sections' }))

    await waitFor(() => {
      expect(screen.getByText('In Progress')).toBeTruthy()
      expect(mockSpecSave).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'space-1',
          sessionId: 'session-1',
          markdown: expect.stringContaining('[/] Parse spec sections'),
          sourceRunId: 'run-1',
          status: 'drafting'
        })
      )
      expect(onTaskActivitySnapshotChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-1',
          counts: {
            not_started: 0,
            in_progress: 1,
            blocked: 0,
            complete: 0
          },
          items: [
            expect.objectContaining({
              id: 'task-parse-spec-sections',
              title: 'Parse spec sections',
              status: 'in_progress'
            })
          ]
        })
      )
    })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Parse spec sections' }))

    await waitFor(() => {
      expect(screen.getByText('Complete')).toBeTruthy()
      expect(mockSpecSave).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'space-1',
          sessionId: 'session-1',
          markdown: expect.stringContaining('[x] Parse spec sections'),
          sourceRunId: 'run-1',
          status: 'drafting'
        })
      )
    })
  })

  it('applies manual task toggle state even when an older snapshot exists', async () => {
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument(
        ['## Goal', 'Persisted goal', '', '## Tasks', '- [ ] Initial task'].join('\n'),
        {
          updatedAt: '2026-03-03T00:00:00.000Z'
        }
      )
    )

    const { rerender } = render(
      <RightPanel
        project={mockProject}
        spaceId="space-1"
        sessionId="session-1"
        taskActivitySnapshot={{
          sessionId: 'session-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-initial-task',
              title: 'Initial task',
              status: 'not_started',
              activityLevel: 'none',
              updatedAt: '2026-03-03T00:00:00.000Z'
            }
          ],
          counts: { not_started: 1, in_progress: 0, blocked: 0, complete: 0 }
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Persisted goal')).toBeTruthy()
      expect(screen.getByText('Not Started')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Initial task' }))

    await waitFor(() => {
      expect(screen.getByText('In Progress')).toBeTruthy()
      expect(mockSpecSave).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'space-1',
          sessionId: 'session-1',
          markdown: expect.stringContaining('[/] Initial task')
        })
      )
    })

    rerender(
      <RightPanel
        project={mockProject}
        spaceId="space-1"
        sessionId="session-1"
        taskActivitySnapshot={{
          sessionId: 'session-1',
          runId: 'run-2',
          items: [
            {
              id: 'task-initial-task',
              title: 'Initial task',
              status: 'complete',
              activityLevel: 'none',
              updatedAt: '2099-01-01T00:00:00.000Z'
            }
          ],
          counts: { not_started: 0, in_progress: 0, blocked: 0, complete: 1 }
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Complete')).toBeTruthy()
    })
  })

  it('enters markdown edit mode and saves the updated document', async () => {
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument(
        ['## Goal', 'Original goal', '', '## Tasks', '- [ ] Initial task'].join('\n'),
        {
          updatedAt: '2026-03-03T00:00:00.000Z'
        }
      )
    )

    render(
      <RightPanel
        project={mockProject}
        spaceId="space-1"
        sessionId="session-1"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Original goal')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit markdown' }))
    fireEvent.change(screen.getByLabelText('Spec markdown editor'), {
      target: { value: ['## Goal', 'Updated goal from editor', '', '## Tasks', '- [ ] Initial task'].join('\n') }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Updated goal from editor')).toBeTruthy()
      expect(mockSpecSave).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'space-1',
          sessionId: 'session-1',
          markdown: expect.stringContaining('Updated goal from editor')
        })
      )
    })
  })

  it('surfaces and applies a newer run draft after a prior draft has already been applied', async () => {
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument(
        [
          '## Goal',
          'Persisted applied goal',
          '',
          '## Tasks',
          '- [ ] Initial task'
        ].join('\n'),
        {
          updatedAt: '2026-03-03T00:00:00.000Z',
          frontmatter: {
            status: 'drafting',
            updatedAt: '2026-03-03T00:00:00.000Z',
            sourceRunId: 'run-1'
          }
        }
      )
    )

    render(
      <RightPanel
        project={mockProject}
        spaceId="space-1"
        sessionId="session-1"
        latestDraft={{
          runId: 'run-2',
          generatedAt: '2026-03-03T00:01:00.000Z',
          content: ['## Goal', 'Newer draft that should not force apply state'].join('\n')
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Apply Draft to Spec' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Apply Draft to Spec' }))

    await waitFor(() => {
      expect(mockSpecApplyDraft).toHaveBeenCalledWith({
        spaceId: 'space-1',
        sessionId: 'session-1',
        draft: expect.objectContaining({ runId: 'run-2' })
      })
      expect(screen.getByText('Newer draft that should not force apply state')).toBeTruthy()
    })
  })

  it('cancels markdown editing and restores the persisted content', async () => {
    const persistedMarkdown = [
      '## Goal',
      'Persisted goal',
      '',
      '## Tasks',
      '- [ ] Initial task'
    ].join('\n')
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument(persistedMarkdown, {
        updatedAt: '2026-03-03T00:00:00.000Z'
      })
    )

    render(
      <RightPanel
        project={mockProject}
        spaceId="space-1"
        sessionId="session-1"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Persisted goal')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit markdown' }))
    fireEvent.change(screen.getByLabelText('Spec markdown editor'), {
      target: { value: ['## Goal', 'Unsaved draft text', '', '## Tasks', '- [ ] Initial task'].join('\n') }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Persisted goal')).toBeTruthy()
    expect(screen.queryByText('Unsaved draft text')).toBeNull()
    expect(mockSpecSave).not.toHaveBeenCalledWith(
      expect.objectContaining({
        markdown: expect.stringContaining('Unsaved draft text')
      })
    )
  })
})
