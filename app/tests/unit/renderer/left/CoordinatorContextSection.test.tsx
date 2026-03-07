import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { CoordinatorContextListItem } from '../../../../src/renderer/features/coordinator-session/domain'
import { CoordinatorContextSection } from '../../../../src/renderer/components/left/CoordinatorContextSection'

const contextItems: CoordinatorContextListItem[] = [
  {
    id: 'spec',
    kind: 'spec',
    label: 'Spec',
    sourcePath: undefined,
    description: undefined,
    sortOrder: 0,
    createdAt: '2026-03-06T00:00:00.000Z',
    updatedAt: '2026-03-06T00:00:00.000Z'
  },
  {
    id: 'note-1',
    kind: 'note',
    label: 'Team Brainstorm',
    sourcePath: './notes',
    description: undefined,
    sortOrder: 1,
    createdAt: '2026-03-06T00:01:00.000Z',
    updatedAt: '2026-03-06T00:01:00.000Z'
  }
]

describe('CoordinatorContextSection', () => {
  it('renders selector-backed context resources with spec-first ordering and coordinator copy', () => {
    render(
      <CoordinatorContextSection
        contextItems={contextItems}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByRole('heading', { name: 'Context' })).toBeTruthy()
    expect(screen.getByText('Context about the task, shared with all agents on demand.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add context' }).textContent).toBe('+ Add context')
    expect(screen.getByText('Spec')).toBeTruthy()
    expect(screen.getByText('Team Brainstorm')).toBeTruthy()
    expect(screen.queryByText('./notes')).toBeNull()
  })
})
