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
  // Reset implementations to defaults so rejection setups don't bleed across tests
  mockRunSubmit.mockResolvedValue({ runId: 'run-1' })
  mockRunList.mockResolvedValue([])
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
      model: 'gpt-5.3-codex',
      provider: 'openai-codex'
    })
  })

  it('clears draft state when the active session changes', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result, rerender } = renderHook(
      ({ sessionId }) => useIpcSessionConversation(sessionId),
      {
        initialProps: { sessionId: 's-1' }
      }
    )

    const createdAt = '2026-03-01T00:00:01.000Z'

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
          createdAt
        }
      })
    })

    expect(result.current.state.latestDraft?.runId).toBe('run-agent-1')

    rerender({ sessionId: 's-2' })

    expect(result.current.state.runState).toBe('empty')
    expect(result.current.state.messages).toEqual([])
    expect(result.current.state.latestDraft).toBeUndefined()
  })

  it('ignores stale replay results from the previous session after a session switch', async () => {
    let resolveFirstReplay: ((runs: any[]) => void) | null = null

    mockRunList.mockImplementation((sessionId: string) => {
      if (sessionId === 's-1') {
        return new Promise((resolve) => {
          resolveFirstReplay = resolve
        })
      }

      return Promise.resolve([])
    })

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result, rerender } = renderHook(
      ({ sessionId }) => useIpcSessionConversation(sessionId),
      {
        initialProps: { sessionId: 's-1' }
      }
    )

    rerender({ sessionId: 's-2' })

    await act(async () => {
      resolveFirstReplay?.([
        {
          id: 'run-1',
          sessionId: 's-1',
          prompt: 'stale session prompt',
          status: 'completed',
          model: 'm',
          provider: 'p',
          createdAt: '2026-03-01T00:00:00Z',
          messages: [
            {
              id: 'u1',
              role: 'user',
              content: 'stale session prompt',
              createdAt: '2026-03-01T00:00:00Z'
            },
            {
              id: 'a1',
              role: 'agent',
              content: 'stale response',
              createdAt: '2026-03-01T00:00:01Z'
            }
          ]
        }
      ])
      await Promise.resolve()
    })

    expect(result.current.state.runState).toBe('empty')
    expect(result.current.state.messages).toEqual([])
    expect(result.current.state.latestDraft).toBeUndefined()
  })

  it('ignores stale replay errors from the previous session after a session switch', async () => {
    let rejectFirstReplay: ((error: unknown) => void) | null = null

    mockRunList.mockImplementation((sessionId: string) => {
      if (sessionId === 's-1') {
        return new Promise((_resolve, reject) => {
          rejectFirstReplay = reject
        })
      }

      return Promise.resolve([])
    })

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result, rerender } = renderHook(
      ({ sessionId }) => useIpcSessionConversation(sessionId),
      {
        initialProps: { sessionId: 's-1' }
      }
    )

    rerender({ sessionId: 's-2' })

    await act(async () => {
      rejectFirstReplay?.(new Error('stale replay failure'))
      await Promise.resolve()
    })

    expect(result.current.state.runState).toBe('empty')
    expect(result.current.state.messages).toEqual([])
    expect(result.current.state.latestDraft).toBeUndefined()
  })

  it('receiving message_appended event adds agent message and transitions to idle', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      result.current.submitPrompt('test')
    })

    const createdAt = '2026-03-01T00:00:01.000Z'

    act(() => {
      onRunEventCallback?.({
        type: 'message_appended',
        message: {
          id: 'agent-1',
          role: 'agent',
          content: 'Draft ready.',
          createdAt
        }
      })
    })

    expect(result.current.state.runState).toBe('idle')
    expect(result.current.state.messages).toHaveLength(2)
    expect(result.current.state.messages[1].role).toBe('agent')
    expect(result.current.state.latestDraft).toEqual({
      runId: 'run-agent-1',
      generatedAt: createdAt,
      content: [
        '## Goal',
        'test',
        '',
        '## Acceptance Criteria',
        '1. Produce a structured spec draft from the latest run',
        '2. Keep the shell behavior deterministic for renderer tests',
        '',
        '## Non-goals',
        '- Do not call external services from the right panel',
        '',
        '## Assumptions',
        '- The latest prompt is the source of truth for the draft',
        '',
        '## Verification Plan',
        '1. Run the renderer unit tests',
        '',
        '## Rollback Plan',
        '1. Clear the generated draft state',
        '',
        '## Tasks',
        '- [ ] Review the latest prompt',
        '- [/] Apply the structured draft',
        '- [x] Keep the runtime wiring stable'
      ].join('\n')
    })
  })

  it('builds a draft with an empty prompt when message_appended arrives before submit', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      onRunEventCallback?.({
        type: 'message_appended',
        message: {
          id: 'agent-pre',
          role: 'agent',
          content: 'Draft created before prompt',
          createdAt: '2026-03-01T00:00:01.000Z'
        }
      })
    })

    expect(result.current.state.latestDraft?.runId).toBe('run-agent-pre')
    expect(result.current.state.latestDraft?.content.startsWith('## Goal\n\n')).toBe(true)
  })

  it('receiving message_updated streams assistant content before completion', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      result.current.submitPrompt('stream this')
    })

    act(() => {
      onRunEventCallback?.({
        type: 'message_updated',
        message: {
          id: 'agent-1',
          role: 'agent',
          content: 'Draft',
          createdAt: '2026-03-01T00:00:01.000Z'
        }
      })
    })

    expect(result.current.state.runState).toBe('pending')
    expect(result.current.state.messages).toHaveLength(2)
    expect(result.current.state.messages[1]?.content).toBe('Draft')

    act(() => {
      onRunEventCallback?.({
        type: 'message_updated',
        message: {
          id: 'agent-1',
          role: 'agent',
          content: 'Draft complete',
          createdAt: '2026-03-01T00:00:01.000Z'
        }
      })
    })

    expect(result.current.state.messages).toHaveLength(2)
    expect(result.current.state.messages[1]?.content).toBe('Draft complete')

    act(() => {
      onRunEventCallback?.({
        type: 'message_appended',
        message: {
          id: 'agent-1',
          role: 'agent',
          content: 'Draft complete.',
          createdAt: '2026-03-01T00:00:01.000Z'
        }
      })
    })

    expect(result.current.state.runState).toBe('idle')
    expect(result.current.state.messages).toHaveLength(2)
    expect(result.current.state.messages[1]?.content).toBe('Draft complete.')
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

  it('prefers persisted run draft metadata when replay restores latestDraft', async () => {
    const persistedDraft = {
      runId: 'run-1',
      generatedAt: '2026-03-01T00:00:02Z',
      content: '# Persisted draft from run metadata'
    }

    mockRunList.mockResolvedValue([
      {
        id: 'run-1',
        sessionId: 's-1',
        prompt: 'hello',
        status: 'completed',
        model: 'm',
        provider: 'p',
        createdAt: '2026-03-01T00:00:00Z',
        draft: persistedDraft,
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

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(result.current.state.messages).toHaveLength(2)
    expect(result.current.state.messages[0].content).toBe('hello')
    expect(result.current.state.messages[1].content).toBe('hi there')
    expect(result.current.state.latestDraft).toEqual(persistedDraft)
  })

  it('surfaces reconciled interrupted-run fallback from replay as an error state', async () => {
    const interruptedRunError = 'Recovered after app restart: in-flight run was interrupted'

    mockRunList.mockResolvedValue([
      {
        id: 'run-1',
        sessionId: 's-1',
        prompt: 'retry after restart',
        status: 'failed',
        model: 'm',
        provider: 'p',
        createdAt: '2026-03-01T00:00:00Z',
        errorMessage: interruptedRunError,
        messages: [
          {
            id: 'u1',
            role: 'user',
            content: 'retry after restart',
            createdAt: '2026-03-01T00:00:00Z'
          }
        ]
      }
    ])

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(result.current.state.messages).toHaveLength(1)
    expect(result.current.state.messages[0].content).toBe('retry after restart')
    expect(result.current.state.runState).toBe('error')
    expect(result.current.state.errorMessage).toBe(interruptedRunError)
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

  it('handles non-Error replay rejections without crashing', async () => {
    mockRunList.mockRejectedValue('network down')

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(result.current.state.runState).toBe('empty')
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

  it('ignores pending run_state_changed and transitions to idle on idle run_state_changed', async () => {
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

    expect(result.current.state.runState).toBe('idle')
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

  it('retry is a no-op when runSubmit is unavailable in error state', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      result.current.submitPrompt('retry without runSubmit')
    })
    act(() => {
      onRunEventCallback?.({
        type: 'run_state_changed',
        runState: 'error',
        errorMessage: 'Failed'
      })
    })

    delete (window as any).kata.runSubmit

    act(() => {
      result.current.retry()
    })

    expect(result.current.state.runState).toBe('error')
    expect(result.current.state.errorMessage).toBe('Failed')
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
