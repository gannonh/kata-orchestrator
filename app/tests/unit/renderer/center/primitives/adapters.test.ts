import { describe, expect, it } from 'vitest'

import {
  toPrimitiveMessage,
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
})
