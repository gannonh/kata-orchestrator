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
})
