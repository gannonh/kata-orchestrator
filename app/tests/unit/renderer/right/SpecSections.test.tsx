import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SpecSections } from '../../../../src/renderer/components/right/SpecSections'
import type { StructuredSpecDocument } from '../../../../src/renderer/types/spec-document'

const structuredFixtureMarkdown = [
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
].join('\n')

const baseDocument: StructuredSpecDocument = {
  markdown: '## Goal\nShip it.',
  sections: {
    goal: 'Ship it.',
    acceptanceCriteria: ['Works'],
    nonGoals: ['Do not over-engineer'],
    assumptions: ['Repo is clean'],
    verificationPlan: ['Run tests'],
    rollbackPlan: ['Revert']
  },
  tasks: [
    { id: 'task-build', title: 'Build', status: 'not_started', markdownLineIndex: 0 },
    { id: 'task-test', title: 'Test', status: 'in_progress', markdownLineIndex: 1 }
  ],
  updatedAt: '2026-03-04T00:00:00.000Z'
}

describe('SpecSections', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders all sections and tasks from a structured document', () => {
    const onToggleTask = vi.fn()
    const onEditMarkdown = vi.fn()

    render(
      <SpecSections
        document={baseDocument}
        onToggleTask={onToggleTask}
        onEditMarkdown={onEditMarkdown}
        commentStatusNote="Auto-saved"
      />
    )

    expect(screen.getByText('Ship it.')).toBeTruthy()
    expect(screen.getByText('Works')).toBeTruthy()
    expect(screen.getByText('Do not over-engineer')).toBeTruthy()
    expect(screen.getByText('Repo is clean')).toBeTruthy()
    expect(screen.getByText('Run tests')).toBeTruthy()
    expect(screen.getByText('Revert')).toBeTruthy()
    expect(screen.getByText('Build')).toBeTruthy()
    expect(screen.getByText('Test')).toBeTruthy()
    expect(screen.getByText('Auto-saved')).toBeTruthy()
    expect(screen.getByText('Draft applied')).toBeTruthy()
  })

  it('renders a realistic canonical fixture with markdown and mixed task states', () => {
    render(
      <SpecSections
        document={{
          markdown: structuredFixtureMarkdown,
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
              status: 'not_started',
              markdownLineIndex: 19
            },
            {
              id: 'task-render-markdown',
              title: 'Render markdown',
              status: 'in_progress',
              markdownLineIndex: 20
            },
            {
              id: 'task-preserve-ids',
              title: 'Preserve ids',
              status: 'complete',
              markdownLineIndex: 21
            }
          ],
          updatedAt: '2026-03-06T00:00:00.000Z'
        }}
        onToggleTask={vi.fn()}
        onEditMarkdown={vi.fn()}
        commentStatusNote="Comments are deferred."
      />
    )

    expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()
    expect(screen.getByText('spec').tagName).toBe('CODE')
    expect(screen.getByText('main').tagName).toBe('CODE')
    expect(screen.getByRole('checkbox', { name: 'Render markdown' })).toBeTruthy()
  })

  it('shows applied run id when present', () => {
    render(
      <SpecSections
        document={{ ...baseDocument, appliedRunId: 'run-42' }}
        onToggleTask={vi.fn()}
        onEditMarkdown={vi.fn()}
        commentStatusNote=""
      />
    )

    expect(screen.getByText('Applied from run-42')).toBeTruthy()
  })

  it('calls onEditMarkdown when edit button is clicked', () => {
    const onEditMarkdown = vi.fn()

    render(
      <SpecSections
        document={baseDocument}
        onToggleTask={vi.fn()}
        onEditMarkdown={onEditMarkdown}
        commentStatusNote=""
      />
    )

    fireEvent.click(screen.getByText('Edit markdown'))
    expect(onEditMarkdown).toHaveBeenCalledOnce()
  })

  it('merges runtime task status from snapshot when snapshot is newer', () => {
    render(
      <SpecSections
        document={baseDocument}
        taskActivitySnapshot={{
          sessionId: 's-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-build',
              title: 'Build',
              status: 'in_progress',
              activityLevel: 'high',
              activityDetail: 'Working on build',
              updatedAt: '2026-03-04T01:00:00.000Z'
            }
          ],
          counts: { not_started: 0, in_progress: 1, blocked: 0, complete: 0 }
        }}
        onToggleTask={vi.fn()}
        onEditMarkdown={vi.fn()}
        commentStatusNote=""
      />
    )

    expect(screen.getByText('Working on build')).toBeTruthy()
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1)
  })

  it('renders empty section lists with placeholder text', () => {
    render(
      <SpecSections
        document={{
          ...baseDocument,
          sections: {
            goal: '',
            acceptanceCriteria: [],
            nonGoals: [],
            assumptions: [],
            verificationPlan: [],
            rollbackPlan: []
          }
        }}
        onToggleTask={vi.fn()}
        onEditMarkdown={vi.fn()}
        commentStatusNote=""
      />
    )

    expect(screen.getByText('No goal yet.')).toBeTruthy()
    const noItemElements = screen.getAllByText('No items yet.')
    expect(noItemElements.length).toBeGreaterThanOrEqual(1)
  })

  it('falls back to document status when snapshot has no updatedAt', () => {
    render(
      <SpecSections
        document={baseDocument}
        taskActivitySnapshot={{
          sessionId: 's-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-build',
              title: 'Build',
              status: 'complete',
              activityLevel: 'none',
              updatedAt: ''
            }
          ],
          counts: { not_started: 0, in_progress: 0, blocked: 0, complete: 1 }
        }}
        onToggleTask={vi.fn()}
        onEditMarkdown={vi.fn()}
        commentStatusNote=""
      />
    )

    expect(screen.getByText('Not Started')).toBeTruthy()
  })

  it('handles document with undefined updatedAt', () => {
    render(
      <SpecSections
        document={{ ...baseDocument, updatedAt: undefined }}
        taskActivitySnapshot={{
          sessionId: 's-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-build',
              title: 'Build',
              status: 'complete',
              activityLevel: 'none',
              updatedAt: '2026-03-04T01:00:00.000Z'
            }
          ],
          counts: { not_started: 0, in_progress: 0, blocked: 0, complete: 1 }
        }}
        onToggleTask={vi.fn()}
        onEditMarkdown={vi.fn()}
        commentStatusNote=""
      />
    )

    expect(screen.getByText('Complete')).toBeTruthy()
  })

  it('falls back to document status when snapshot updatedAt is an invalid date string', () => {
    render(
      <SpecSections
        document={baseDocument}
        taskActivitySnapshot={{
          sessionId: 's-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-build',
              title: 'Build',
              status: 'complete',
              activityLevel: 'none',
              updatedAt: 'not-a-date'
            }
          ],
          counts: { not_started: 0, in_progress: 0, blocked: 0, complete: 1 }
        }}
        onToggleTask={vi.fn()}
        onEditMarkdown={vi.fn()}
        commentStatusNote=""
      />
    )

    expect(screen.getByText('Not Started')).toBeTruthy()
  })
})
