import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SpecTab } from '../../../../src/renderer/components/right/SpecTab'
import { mockProject } from '../../../../src/renderer/mock/project'

const structuredFixtureDocument = {
  sourcePath: '/tmp/repo/.kata/sessions/session-1/notes/spec.md',
  raw: '---\nstatus: drafting\nupdatedAt: 2026-03-06T00:00:00.000Z\nsourceRunId: run-1\n---\n',
  markdown: [
    '## Goal',
    'Publish a clear `spec` surface.',
    '',
    '## Acceptance Criteria',
    '1. Render canonical sections.',
    '',
    '## Non-goals',
    '- No persistence redesign.',
    '',
    '## Assumptions',
    '- `main` is the contract.',
    '',
    '## Verification Plan',
    '1. Run renderer tests.',
    '',
    '## Rollback Plan',
    '1. Revert the renderer changes.',
    '',
    '## Tasks',
    '- [ ] Freeze contract',
    '- [/] Render markdown',
    '- [x] Preserve ids'
  ].join('\n'),
  status: 'drafting' as const,
  diagnostics: [],
  sections: {
    goal: 'Publish a clear `spec` surface.',
    acceptanceCriteria: ['Render canonical sections.'],
    nonGoals: ['No persistence redesign.'],
    assumptions: ['`main` is the contract.'],
    verificationPlan: ['Run renderer tests.'],
    rollbackPlan: ['Revert the renderer changes.']
  },
  tasks: [
    {
      id: 'task-freeze-contract',
      title: 'Freeze contract',
      status: 'not_started' as const,
      markdownLineIndex: 19
    },
    {
      id: 'task-render-markdown',
      title: 'Render markdown',
      status: 'in_progress' as const,
      markdownLineIndex: 20
    },
    {
      id: 'task-preserve-ids',
      title: 'Preserve ids',
      status: 'complete' as const,
      markdownLineIndex: 21
    }
  ],
  updatedAt: '2026-03-06T00:00:00.000Z',
  appliedRunId: 'run-1'
}

afterEach(() => {
  cleanup()
})

