import { describe, expect, it } from 'vitest'

import { mapSessionAgentRecordToSummary } from '../../../../src/renderer/components/left/mapSessionAgentRecordToSummary'
import type { SessionAgentRecord } from '../../../../src/shared/types/space'

function createRecord(overrides: Partial<SessionAgentRecord> = {}): SessionAgentRecord {
  return {
    id: 'agent-1',
    sessionId: 'session-1',
    name: 'MVP Planning Coordinator',
    role: 'Coordinates MVP planning tasks',
    kind: 'coordinator',
    status: 'running',
    avatarColor: '#0f766e',
    delegatedBy: 'Kata Agents',
    currentTask: 'Preparing wave breakdown',
    sortOrder: 1,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:05:00.000Z',
    ...overrides
  }
}

describe('mapSessionAgentRecordToSummary', () => {
  it('maps supported fields directly from the session record', () => {
    const result = mapSessionAgentRecordToSummary(createRecord())

    expect(result).toEqual({
      id: 'agent-1',
      name: 'MVP Planning Coordinator',
      role: 'Coordinates MVP planning tasks',
      status: 'running',
      avatarColor: '#0f766e',
      delegatedBy: 'Kata Agents',
      lastUpdated: '2026-03-01T00:05:00.000Z',
      currentTask: 'Preparing wave breakdown',
      model: 'n/a',
      tokenUsage: {
        prompt: 0,
        completion: 0,
        total: 0
      }
    })
  })

  it('falls back to the delegated-work placeholder when currentTask is absent', () => {
    const result = mapSessionAgentRecordToSummary(createRecord({ currentTask: undefined }))

    expect(result.currentTask).toBe('Waiting for delegated work.')
    expect(result.model).toBe('n/a')
    expect(result.tokenUsage).toEqual({ prompt: 0, completion: 0, total: 0 })
  })
})
