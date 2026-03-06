import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionAgentRecord, SessionRecord } from '../../../../src/shared/types/space'
import { useSessionAgentRoster } from '../../../../src/renderer/hooks/useSessionAgentRoster'

const mockSessionListBySpace = vi.fn<(input: { spaceId: string }) => Promise<SessionRecord[]>>()
const mockSessionAgentRosterList = vi.fn<(input: { sessionId: string }) => Promise<SessionAgentRecord[]>>()

function createSession(id: string, spaceId = 'space-1'): SessionRecord {
  return {
    id,
    spaceId,
    label: `Session ${id}`,
    createdAt: '2026-03-01T00:00:00.000Z'
  }
}

function createRosterRecord(overrides: Partial<SessionAgentRecord> = {}): SessionAgentRecord {
  return {
    id: 'agent-1',
    sessionId: 'session-newest',
    name: 'MVP Planning Coordinator',
    role: 'Coordinates MVP planning tasks',
    kind: 'coordinator',
    status: 'idle',
    avatarColor: '#0f766e',
    sortOrder: 1,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:05:00.000Z',
    ...overrides
  }
}

async function flushAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  vi.clearAllMocks()

  mockSessionListBySpace.mockResolvedValue([])
  mockSessionAgentRosterList.mockResolvedValue([])

  ;(window as any).kata = {
    sessionListBySpace: mockSessionListBySpace,
    sessionAgentRosterList: mockSessionAgentRosterList
  }
})

afterEach(() => {
  delete (window as any).kata
})

