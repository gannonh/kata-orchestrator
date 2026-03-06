import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../src/renderer/components/center/primitives/ConversationMessage', () => ({
  ConversationMessage: () => null
}))

import * as primitives from '../../../../../src/renderer/components/center/primitives'

describe('center primitives index', () => {
  it('exports the canonical primitive API', () => {
    expect(typeof primitives.ConversationMessage).toBe('function')
    expect(typeof primitives.ConversationMessageCard).toBe('function')
    expect(typeof primitives.ConversationStatusBadge).toBe('function')
    expect(typeof primitives.toPrimitiveMessage).toBe('function')
  })
})
