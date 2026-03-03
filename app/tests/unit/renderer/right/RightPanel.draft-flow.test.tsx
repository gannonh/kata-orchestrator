import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { RightPanel } from '../../../../src/renderer/components/layout/RightPanel'
import { mockProject } from '../../../../src/renderer/mock/project'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('RightPanel draft flow', () => {
  it('applies the latest run draft into structured spec content and toggles task state', () => {
    render(
      <RightPanel
        project={mockProject}
        spaceId="space-1"
        sessionId="session-1"
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

    expect(screen.getByText('Build a prompt-to-spec demo')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Parse spec sections' }))

    expect(screen.getByText('In Progress')).toBeTruthy()
    expect(window.localStorage.getItem('kata.spec-panel.v1:space-1:session-1')).toContain('[/] Parse spec sections')
  })

  it('enters markdown edit mode and saves the updated document', () => {
    window.localStorage.setItem(
      'kata.spec-panel.v1:space-1:session-1',
      JSON.stringify({
        markdown: ['## Goal', 'Original goal', '', '## Tasks', '- [ ] Initial task'].join('\n')
      })
    )

    render(
      <RightPanel
        project={mockProject}
        spaceId="space-1"
        sessionId="session-1"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit markdown' }))
    fireEvent.change(screen.getByLabelText('Spec markdown editor'), {
      target: { value: ['## Goal', 'Updated goal from editor', '', '## Tasks', '- [ ] Initial task'].join('\n') }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Updated goal from editor')).toBeTruthy()
    expect(window.localStorage.getItem('kata.spec-panel.v1:space-1:session-1')).toContain(
      'Updated goal from editor'
    )
  })

  it('cancels markdown editing and restores the persisted content', () => {
    const persistedMarkdown = ['## Goal', 'Persisted goal', '', '## Tasks', '- [ ] Initial task'].join('\n')
    window.localStorage.setItem(
      'kata.spec-panel.v1:space-1:session-1',
      JSON.stringify({ markdown: persistedMarkdown })
    )

    render(
      <RightPanel
        project={mockProject}
        spaceId="space-1"
        sessionId="session-1"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit markdown' }))
    fireEvent.change(screen.getByLabelText('Spec markdown editor'), {
      target: { value: ['## Goal', 'Unsaved draft text', '', '## Tasks', '- [ ] Initial task'].join('\n') }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Persisted goal')).toBeTruthy()
    expect(screen.queryByText('Unsaved draft text')).toBeNull()
    expect(window.localStorage.getItem('kata.spec-panel.v1:space-1:session-1')).toContain('Persisted goal')
  })
})
