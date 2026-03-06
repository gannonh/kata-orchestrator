import { describe, expect, it } from 'vitest'

import type { SessionAgentRecord } from '../../../../../src/shared/types/space'
import {
  toPrimitiveMessage,
  toCoordinatorStatusBadgeState,
  toPrimitiveRunState
} from '../../../../../src/renderer/components/center/primitives/adapters'

describe('center primitives adapters', () => {
  it('maps ConversationMessage role/content to PrimitiveMessage', () => {
    const mapped = toPrimitiveMessage({
      id: 'agent-1',
      role: 'agent',
      content: 'Draft ready.',
      createdAt: '2026-03-05T00:00:00.000Z'
    })

    expect(mapped.role).toBe('agent')
    expect(mapped.content).toBe('Draft ready.')
  })

  it('maps assistant role to agent primitive role', () => {
    const mapped = toPrimitiveMessage({
      id: 'assistant-1',
      role: 'assistant',
      content: 'Hello'
    })

    expect(mapped.role).toBe('agent')
  })

  it.each([
    ['empty', 'empty'],
    ['pending', 'pending'],
    ['idle', 'idle'],
    ['error', 'error']
  ] as const)('maps run state %s -> %s', (input, output) => {
    expect(toPrimitiveRunState(input)).toBe(output)
  })

  it.each([
    ['empty', 'ready'],
    ['pending', 'thinking'],
    ['idle', 'stopped'],
    ['error', 'error']
  ] as const)(
    'maps conversation state %s -> coordinator badge state %s',
    (input, output) => {
      expect(
        toCoordinatorStatusBadgeState({ conversationRunState: input })
      ).toBe(output)
    }
  )

  it('maps active roster lifecycle to running', () => {
    const agent: SessionAgentRecord = {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'Coordinator',
      role: 'Coordinator',
      kind: 'coordinator',
      status: 'running',
      avatarColor: '#60d394',
      sortOrder: 0,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
    }

    expect(toCoordinatorStatusBadgeState({ activeAgent: agent })).toBe('running')
  })
})
