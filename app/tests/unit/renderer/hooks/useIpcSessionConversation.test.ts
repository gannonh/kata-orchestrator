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
})
