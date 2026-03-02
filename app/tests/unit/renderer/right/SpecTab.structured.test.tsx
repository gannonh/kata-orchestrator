import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SpecTab } from '../../../../src/renderer/components/right/SpecTab'
import { mockProject } from '../../../../src/renderer/mock/project'

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
    expect(screen.getByText(/intentionally deferred in KAT-160/i)).toBeTruthy()
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
            markdown: ['## Goal', 'Ship the panel', '', '## Tasks', '- [ ] Parse spec'].join('\n'),
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
                id: 'task-1',
                title: 'Parse spec',
                status: 'not_started',
                markdownLineIndex: 4
              }
            ],
            updatedAt: '2026-03-02T12:00:00.000Z',
            appliedRunId: 'run-1'
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

    fireEvent.click(screen.getByRole('checkbox', { name: 'Parse spec' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit markdown' }))

    expect(onToggleTask).toHaveBeenCalledWith('task-1')
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
            markdown: ['## Goal', 'Initial goal'].join('\n'),
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
            markdown: ['## Goal', '', '## Tasks'].join('\n'),
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
})
