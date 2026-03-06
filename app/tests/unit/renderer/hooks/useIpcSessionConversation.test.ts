import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionRuntimeEvent } from '../../../../src/renderer/types/session-runtime-adapter'
import { INTERRUPTED_RUN_ERROR_MESSAGE } from '../../../../src/shared/types/run'

let onRunEventCallback: ((event: SessionRuntimeEvent) => void) | null = null
const mockRunSubmit = vi.fn().mockResolvedValue({ runId: 'run-1' })
const mockRunList = vi.fn().mockResolvedValue([])
const mockSpecGet = vi.fn().mockResolvedValue(null)
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
    specGet: mockSpecGet,
    onRunEvent: mockOnRunEvent
  }
})

afterEach(() => {
  vi.clearAllMocks()
  // Reset implementations to defaults so rejection setups don't bleed across tests
  mockRunSubmit.mockResolvedValue({ runId: 'run-1' })
  mockRunList.mockResolvedValue([])
  mockSpecGet.mockResolvedValue(null)
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

    act(() => {
      onRunEventCallback?.({
        type: 'task_activity_snapshot',
        snapshot: {
          sessionId: 's-1',
          runId: 'run-agent-1',
          items: [],
          counts: {
            not_started: 0,
            in_progress: 1,
            blocked: 0,
            complete: 0
          }
        }
      })
    })

    expect(result.current.state.latestDraft?.runId).toBe('run-agent-1')
    expect(result.current.state.taskActivitySnapshot?.runId).toBe('run-agent-1')

    rerender({ sessionId: 's-2' })

    expect(result.current.state.runState).toBe('empty')
    expect(result.current.state.messages).toEqual([])
    expect(result.current.state.latestDraft).toBeUndefined()
    expect(result.current.state.taskActivitySnapshot).toBeUndefined()
  })

  it('stores task activity snapshots emitted by runtime events', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      onRunEventCallback?.({
        type: 'task_activity_snapshot',
        snapshot: {
          sessionId: 's-1',
          runId: 'run-1',
          items: [
            {
              id: 'task-a',
              title: 'Task A',
              status: 'in_progress',
              activityLevel: 'high',
              activityDetail: 'Starting task A',
              updatedAt: '2026-03-01T00:00:01.000Z'
            }
          ],
          counts: {
            not_started: 0,
            in_progress: 1,
            blocked: 0,
            complete: 0
          }
        }
      })
    })

    expect(result.current.state.taskActivitySnapshot).toEqual({
      sessionId: 's-1',
      runId: 'run-1',
      items: [
        {
          id: 'task-a',
          title: 'Task A',
          status: 'in_progress',
          activityLevel: 'high',
          activityDetail: 'Starting task A',
          updatedAt: '2026-03-01T00:00:01.000Z'
        }
      ],
      counts: {
        not_started: 0,
        in_progress: 1,
        blocked: 0,
        complete: 0
      }
    })
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

  it('receiving message_appended event publishes the assistant markdown as the latest draft', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      result.current.submitPrompt('test')
    })

    const createdAt = '2026-03-01T00:00:01.000Z'

    const assistantDraft = [
      '## Goal',
      'Ship `inline code` rendering.',
      '',
      '## Acceptance Criteria',
      '1. Render canonical sections from assistant markdown.',
      '',
      '## Non-goals',
      '- Do not synthesize a fallback draft.',
      '',
      '## Assumptions',
      '- The latest assistant message is canonical markdown.',
      '',
      '## Verification Plan',
      '1. Run the hook tests.',
      '',
      '## Rollback Plan',
      '1. Restore the scaffolded draft builder.',
      '',
      '## Tasks',
      '- [ ] Preserve assistant markdown'
    ].join('\n')

    act(() => {
      onRunEventCallback?.({
        type: 'message_appended',
        message: {
          id: 'agent-1',
          role: 'agent',
          content: assistantDraft,
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
      content: assistantDraft
    })
  })

  it('ignores duplicate message_appended events with the same message id', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      result.current.submitPrompt('test')
    })

    const duplicateMessage = {
      id: 'agent-dup-1',
      role: 'agent' as const,
      content: 'Draft ready.',
      createdAt: '2026-03-01T00:00:01.000Z'
    }

    act(() => {
      onRunEventCallback?.({
        type: 'message_appended',
        message: duplicateMessage
      })
    })

    act(() => {
      onRunEventCallback?.({
        type: 'message_appended',
        message: duplicateMessage
      })
    })

    expect(result.current.state.messages.filter((message) => message.id === duplicateMessage.id)).toHaveLength(1)
  })

  it('uses assistant markdown even when message_appended arrives before submit', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    const assistantDraft = ['## Goal', 'Draft created before prompt'].join('\n')

    act(() => {
      onRunEventCallback?.({
        type: 'message_appended',
        message: {
          id: 'agent-pre',
          role: 'agent',
          content: assistantDraft,
          createdAt: '2026-03-01T00:00:01.000Z'
        }
      })
    })

    expect(result.current.state.latestDraft?.runId).toBe('run-agent-pre')
    expect(result.current.state.latestDraft?.content).toBe(assistantDraft)
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
          { id: 'a1', role: 'agent', content: 'hi there', createdAt: '2026-03-01T00:00:01Z' },
          { id: 'a2', role: 'agent', content: 'more details', createdAt: '2026-03-01T00:00:02Z' }
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
    expect(result.current.state.messages).toHaveLength(3)
    expect(result.current.state.messages[0].id).toBe('u1')
    expect(result.current.state.messages[0].createdAt).toBe('2026-03-01T00:00:00Z')
    expect(result.current.state.messages[1].id).toBe('a1')
    expect(result.current.state.messages[1].createdAt).toBe('2026-03-01T00:00:01Z')
    expect(result.current.state.messages[2].id).toBe('a2')
    expect(result.current.state.messages[2].createdAt).toBe('2026-03-01T00:00:02Z')
    expect(result.current.state.messages[0].content).toBe('hello')
    expect(result.current.state.messages[1].content).toBe('hi there')
    expect(result.current.state.messages[2].content).toBe('more details')
  })

  it('rehydrates task activity snapshot from persisted spec document on session load', async () => {
    mockSpecGet.mockResolvedValue({
      markdown: [
        '## Goal',
        'Persisted goal',
        '## Tasks',
        '- [ ] Template task to ignore',
        '',
        '## Acceptance Criteria',
        '1. Keep the latest tasks block',
        '',
        '## Tasks',
        '- [/] Apply the structured draft',
        '- [x] Keep the runtime wiring stable'
      ].join('\n'),
      updatedAt: '2026-03-04T19:00:00.000Z',
      appliedRunId: 'run-applied',
      appliedAt: '2026-03-04T19:00:00.000Z'
    })

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1', 'space-1'))

    await waitFor(() => {
      expect(result.current.state.taskActivitySnapshot).toEqual({
        sessionId: 's-1',
        runId: 'run-applied',
        items: [
          {
            id: 'task-apply-the-structured-draft',
            title: 'Apply the structured draft',
            status: 'in_progress',
            activityLevel: 'none',
            updatedAt: '2026-03-04T19:00:00.000Z'
          },
          {
            id: 'task-keep-the-runtime-wiring-stable',
            title: 'Keep the runtime wiring stable',
            status: 'complete',
            activityLevel: 'none',
            updatedAt: '2026-03-04T19:00:00.000Z'
          }
        ],
        counts: {
          not_started: 0,
          in_progress: 1,
          blocked: 0,
          complete: 1
        }
      })
    })

    expect(mockSpecGet).toHaveBeenCalledWith({ spaceId: 'space-1', sessionId: 's-1' })
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
    const interruptedRunError = INTERRUPTED_RUN_ERROR_MESSAGE

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

  it('replays inline decision follow-up as a normal persisted user message', async () => {
    mockRunList.mockResolvedValue([
      {
        id: 'run-1',
        sessionId: 's-1',
        prompt: 'review decision options',
        status: 'completed',
        model: 'm',
        provider: 'p',
        createdAt: '2026-03-01T00:00:00Z',
        messages: [
          {
            id: 'u1',
            role: 'user',
            content: 'review decision options',
            createdAt: '2026-03-01T00:00:00Z'
          },
          {
            id: 'a1',
            role: 'agent',
            content: 'Inline decision: choose A or B?',
            createdAt: '2026-03-01T00:00:01Z'
          },
          {
            id: 'u2',
            role: 'user',
            content: 'Choose option A and continue.',
            createdAt: '2026-03-01T00:00:02Z'
          },
          {
            id: 'a2',
            role: 'agent',
            content: 'Proceeding with option A.',
            createdAt: '2026-03-01T00:00:03Z'
          }
        ]
      }
    ])

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    await waitFor(() => {
      expect(result.current.state.messages).toHaveLength(4)
    })

    expect(result.current.state.runState).toBe('empty')
    expect(result.current.state.messages.map(({ role, content }) => ({ role, content }))).toEqual([
      { role: 'user', content: 'review decision options' },
      { role: 'agent', content: 'Inline decision: choose A or B?' },
      { role: 'user', content: 'Choose option A and continue.' },
      { role: 'agent', content: 'Proceeding with option A.' }
    ])
    const replayedIds = result.current.state.messages.map((message) => message.id)
    expect(replayedIds).toEqual(['u1', 'a1', 'u2', 'a2'])
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

    expect(result.current.state.runState).toBe('error')
    expect(result.current.state.errorMessage).toBe('Failed to load conversation history')
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

  it('ignores task activity snapshots from a different session', async () => {
    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1'))

    act(() => {
      onRunEventCallback?.({
        type: 'task_activity_snapshot',
        snapshot: {
          sessionId: 's-other',
          runId: 'run-other',
          items: [],
          counts: { not_started: 0, in_progress: 0, blocked: 0, complete: 0 }
        }
      })
    })

    expect(result.current.state.taskActivitySnapshot).toBeUndefined()
  })

  it('discards stale spec replay when session changes before specGet resolves', async () => {
    let resolveFirstSpecGet: ((doc: any) => void) | null = null

    mockSpecGet.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolveFirstSpecGet = resolve
      })
    })
    // Second session's specGet returns null immediately
    mockSpecGet.mockResolvedValueOnce(null)

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result, rerender } = renderHook(
      ({ sessionId }) => useIpcSessionConversation(sessionId, 'space-1'),
      { initialProps: { sessionId: 's-1' } }
    )

    rerender({ sessionId: 's-2' })

    await act(async () => {
      resolveFirstSpecGet?.({
        markdown: '## Tasks\n- [/] Stale task',
        updatedAt: '2026-03-04T19:00:00.000Z',
        appliedRunId: 'run-stale',
        appliedAt: '2026-03-04T19:00:00.000Z'
      })
      await Promise.resolve()
    })

    expect(result.current.state.taskActivitySnapshot).toBeUndefined()
  })

  it('returns undefined snapshot when persisted spec document is invalid', async () => {
    mockSpecGet.mockResolvedValue({ notASpec: true })

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1', 'space-1'))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(result.current.state.taskActivitySnapshot).toBeUndefined()
  })

  it('returns undefined snapshot when persisted spec has no tasks', async () => {
    mockSpecGet.mockResolvedValue({
      markdown: '## Goal\nJust a goal, no tasks section',
      updatedAt: '2026-03-04T19:00:00.000Z',
      appliedRunId: 'run-notasks',
      appliedAt: '2026-03-04T19:00:00.000Z'
    })

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1', 'space-1'))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(result.current.state.taskActivitySnapshot).toBeUndefined()
  })

  it('generates a fallback runId when persisted spec has no appliedRunId', async () => {
    mockSpecGet.mockResolvedValue({
      markdown: '## Tasks\n- [x] Done task',
      updatedAt: '2026-03-04T19:00:00.000Z',
      appliedAt: '2026-03-04T19:00:00.000Z'
    })

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1', 'space-1'))

    await waitFor(() => {
      expect(result.current.state.taskActivitySnapshot?.runId).toBe('spec-s-1')
    })
  })

  it('skips non-checkbox lines in parseTaskItemsFromMarkdown', async () => {
    mockSpecGet.mockResolvedValue({
      markdown: [
        '## Tasks',
        'This is a description line',
        '- [/] Real task'
      ].join('\n'),
      updatedAt: '2026-03-04T19:00:00.000Z',
      appliedRunId: 'run-desc',
      appliedAt: '2026-03-04T19:00:00.000Z'
    })

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1', 'space-1'))

    await waitFor(() => {
      expect(result.current.state.taskActivitySnapshot?.items).toHaveLength(1)
      expect(result.current.state.taskActivitySnapshot?.items[0].title).toBe('Real task')
    })
  })

  it('falls back to slug "task" when title contains only special characters', async () => {
    mockSpecGet.mockResolvedValue({
      markdown: ['## Tasks', '- [ ] !!!'].join('\n'),
      updatedAt: '2026-03-04T19:00:00.000Z',
      appliedRunId: 'run-special',
      appliedAt: '2026-03-04T19:00:00.000Z'
    })

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1', 'space-1'))

    await waitFor(() => {
      expect(result.current.state.taskActivitySnapshot?.items).toHaveLength(1)
      expect(result.current.state.taskActivitySnapshot?.items[0].id).toBe('task-task')
    })
  })

  it('disambiguates duplicate task titles with numeric suffixes', async () => {
    mockSpecGet.mockResolvedValue({
      markdown: ['## Tasks', '- [ ] Build', '- [/] Build', '- [x] Build'].join('\n'),
      updatedAt: '2026-03-04T19:00:00.000Z',
      appliedRunId: 'run-dup',
      appliedAt: '2026-03-04T19:00:00.000Z'
    })

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1', 'space-1'))

    await waitFor(() => {
      expect(result.current.state.taskActivitySnapshot?.items).toHaveLength(3)
      expect(result.current.state.taskActivitySnapshot?.items.map((i) => i.id)).toEqual([
        'task-build',
        'task-build-2',
        'task-build-3'
      ])
    })
  })

  it('silently handles specGet rejection without crashing', async () => {
    mockSpecGet.mockRejectedValue(new Error('spec storage corrupt'))

    const { useIpcSessionConversation } = await import(
      '../../../../src/renderer/hooks/useIpcSessionConversation'
    )
    const { result } = renderHook(() => useIpcSessionConversation('s-1', 'space-1'))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(result.current.state.taskActivitySnapshot).toBeUndefined()
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
