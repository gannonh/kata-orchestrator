import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionRuntimeEvent } from '../../../../src/renderer/types/session-runtime-adapter'

let onRunEventCallback: ((event: SessionRuntimeEvent) => void) | null = null
const mockRunSubmit = vi.fn().mockResolvedValue({ runId: 'run-1' })
const mockRunList = vi.fn().mockResolvedValue([])
const mockOnRunEvent = vi.fn((cb: (event: SessionRuntimeEvent) => void) => {
  onRunEventCallback = cb
  return () => {
    onRunEventCallback = null
  }
})

beforeEach(() => {
  vi.resetModules()
  onRunEventCallback = null
  ;(window as any).kata = {
    runSubmit: mockRunSubmit,
    runList: mockRunList,
    onRunEvent: mockOnRunEvent
  }
})

afterEach(() => {
  vi.clearAllMocks()
  delete (window as any).kata
})

describe('useIpcSessionConversation', () => {
  it('initializes in empty state', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    expect(result.current.state.runState).toBe('empty')
    expect(result.current.state.messages).toEqual([])
  })

  it('submitPrompt calls window.kata.runSubmit and transitions to pending', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      result.current.submitPrompt('Plan phase 2')
    })

    expect(result.current.state.runState).toBe('pending')
    expect(result.current.state.messages).toHaveLength(1)
    expect(result.current.state.messages[0].content).toBe('Plan phase 2')
    expect(mockRunSubmit).toHaveBeenCalledWith({
      sessionId: 's-1',
      prompt: 'Plan phase 2',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic'
    })
  })

  it('receiving message_appended event adds agent message and transitions to idle', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      result.current.submitPrompt('test')
    })

    act(() => {
      onRunEventCallback?.({
        type: 'message_appended',
        message: {
          id: 'agent-1',
          role: 'agent',
          content: 'Draft ready.',
          createdAt: new Date().toISOString()
        }
      })
    })

    expect(result.current.state.runState).toBe('idle')
    expect(result.current.state.messages).toHaveLength(2)
    expect(result.current.state.messages[1].role).toBe('agent')
  })

  it('receiving error event transitions to error state', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      result.current.submitPrompt('test')
    })

    act(() => {
      onRunEventCallback?.({
        type: 'run_state_changed',
        runState: 'error',
        errorMessage: 'No credentials'
      })
    })

    expect(result.current.state.runState).toBe('error')
    expect(result.current.state.errorMessage).toBe('No credentials')
  })

  it('retry re-submits the last prompt', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    // Submit, then error
    act(() => {
      result.current.submitPrompt('test retry')
    })
    act(() => {
      onRunEventCallback?.({
        type: 'run_state_changed',
        runState: 'error',
        errorMessage: 'Failed'
      })
    })

    expect(result.current.state.runState).toBe('error')

    // Retry
    act(() => {
      result.current.retry()
    })

    expect(result.current.state.runState).toBe('pending')
    expect(mockRunSubmit).toHaveBeenCalledTimes(2)
  })

  it('unsubscribes from run events on unmount', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { unmount } = renderHook(() => useIpcSessionConversation('s-1'))

    expect(onRunEventCallback).not.toBeNull()

    unmount()

    expect(onRunEventCallback).toBeNull()
  })

  it('replays persisted runs on mount', async () => {
    mockRunList.mockResolvedValue([
      {
        id: 'run-1',
        sessionId: 's-1',
        prompt: 'hello',
        status: 'completed',
        model: 'm',
        provider: 'p',
        createdAt: '2026-03-01T00:00:00Z',
        messages: [
          { id: 'u1', role: 'user', content: 'hello', createdAt: '2026-03-01T00:00:00Z' },
          { id: 'a1', role: 'agent', content: 'hi there', createdAt: '2026-03-01T00:00:01Z' }
        ]
      }
    ])

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    // Wait for the async replay to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(mockRunList).toHaveBeenCalledWith('s-1')
    expect(result.current.state.messages).toHaveLength(2)
    expect(result.current.state.messages[0].content).toBe('hello')
    expect(result.current.state.messages[1].content).toBe('hi there')
  })

  it('silently ignores replay errors', async () => {
    mockRunList.mockRejectedValue(new Error('network error'))

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    // Should still be in empty state, no crash
    expect(result.current.state.messages).toEqual([])
  })

  it('transitions to error when submitPrompt IPC call rejects', async () => {
    mockRunSubmit.mockRejectedValue(new Error('IPC failed'))

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      result.current.submitPrompt('test')
    })

    // Wait for the rejection to propagate
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(result.current.state.runState).toBe('error')
    expect(result.current.state.errorMessage).toBe('IPC failed')
  })

  it('transitions to error when retry IPC call rejects', async () => {
    mockRunSubmit.mockResolvedValueOnce({ runId: 'run-1' })

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    // Submit, then error via event
    act(() => {
      result.current.submitPrompt('test retry catch')
    })
    act(() => {
      onRunEventCallback?.({
        type: 'run_state_changed',
        runState: 'error',
        errorMessage: 'First failure'
      })
    })

    expect(result.current.state.runState).toBe('error')

    // Make next runSubmit reject
    mockRunSubmit.mockRejectedValueOnce(new Error('Retry IPC failed'))

    // Retry
    act(() => {
      result.current.retry()
    })

    // Wait for the rejection to propagate
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(result.current.state.runState).toBe('error')
    expect(result.current.state.errorMessage).toBe('Retry IPC failed')
  })

  it('does nothing when submitPrompt called with null sessionId', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation(null))

    act(() => {
      result.current.submitPrompt('should not send')
    })

    expect(result.current.state.runState).toBe('empty')
    expect(mockRunSubmit).not.toHaveBeenCalled()
  })

  it('ignores unknown event types without crashing', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      // Fire an event with an unrecognized type
      onRunEventCallback?.({ type: 'unknown_event' } as unknown as SessionRuntimeEvent)
    })

    // State unchanged
    expect(result.current.state.runState).toBe('empty')
  })

  it('ignores non-error run_state_changed events (pending/idle)', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      result.current.submitPrompt('test')
    })

    // Fire pending and idle events - these should be ignored by the event handler
    act(() => {
      onRunEventCallback?.({
        type: 'run_state_changed',
        runState: 'pending'
      })
    })

    // State should still be pending (from submitPrompt dispatch, not from the event)
    expect(result.current.state.runState).toBe('pending')

    act(() => {
      onRunEventCallback?.({
        type: 'run_state_changed',
        runState: 'idle'
      })
    })

    // Still pending - idle events from main process are ignored
    expect(result.current.state.runState).toBe('pending')
  })

  it('retry is a no-op when not in error state', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    // In empty state, retry should do nothing
    act(() => {
      result.current.retry()
    })

    expect(result.current.state.runState).toBe('empty')
    expect(mockRunSubmit).not.toHaveBeenCalled()
  })

  it('retry is a no-op with null sessionId even when in error state', async () => {
    // Start with a valid sessionId, get into error state, then re-render with null
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )

    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string | null }) => useIpcSessionConversation(sessionId),
      { initialProps: { sessionId: 's-1' } }
    )

    // Submit to set lastPromptRef
    act(() => {
      result.current.submitPrompt('test retry null session')
    })

    // Error via event
    act(() => {
      onRunEventCallback?.({
        type: 'run_state_changed',
        runState: 'error',
        errorMessage: 'Failed'
      })
    })

    expect(result.current.state.runState).toBe('error')

    // Re-render with null sessionId
    rerender({ sessionId: null })

    mockRunSubmit.mockClear()

    // Retry should hit the !sessionId guard at line 89
    act(() => {
      result.current.retry()
    })

    expect(mockRunSubmit).not.toHaveBeenCalled()
  })

  it('skips replay when sessionId is null', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    renderHook(() => useIpcSessionConversation(null))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(mockRunList).not.toHaveBeenCalled()
  })

  it('skips replay when kata.runList is unavailable', async () => {
    ;(window as any).kata = {
      runSubmit: mockRunSubmit,
      onRunEvent: mockOnRunEvent
      // runList intentionally omitted
    }

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    renderHook(() => useIpcSessionConversation('s-1'))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    // Should not crash, runList was not called
    expect(mockRunList).not.toHaveBeenCalled()
  })
})
