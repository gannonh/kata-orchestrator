import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentsTab } from '../../../../src/renderer/components/left/AgentsTab'
import { mockAgents } from '../../../../src/renderer/mock/agents'
import type { AgentSummary } from '../../../../src/renderer/types/agent'

describe('AgentsTab', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows a background-agent summary row', () => {
    render(<AgentsTab agents={mockAgents} />)

    expect(screen.getByRole('button', { name: /background agents running/i })).toBeTruthy()
    expect(screen.getByText(/background agents running/i)).toBeTruthy()
  })

  it('renders empty state structure when no agents are available', () => {
    render(<AgentsTab agents={[]} />)

    expect(screen.getByRole('heading', { name: 'Agents' })).toBeTruthy()
    expect(screen.getByText('No agents in this space yet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /background agents running/i })).toBeNull()
  })

  it('shows loading copy while roster data is being fetched', () => {
    render(
      <AgentsTab
        agents={[]}
        isLoading
      />
    )

    expect(screen.getByText('Loading agents…')).toBeTruthy()
    expect(screen.queryByText('No agents in this space yet.')).toBeNull()
  })

  it('shows a non-blocking error message while keeping available agent rows visible', () => {
    render(
      <AgentsTab
        agents={mockAgents}
        error="Unable to refresh"
      />
    )

    expect(screen.getByText('Unable to refresh agents right now.')).toBeTruthy()
    expect(screen.getByText('MVP Planning Coordinator')).toBeTruthy()
  })

  it('keeps non-delegated system and coordinator rows visible when flat roster has delegated entries between them', () => {
    const flatRoster: AgentSummary[] = [
      {
        id: 'kata-agents',
        name: 'Kata Agents',
        role: 'System',
        status: 'running',
        model: 'n/a',
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        currentTask: 'Watching orchestration.',
        lastUpdated: '2026-03-02T00:00:00.000Z'
      },
      {
        id: 'specialist-a',
        name: 'Implement Worktree Lifecycle',
        role: 'Specialist',
        status: 'running',
        model: 'n/a',
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        currentTask: 'Implementing worktree flow.',
        delegatedBy: 'MVP Planning Coordinator',
        lastUpdated: '2026-03-02T00:00:00.000Z'
      },
      {
        id: 'coordinator',
        name: 'MVP Planning Coordinator',
        role: 'Coordinator',
        status: 'running',
        model: 'n/a',
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        currentTask: 'Coordinating delegated tasks.',
        lastUpdated: '2026-03-02T00:00:00.000Z'
      },
      {
        id: 'specialist-b',
        name: 'Space Metadata Impl',
        role: 'Specialist',
        status: 'blocked',
        model: 'n/a',
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        currentTask: 'Waiting on contract.',
        delegatedBy: 'MVP Planning Coordinator',
        lastUpdated: '2026-03-02T00:00:00.000Z'
      }
    ]

    render(<AgentsTab agents={flatRoster} />)

    expect(screen.getByText('Kata Agents')).toBeTruthy()
    expect(screen.getByText('MVP Planning Coordinator')).toBeTruthy()
    expect(screen.queryByText('Implement Worktree Lifecycle')).toBeNull()
    expect(screen.queryByText('Space Metadata Impl')).toBeNull()

    const toggle = screen.getByRole('button', { name: /background agents running/i })
    expect(toggle).toBeTruthy()

    fireEvent.click(toggle)
    expect(screen.getByText('Implement Worktree Lifecycle')).toBeTruthy()
    expect(screen.getByText('Space Metadata Impl')).toBeTruthy()
  })

  it('expands and collapses delegated background agents', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-20T15:15:00.000Z'))

    render(<AgentsTab agents={mockAgents} />)

    const toggle = screen.getByRole('button', { name: /background agents running/i })

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Task Block Parser')).toBeTruthy()
    expect(screen.getAllByText(/Delegated by MVP Planning Coordinator/).length).toBeGreaterThan(0)

    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Task Block Parser')).toBeNull()
  })

  it('omits background summary when coordinator has no children or siblings', () => {
    const coordinatorOnly = {
      ...mockAgents[0],
      children: undefined
    }

    render(<AgentsTab agents={[coordinatorOnly]} />)

    expect(screen.queryByRole('button', { name: /background agents running/i })).toBeNull()
    expect(screen.queryByText('Task Block Parser')).toBeNull()
  })
})
