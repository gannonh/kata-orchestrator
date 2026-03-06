import { describe, expect, it, vi } from 'vitest'

import { formatRelativeTime } from '../../../../src/renderer/components/center/format-relative-time'

describe('formatRelativeTime', () => {
  it('returns "Just now" for timestamps less than 60 seconds ago', () => {
    const now = new Date().toISOString()
    expect(formatRelativeTime(now)).toBe('Just now')
  })

  it('returns minutes ago for timestamps between 1-59 minutes old', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-06T12:05:00.000Z'))

    expect(formatRelativeTime('2026-03-06T12:00:00.000Z')).toBe('5m ago')

    vi.useRealTimers()
  })

  it('returns hours ago for timestamps between 1-23 hours old', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-06T15:00:00.000Z'))

    expect(formatRelativeTime('2026-03-06T12:00:00.000Z')).toBe('3h ago')

    vi.useRealTimers()
  })

  it('returns days ago for timestamps 24+ hours old', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-08T12:00:00.000Z'))

    expect(formatRelativeTime('2026-03-06T12:00:00.000Z')).toBe('2d ago')

    vi.useRealTimers()
  })

  it('returns "Just now" for invalid date strings', () => {
    expect(formatRelativeTime('not-a-date')).toBe('Just now')
  })
})
