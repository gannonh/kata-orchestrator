import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RightPanel } from '../../../../src/renderer/components/layout/RightPanel'
import { mockProject } from '../../../../src/renderer/mock/project'
import type { PersistedSpecDocument } from '../../../../src/shared/types/spec-document'

vi.mock('lucide-react', () => ({
  ChevronDown: () => null,
  ChevronUp: () => null,
  Bot: () => null,
  CheckCircle2: () => null,
  Circle: () => null,
  FileText: () => null,
  Globe: () => null,
  LoaderCircle: () => null,
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
  const baseSourceRunId = overrides.frontmatter?.sourceRunId ?? overrides.appliedRunId
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
  mockSpecApplyDraft.mockResolvedValue(
    buildPersistedSpecDocument('# should stay unused')
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

describe('RightPanel markdown-first spec flow', () => {
  it('renders the persisted markdown artifact with no draft-apply gate', async () => {
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument(
        [
          '# Live spec',
          '',
          '## Goal',
          'Persisted markdown is the source of truth.',
          '',
          '## Tasks',
          '- [ ] Leave task pointers in markdown'
        ].join('\n'),
        {
          updatedAt: '2026-03-03T00:00:00.000Z',
          frontmatter: {
            status: 'ready',
            updatedAt: '2026-03-03T00:00:00.000Z',
            sourceRunId: 'run-persisted'
          }
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
      expect(screen.getByRole('heading', { name: 'Live spec', level: 1 })).toBeTruthy()
      expect(screen.getByText('Persisted markdown is the source of truth.')).toBeTruthy()
      expect(screen.getByText('Leave task pointers in markdown')).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Apply Draft to Spec' })).toBeNull()
      expect(mockSpecApplyDraft).not.toHaveBeenCalled()
    })
  })

  it('enters markdown edit mode and saves the updated document', async () => {
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument(
        ['# Live spec', '', '## Goal', 'Original goal'].join('\n'),
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
      target: { value: ['# Live spec', '', '## Goal', 'Updated goal from editor'].join('\n') }
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

  it('shows diagnostics while keeping the last-good markdown visible', async () => {
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument('## Goal\nBroken replacement', {
        diagnostics: [
          {
            code: 'invalid_frontmatter_yaml',
            message: 'Frontmatter must contain valid key:value entries'
          }
        ],
        lastGoodMarkdown: ['# Live spec', '', '## Goal', 'Last good visible markdown'].join('\n')
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
      expect(screen.getByText('Spec artifact issue')).toBeTruthy()
      expect(screen.getByText(/invalid_frontmatter_yaml/i)).toBeTruthy()
      expect(screen.getByText('Last good visible markdown')).toBeTruthy()
      expect(screen.queryByText('Broken replacement')).toBeNull()
    })
  })

  it('restores the persisted markdown when edit mode is cancelled', async () => {
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument(
        ['# Live spec', '', '## Goal', 'Original goal'].join('\n'),
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
      target: { value: ['# Live spec', '', '## Goal', 'Unsaved editor change'].join('\n') }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Original goal')).toBeTruthy()
    expect(screen.queryByText('Unsaved editor change')).toBeNull()
    expect(mockSpecSave).not.toHaveBeenCalled()
  })
})
