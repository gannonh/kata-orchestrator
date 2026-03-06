import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { observeShellWidth } from '../../../src/renderer/components/layout/AppShell'

describe('AppShell null-ref guard', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('returns early when the shell ref is unavailable', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const onWidthChange = vi.fn()

    const cleanupObserver = observeShellWidth(null, onWidthChange)

    expect(cleanupObserver).toBeUndefined()
    expect(onWidthChange).not.toHaveBeenCalled()
    expect(addEventListenerSpy).not.toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
