import { describe, expect, it } from 'vitest'

import { createDefaultAppState } from '@shared/types/space'
import type { SessionAgentRecord } from '@shared/types/space'
import { createSessionAgentRegistry } from '../../../src/main/session-agent-registry'

describe('createSessionAgentRegistry', () => {
  it('seeds baseline agents idempotently per session', () => {
    const state = createDefaultAppState()
    const registry = createSessionAgentRegistry(
      () => state,
      (next) => Object.assign(state, next)
    )

    const first = registry.seedBaselineAgents('session-1', '2026-03-05T00:00:00.000Z')
    const second = registry.seedBaselineAgents('session-1', '2026-03-05T00:00:00.000Z')

    expect(first).toHaveLength(2)
    expect(second).toHaveLength(2)
    expect(Object.values(state.agentRoster).filter((agent) => agent.sessionId === 'session-1')).toHaveLength(2)
  })

  it('list() returns only agents for the requested session', () => {
    const state = createDefaultAppState()
    const registry = createSessionAgentRegistry(
      () => state,
      (next) => Object.assign(state, next)
    )

    registry.upsert({
      id: 'agent-s1',
      sessionId: 'session-1',
      name: 'S1',
      role: 'Worker',
      kind: 'specialist',
      status: 'idle',
      avatarColor: '#111111',
      sortOrder: 0,
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z'
    })
    registry.upsert({
      id: 'agent-s2',
      sessionId: 'session-2',
      name: 'S2',
      role: 'Worker',
      kind: 'specialist',
      status: 'idle',
      avatarColor: '#222222',
      sortOrder: 0,
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z'
    })

    const s1Agents = registry.list('session-1')
    expect(s1Agents).toHaveLength(1)
    expect(s1Agents[0].id).toBe('agent-s1')

    const s2Agents = registry.list('session-2')
    expect(s2Agents).toHaveLength(1)
    expect(s2Agents[0].id).toBe('agent-s2')
  })

  it('seeding one session does not affect another', () => {
    const state = createDefaultAppState()
    const registry = createSessionAgentRegistry(
      () => state,
      (next) => Object.assign(state, next)
    )

    registry.seedBaselineAgents('session-1', '2026-03-05T00:00:00.000Z')
    registry.seedBaselineAgents('session-2', '2026-03-05T00:00:01.000Z')

    const s1Agents = registry.list('session-1')
    const s2Agents = registry.list('session-2')
    expect(s1Agents).toHaveLength(2)
    expect(s2Agents).toHaveLength(2)
    expect(s1Agents.map((a) => a.id)).not.toEqual(s2Agents.map((a) => a.id))
    expect(Object.keys(state.agentRoster)).toHaveLength(4)
  })

  it('transitions queued -> delegating -> running -> completed', () => {
    const state = createDefaultAppState()
    const registry = createSessionAgentRegistry(
      () => state,
      (next) => Object.assign(state, next)
    )
    const createdAt = '2026-03-05T00:00:00.000Z'
    const agent: SessionAgentRecord = {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'Worker',
      role: 'Executes delegated work',
      kind: 'specialist',
      status: 'queued',
      avatarColor: '#123456',
      sortOrder: 3,
      createdAt,
      updatedAt: createdAt
    }

    registry.upsert(agent)
    expect(registry.transitionStatus(agent.id, 'delegating', '2026-03-05T00:00:01.000Z').status).toBe('delegating')
    expect(registry.transitionStatus(agent.id, 'running', '2026-03-05T00:00:02.000Z').status).toBe('running')
    expect(registry.transitionStatus(agent.id, 'completed', '2026-03-05T00:00:03.000Z').status).toBe('completed')
    expect(registry.list('session-1').find((entry) => entry.id === agent.id)?.status).toBe('completed')
  })

  it('throws when transitioning an unknown agent id', () => {
    const state = createDefaultAppState()
    const registry = createSessionAgentRegistry(
      () => state,
      (next) => Object.assign(state, next)
    )

    expect(() => {
      registry.transitionStatus('missing-agent', 'running', '2026-03-05T00:00:01.000Z')
    }).toThrow('Cannot transition unknown agent: missing-agent')
  })

  it('lists with deterministic sortOrder then createdAt then id', () => {
    const state = createDefaultAppState()
    const registry = createSessionAgentRegistry(
      () => state,
      (next) => Object.assign(state, next)
    )
    const sessionId = 'session-1'

    registry.upsert({
      id: 'b',
      sessionId,
      name: 'B',
      role: 'B',
      kind: 'specialist',
      status: 'idle',
      avatarColor: '#111111',
      sortOrder: 2,
      createdAt: '2026-03-05T00:00:02.000Z',
      updatedAt: '2026-03-05T00:00:02.000Z'
    })
    registry.upsert({
      id: 'a',
      sessionId,
      name: 'A',
      role: 'A',
      kind: 'specialist',
      status: 'idle',
      avatarColor: '#222222',
      sortOrder: 1,
      createdAt: '2026-03-05T00:00:02.000Z',
      updatedAt: '2026-03-05T00:00:02.000Z'
    })
    registry.upsert({
      id: 'c',
      sessionId,
      name: 'C',
      role: 'C',
      kind: 'specialist',
      status: 'idle',
      avatarColor: '#333333',
      sortOrder: 1,
      createdAt: '2026-03-05T00:00:01.000Z',
      updatedAt: '2026-03-05T00:00:01.000Z'
    })
    registry.upsert({
      id: 'd',
      sessionId,
      name: 'D',
      role: 'D',
      kind: 'specialist',
      status: 'idle',
      avatarColor: '#444444',
      sortOrder: 1,
      createdAt: '2026-03-05T00:00:02.000Z',
      updatedAt: '2026-03-05T00:00:02.000Z'
    })

    expect(registry.list(sessionId).map((agent) => agent.id)).toEqual(['c', 'a', 'd', 'b'])
  })
})
