import { describe, expect, it } from 'vitest'

import { shouldRenderAgentation } from '../../../../src/renderer/lib/agentation'

describe('shouldRenderAgentation', () => {
  it('returns false when dev mode is disabled', () => {
    expect(shouldRenderAgentation(false, undefined)).toBe(false)
    expect(shouldRenderAgentation(false, '0')).toBe(false)
    expect(shouldRenderAgentation(false, '1')).toBe(false)
  })

  it('returns true in dev when disable flag is unset or not 1', () => {
    expect(shouldRenderAgentation(true, undefined)).toBe(true)
    expect(shouldRenderAgentation(true, '')).toBe(true)
    expect(shouldRenderAgentation(true, '0')).toBe(true)
    expect(shouldRenderAgentation(true, 'true')).toBe(true)
  })

  it('returns false in dev when disable flag is exactly 1', () => {
    expect(shouldRenderAgentation(true, '1')).toBe(false)
  })
})
