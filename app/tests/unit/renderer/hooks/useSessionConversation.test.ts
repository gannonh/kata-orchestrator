import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSessionConversation } from '../../../../src/renderer/hooks/useSessionConversation'

describe('useSessionConversation', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves to pending on submit and back to idle after success', () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useSessionConversation())

    act(() => {
      result.current.submitPrompt('Create spec')
    })

    expect(result.current.state.runState).toBe('pending')

    act(() => {
      vi.runAllTimers()
    })

    expect(result.current.state.runState).toBe('idle')
    expect(result.current.state.messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: 'Create spec',
        createdAt: '1970-01-01T00:00:01.000Z'
      },
      {
        id: 'agent-2',
        role: 'agent',
        content: 'Draft ready for review.',
        createdAt: '1970-01-01T00:00:02.000Z'
      }
    ])
  })

  it('moves to error when the deterministic error trigger is submitted', () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useSessionConversation())

    act(() => {
      result.current.submitPrompt('/error provider timeout')
    })

    expect(result.current.state.runState).toBe('error')
    expect(result.current.state.errorMessage).toBe(
      'Deterministic error state for shell testing.'
    )
    expect(result.current.state.messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: '/error provider timeout',
        createdAt: '1970-01-01T00:00:01.000Z'
      }
    ])
  })

  it('retries from error and reaches idle after the deterministic success timer', () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useSessionConversation())

    act(() => {
      result.current.submitPrompt('/error provider timeout')
    })

    expect(result.current.state.runState).toBe('error')

    act(() => {
      result.current.retry()
    })

    expect(result.current.state.runState).toBe('pending')

    act(() => {
      vi.advanceTimersByTime(899)
    })

    expect(result.current.state.runState).toBe('pending')

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current.state.runState).toBe('idle')
    expect(result.current.state.errorMessage).toBeUndefined()
    expect(result.current.state.messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: '/error provider timeout',
        createdAt: '1970-01-01T00:00:01.000Z'
      },
      {
        id: 'agent-2',
        role: 'agent',
        content: 'Draft ready for review.',
        createdAt: '1970-01-01T00:00:02.000Z'
      }
    ])
  })

  it('does not reschedule the active run when submit is called again while pending', () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useSessionConversation())

    act(() => {
      result.current.submitPrompt('Create spec')
      vi.advanceTimersByTime(450)
      result.current.submitPrompt('Ignored while pending')
    })

    expect(result.current.state.runState).toBe('pending')

    act(() => {
      vi.advanceTimersByTime(449)
    })

    expect(result.current.state.runState).toBe('pending')

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current.state.runState).toBe('idle')
    expect(result.current.state.messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: 'Create spec',
        createdAt: '1970-01-01T00:00:01.000Z'
      },
      {
        id: 'agent-2',
        role: 'agent',
        content: 'Draft ready for review.',
        createdAt: '1970-01-01T00:00:02.000Z'
      }
    ])
  })

  it('clears a pending timer on unmount without leaking a completion', () => {
    vi.useFakeTimers()

    const { result, unmount } = renderHook(() => useSessionConversation())

    act(() => {
      result.current.submitPrompt('Create spec')
    })

    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      vi.runAllTimers()
    })

    expect(vi.getTimerCount()).toBe(0)
  })

  it('does nothing when retry is called outside error state', () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useSessionConversation())

    expect(result.current.state.runState).toBe('empty')

    act(() => {
      result.current.retry()
    })

    expect(result.current.state.runState).toBe('empty')
    expect(result.current.state.messages).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
})
