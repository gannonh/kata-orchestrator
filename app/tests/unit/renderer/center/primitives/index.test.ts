import { describe, expect, it } from 'vitest'
import * as primitives from '../../../../../src/renderer/components/center/primitives'

describe('center primitives index', () => {
  it('exports the canonical primitive API', () => {
    expect(typeof primitives.ConversationMessage).toBe('function')
    expect(typeof primitives.ConversationStatusBadge).toBe('function')
    expect(typeof primitives.toPrimitiveMessage).toBe('function')
  })
})