describe('SpecTab structured states', () => {
  it('shows onboarding copy while generating', () => {
    render(
      <SpecTab
        project={mockProject}
        specState={{ mode: 'generating' }}
      />
    )

    expect(screen.getByText('Creating Spec')).toBeTruthy()
    expect(screen.getByText(/intentionally deferred in this release/i)).toBeTruthy()
  })

  it('renders a draft apply card when the latest draft is ready', () => {
    const onApplyDraft = vi.fn()

    render(
      <SpecTab
        project={mockProject}
        specState={{
          mode: 'draft_ready',
          latestDraft: {
            runId: 'run-1',
            generatedAt: '2026-03-02T12:00:00.000Z',
            content: '## Goal\nShip it'
          },
          onApplyDraft,
          commentStatusNote: 'Comments are deferred.'
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Apply Draft to Spec' }))

    expect(onApplyDraft).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/run-1/)).toBeTruthy()
  })

  it('renders structured sections and calls task toggles', () => {
    const onToggleTask = vi.fn()
    const onEditMarkdown = vi.fn()

    render(
      <SpecTab
        project={mockProject}
        specState={{
          mode: 'structured_view',
          document: {
            sourcePath: '/tmp/repo/.kata/sessions/session-1/notes/spec.md',
            raw: ['## Goal', 'Ship the panel', '', '## Tasks', '- [ ] Parse spec'].join('\n'),
            markdown: ['## Goal', 'Ship the panel', '', '## Tasks', '- [ ] Parse spec'].join('\n'),
            status: 'drafting',
            diagnostics: [],
            sections: {
              goal: 'Ship the panel',
              acceptanceCriteria: ['Render the required sections'],
              nonGoals: ['Do not ship comments'],
              assumptions: ['The latest run is available'],
              verificationPlan: ['Run renderer tests'],
              rollbackPlan: ['Clear the draft state']
            },
            tasks: [
              {
                id: 'task-parse-spec',
                title: 'Parse spec',
                status: 'not_started',
                markdownLineIndex: 4
              }
            ],
            updatedAt: '2026-03-02T12:00:00.000Z',
            appliedRunId: 'run-1'
          },
          taskActivitySnapshot: {
            sessionId: 'session-1',
            runId: 'run-1',
            items: [
              {
                id: 'task-parse-spec',
                title: 'Parse spec',
                status: 'in_progress',
                activityLevel: 'high',
                activityDetail: "I'm starting implementation for the space creation flow.",
                activeAgentId: 'spec',
                updatedAt: '2026-03-02T12:01:00.000Z'
              }
            ],
            counts: { not_started: 0, in_progress: 1, blocked: 0, complete: 0 }
          },
          onToggleTask,
          onEditMarkdown,
          commentStatusNote: 'Comments are deferred.'
        }}
      />
    )

    expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Acceptance Criteria' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Non-goals' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Assumptions' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Verification Plan' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Rollback Plan' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeTruthy()
    expect(screen.getByText("I'm starting implementation for the space creation flow.")).toBeTruthy()
    expect(screen.getByLabelText('Active specialist')).toBeTruthy()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Parse spec' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit markdown' }))

    expect(onToggleTask).toHaveBeenCalledWith('task-parse-spec')
    expect(onEditMarkdown).toHaveBeenCalledTimes(1)
  })

  it('renders markdown editing controls and delegates editor callbacks', () => {
    const onDraftMarkdownChange = vi.fn()
    const onSaveMarkdown = vi.fn()
    const onCancelEditing = vi.fn()

    render(
      <SpecTab
        project={mockProject}
        specState={{
          mode: 'editing',
          document: {
            sourcePath: '/tmp/repo/.kata/sessions/session-1/notes/spec.md',
            raw: ['## Goal', 'Initial goal'].join('\n'),
            markdown: ['## Goal', 'Initial goal'].join('\n'),
            status: 'drafting',
            diagnostics: [],
            sections: {
              goal: 'Initial goal',
              acceptanceCriteria: [],
              nonGoals: [],
              assumptions: [],
              verificationPlan: [],
              rollbackPlan: []
            },
            tasks: [],
            updatedAt: '2026-03-02T12:00:00.000Z'
          },
          draftMarkdown: ['## Goal', 'Initial goal'].join('\n'),
          onDraftMarkdownChange,
          onSaveMarkdown,
          onCancelEditing,
          commentStatusNote: 'Comments are deferred.'
        }}
      />
    )

    fireEvent.change(screen.getByLabelText('Spec markdown editor'), {
      target: { value: ['## Goal', 'Edited goal'].join('\n') }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('heading', { name: 'Edit Spec Markdown' })).toBeTruthy()
    expect(onDraftMarkdownChange).toHaveBeenCalledWith(['## Goal', 'Edited goal'].join('\n'))
    expect(onCancelEditing).toHaveBeenCalledTimes(1)
    expect(onSaveMarkdown).toHaveBeenCalledTimes(1)
  })

  it('shows fallback goal copy when structured goal text is empty', () => {
    render(
      <SpecTab
        project={mockProject}
        specState={{
          mode: 'structured_view',
          document: {
            sourcePath: '/tmp/repo/.kata/sessions/session-1/notes/spec.md',
            raw: ['## Goal', '', '## Tasks'].join('\n'),
            markdown: ['## Goal', '', '## Tasks'].join('\n'),
            status: 'drafting',
            diagnostics: [],
            sections: {
              goal: '',
              acceptanceCriteria: [],
              nonGoals: [],
              assumptions: [],
              verificationPlan: [],
              rollbackPlan: []
            },
            tasks: [],
            updatedAt: '2026-03-02T12:00:00.000Z'
          },
          onToggleTask: () => undefined,
          onEditMarkdown: () => undefined,
          commentStatusNote: 'Comments are deferred.'
        }}
      />
    )

    expect(screen.getByText('No goal yet.')).toBeTruthy()
  })

  it('renders a realistic structured-view fixture with markdown-rich canonical sections', () => {
    render(
      <SpecTab
        project={mockProject}
        specState={{
          mode: 'structured_view',
          document: structuredFixtureDocument,
          onToggleTask: vi.fn(),
          onEditMarkdown: vi.fn(),
          commentStatusNote: 'Comments are deferred.'
        }}
      />
    )

    expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()
    expect(screen.getByText('spec').tagName).toBe('CODE')
    expect(screen.getByText('main').tagName).toBe('CODE')
    expect(screen.getByRole('checkbox', { name: 'Render markdown' })).toBeTruthy()
  })

  it('shows invalid frontmatter diagnostics without dropping the last good structured view', () => {
    render(
      <SpecTab
        project={mockProject}
        specState={{
          mode: 'structured_view',
          document: {
            ...structuredFixtureDocument,
            diagnostics: [
              {
                code: 'invalid_frontmatter_yaml',
                message: 'Frontmatter must contain valid key:value entries'
              }
            ]
          },
          onToggleTask: vi.fn(),
          onEditMarkdown: vi.fn(),
          commentStatusNote: 'Comments are deferred.'
        }}
      />
    )

    expect(screen.getByText(/invalid_frontmatter_yaml/i)).toBeTruthy()
    expect(screen.getAllByText(/notes\/spec\.md/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()
  })
})
