import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { CoordinatorAgentListItem } from '../../../../src/renderer/features/coordinator-session/domain'
import { CoordinatorAgentsSection } from '../../../../src/renderer/components/left/CoordinatorAgentsSection'

const coordinatorAgent: CoordinatorAgentListItem = {
  id: 'agent-coordinator',
  name: 'Coordinator',
  role: 'Coordinates the session',
  kind: 'coordinator',
  status: 'idle',
  avatarColor: '#0f766e',
  delegatedBy: undefined,
  currentTask: undefined,
  activeRunId: undefined,
  waveId: undefined,
  groupLabel: undefined,
  lastActivityAt: '2026-03-06T00:01:00.000Z',
  sortOrder: 0,
  createdAt: '2026-03-06T00:00:00.000Z',
  updatedAt: '2026-03-06T00:01:00.000Z'
}

describe('CoordinatorAgentsSection', () => {
  it('renders coordinator prompt preview with inline create action and no background summary in the simple case', () => {
    render(
      <CoordinatorAgentsSection
        agentItems={[coordinatorAgent]}
        promptPreview="I would like to build the following product..."
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByRole('heading', { name: 'Agents' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create new agent' }).textContent).toBe('+ Create new agent')
    expect(screen.getByText('Coordinator')).toBeTruthy()
    expect(screen.getByText('I would like to build the following product...')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /background agents running/i })).toBeNull()
  })
})
