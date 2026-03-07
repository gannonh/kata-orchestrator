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

const specialistAgent: CoordinatorAgentListItem = {
  id: 'agent-specialist',
  name: 'Frontend Specialist',
  role: 'Implements UI changes',
  kind: 'specialist',
  status: 'running',
  avatarColor: '#2563eb',
  delegatedBy: 'agent-coordinator',
  currentTask: 'Updating the sidebar interactions',
  activeRunId: 'run-1',
  waveId: 'wave-1',
  groupLabel: undefined,
  lastActivityAt: '2026-03-06T00:02:00.000Z',
  sortOrder: 1,
  createdAt: '2026-03-06T00:00:00.000Z',
  updatedAt: '2026-03-06T00:02:00.000Z'
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

  it('uses current task copy for non-coordinator agents', () => {
    render(
      <CoordinatorAgentsSection
        agentItems={[coordinatorAgent, specialistAgent]}
        promptPreview="I would like to build the following product..."
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('Frontend Specialist')).toBeTruthy()
    expect(screen.getByText('Updating the sidebar interactions')).toBeTruthy()
  })

  it('renders loading copy while agent data is pending', () => {
    render(
      <CoordinatorAgentsSection
        agentItems={[]}
        promptPreview={null}
        isLoading
        error={null}
      />
    )

    expect(screen.getByText('Loading agents…')).toBeTruthy()
  })

  it('renders the coordinator refresh error state', () => {
    render(
      <CoordinatorAgentsSection
        agentItems={[]}
        promptPreview={null}
        isLoading={false}
        error="boom"
      />
    )

    expect(screen.getByText('Unable to refresh agents right now.')).toBeTruthy()
  })

  it('renders the empty state when the coordinator session has no agents yet', () => {
    render(
      <CoordinatorAgentsSection
        agentItems={[]}
        promptPreview={null}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('No agents in this session yet.')).toBeTruthy()
  })
})