describe('useSessionAgentRoster', () => {
  it('loads newest-session roster and maps records to AgentSummary values', async () => {
    mockSessionListBySpace.mockResolvedValue([createSession('session-newest'), createSession('session-older')])
    mockSessionAgentRosterList.mockResolvedValue([
      createRosterRecord({ id: 'agent-1', currentTask: 'Coordinating wave execution', status: 'running' }),
      createRosterRecord({
        id: 'agent-2',
        name: 'Kata Agents',
        role: 'System-managed agent group',
        status: 'idle',
        currentTask: undefined
      })
    ])

    const { result } = renderHook(() => useSessionAgentRoster('space-1', null))
    await flushAsyncWork()

    expect(mockSessionListBySpace).toHaveBeenCalledWith({ spaceId: 'space-1' })
    expect(mockSessionAgentRosterList).toHaveBeenCalledWith({ sessionId: 'session-newest' })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.agents).toEqual([
      {
        id: 'agent-1',
        name: 'MVP Planning Coordinator',
        role: 'Coordinates MVP planning tasks',
        status: 'running',
        avatarColor: '#0f766e',
        delegatedBy: undefined,
        lastUpdated: '2026-03-01T00:05:00.000Z',
        currentTask: 'Coordinating wave execution',
        model: 'n/a',
        tokenUsage: { prompt: 0, completion: 0, total: 0 }
      },
      {
        id: 'agent-2',
        name: 'Kata Agents',
        role: 'System-managed agent group',
        status: 'idle',
        avatarColor: '#0f766e',
        delegatedBy: undefined,
        lastUpdated: '2026-03-01T00:05:00.000Z',
        currentTask: 'Waiting for delegated work.',
        model: 'n/a',
        tokenUsage: { prompt: 0, completion: 0, total: 0 }
      }
    ])
  })

  it('still maps seeded roster records while coordinator selectors move prompt preview out of AgentSummary', async () => {
    mockSessionListBySpace.mockResolvedValue([createSession('session-newest')])
    mockSessionAgentRosterList.mockResolvedValue([createRosterRecord()])

    const { result } = renderHook(() => useSessionAgentRoster('space-1', null))
    await flushAsyncWork()

    expect(result.current.agents[0]).toMatchObject({
      name: 'MVP Planning Coordinator',
      status: 'idle'
    })
  })

  it('returns deterministic empty state when required APIs are missing', async () => {
    ;(window as any).kata = {
      sessionListBySpace: mockSessionListBySpace
    }

    const { result } = renderHook(() => useSessionAgentRoster('space-1', null))
    await flushAsyncWork()

    expect(mockSessionListBySpace).not.toHaveBeenCalled()
    expect(mockSessionAgentRosterList).not.toHaveBeenCalled()
    expect(result.current).toEqual({
      agents: [],
      isLoading: false,
      error: null
    })
  })

  it('skips API calls when activeSpaceId is null', () => {
    const { result } = renderHook(() => useSessionAgentRoster(null, null))

    expect(mockSessionListBySpace).not.toHaveBeenCalled()
    expect(mockSessionAgentRosterList).not.toHaveBeenCalled()
    expect(result.current).toEqual({
      agents: [],
      isLoading: false,
      error: null
    })
  })

  it('returns an empty roster with no error when there are no sessions', async () => {
    mockSessionListBySpace.mockResolvedValue([])

    const { result } = renderHook(() => useSessionAgentRoster('space-1', null))
    await flushAsyncWork()

    expect(mockSessionListBySpace).toHaveBeenCalledWith({ spaceId: 'space-1' })
    expect(mockSessionAgentRosterList).not.toHaveBeenCalled()
    expect(result.current).toEqual({
      agents: [],
      isLoading: false,
      error: null
    })
  })

  it('sets empty state when newest session is missing and hook is still mounted', async () => {
    let resolveSessions: ((value: SessionRecord[]) => void) | undefined
    mockSessionListBySpace.mockImplementation(
      () =>
        new Promise<SessionRecord[]>((resolve) => {
          resolveSessions = resolve
        })
    )

    const { result } = renderHook(() => useSessionAgentRoster('space-1', null))

    await act(async () => {
      resolveSessions?.([])
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current).toEqual({
      agents: [],
      isLoading: false,
      error: null
    })
  })

  it('captures API failures and clears agents', async () => {
    mockSessionListBySpace.mockResolvedValue([createSession('session-newest')])
    mockSessionAgentRosterList.mockRejectedValue(new Error('roster fetch failed'))

    const { result } = renderHook(() => useSessionAgentRoster('space-1', null))
    await flushAsyncWork()

    expect(result.current.agents).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('roster fetch failed')
  })

  it('sets error state when roster loading rejects while mounted', async () => {
    mockSessionListBySpace.mockResolvedValue([createSession('session-newest')])
    let rejectRoster: ((reason?: unknown) => void) | undefined
    mockSessionAgentRosterList.mockImplementation(
      () =>
        new Promise<SessionAgentRecord[]>((_resolve, reject) => {
          rejectRoster = reject
        })
    )

    const { result } = renderHook(() => useSessionAgentRoster('space-1', null))
    await flushAsyncWork()

    await act(async () => {
      rejectRoster?.(new Error('deferred roster failure'))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current).toEqual({
      agents: [],
      isLoading: false,
      error: 'deferred roster failure'
    })
  })

  it('returns fallback error copy for non-Error failures', async () => {
    mockSessionListBySpace.mockResolvedValue([createSession('session-newest')])
    mockSessionAgentRosterList.mockRejectedValue('boom')

    const { result } = renderHook(() => useSessionAgentRoster('space-1', null))
    await flushAsyncWork()

    expect(result.current.agents).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('Failed to load session agent roster.')
  })

  it('allows in-flight IPC to finish after unmount without crashing', async () => {
    let resolveSessions: ((value: SessionRecord[]) => void) | undefined
    mockSessionListBySpace.mockImplementation(
      () =>
        new Promise<SessionRecord[]>((resolve) => {
          resolveSessions = resolve
        })
    )

    const { unmount } = renderHook(() => useSessionAgentRoster('space-1', null))
    unmount()

    await act(async () => {
      resolveSessions?.([createSession('session-newest')])
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(mockSessionAgentRosterList).toHaveBeenCalledWith({ sessionId: 'session-newest' })
  })

  it('uses activeSessionId directly and skips sessionListBySpace when provided', async () => {
    mockSessionAgentRosterList.mockResolvedValue([createRosterRecord()])

    const { result } = renderHook(() => useSessionAgentRoster('space-1', 'session-explicit'))
    await flushAsyncWork()

    expect(mockSessionListBySpace).not.toHaveBeenCalled()
    expect(mockSessionAgentRosterList).toHaveBeenCalledWith({ sessionId: 'session-explicit' })
    expect(result.current.agents).toHaveLength(1)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('re-fetches roster when activeSessionId changes', async () => {
    mockSessionListBySpace.mockResolvedValue([createSession('session-newest')])
    mockSessionAgentRosterList.mockResolvedValue([createRosterRecord()])

    const { result, rerender } = renderHook(
      ({ spaceId, sessionId }: { spaceId: string | null; sessionId: string | null }) =>
        useSessionAgentRoster(spaceId, sessionId),
      { initialProps: { spaceId: 'space-1', sessionId: null } }
    )
    await flushAsyncWork()

    expect(mockSessionListBySpace).toHaveBeenCalledTimes(1)
    expect(result.current.agents).toHaveLength(1)

    mockSessionAgentRosterList.mockResolvedValue([
      createRosterRecord({ id: 'agent-1' }),
      createRosterRecord({ id: 'agent-2', name: 'New Agent' })
    ])

    rerender({ spaceId: 'space-1', sessionId: 'session-newest' })
    await flushAsyncWork()

    // With explicit activeSessionId, sessionListBySpace is not called again
    expect(mockSessionListBySpace).toHaveBeenCalledTimes(1)
    expect(mockSessionAgentRosterList).toHaveBeenCalledWith({ sessionId: 'session-newest' })
    expect(result.current.agents).toHaveLength(2)
  })
})
