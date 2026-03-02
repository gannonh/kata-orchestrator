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
})
