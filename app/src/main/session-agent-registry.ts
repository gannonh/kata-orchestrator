import { randomUUID } from 'node:crypto'

import type { AppState, SessionAgentRecord, SessionAgentStatus } from '../shared/types/space'

type GetState = () => AppState
type SetState = (next: AppState) => void

export type SessionAgentRegistry = {
  seedBaselineAgents(sessionId: string, createdAt: string): SessionAgentRecord[]
  list(sessionId: string): SessionAgentRecord[]
  upsert(agent: SessionAgentRecord): SessionAgentRecord
  transitionStatus(agentId: string, nextStatus: SessionAgentStatus, at: string): SessionAgentRecord
}

function sortSessionAgents(left: SessionAgentRecord, right: SessionAgentRecord): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder
  }

  const createdAtDiff = left.createdAt.localeCompare(right.createdAt)
  if (createdAtDiff !== 0) {
    return createdAtDiff
  }

  return left.id.localeCompare(right.id)
}

function createBaselineSessionAgentRoster(sessionId: string, createdAt: string): SessionAgentRecord[] {
  return [
    {
      id: randomUUID(),
      sessionId,
      name: 'Kata Agents',
      role: 'System-managed agent group',
      kind: 'system',
      status: 'idle',
      avatarColor: '#334155',
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: randomUUID(),
      sessionId,
      name: 'MVP Planning Coordinator',
      role: 'Coordinates MVP planning tasks',
      kind: 'coordinator',
      status: 'idle',
      avatarColor: '#0f766e',
      sortOrder: 1,
      createdAt,
      updatedAt: createdAt
    }
  ]
}

export function createSessionAgentRegistry(getState: GetState, setState: SetState): SessionAgentRegistry {
  return {
    seedBaselineAgents(sessionId: string, createdAt: string): SessionAgentRecord[] {
      const state = getState()
      const existingForSession = Object.values(state.agentRoster).filter((agent) => agent.sessionId === sessionId)

      if (existingForSession.length > 0) {
        return [...existingForSession].sort(sortSessionAgents)
      }

      const seeded = createBaselineSessionAgentRoster(sessionId, createdAt)
      setState({
        ...state,
        agentRoster: {
          ...state.agentRoster,
          ...Object.fromEntries(seeded.map((entry) => [entry.id, entry]))
        }
      })

      return [...seeded].sort(sortSessionAgents)
    },

    list(sessionId: string): SessionAgentRecord[] {
      return Object.values(getState().agentRoster)
        .filter((entry) => entry.sessionId === sessionId)
        .sort(sortSessionAgents)
    },

    upsert(agent: SessionAgentRecord): SessionAgentRecord {
      const state = getState()
      setState({
        ...state,
        agentRoster: {
          ...state.agentRoster,
          [agent.id]: agent
        }
      })

      return agent
    },

    transitionStatus(agentId: string, nextStatus: SessionAgentStatus, at: string): SessionAgentRecord {
      const state = getState()
      const existing = state.agentRoster[agentId]
      if (!existing) {
        throw new Error(`Cannot transition unknown agent: ${agentId}`)
      }

      const updated: SessionAgentRecord = {
        ...existing,
        status: nextStatus,
        updatedAt: at
      }

      setState({
        ...state,
        agentRoster: {
          ...state.agentRoster,
          [agentId]: updated
        }
      })

      return updated
    }
  }
}
