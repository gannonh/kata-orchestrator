import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RunRecord } from '../../../../src/shared/types/run'
import type { SessionAgentRecord, SessionContextResourceRecord } from '../../../../src/shared/types/space'
import { useCoordinatorSidebarData } from '../../../../src/renderer/hooks/useCoordinatorSidebarData'

const coordinatorAgent: SessionAgentRecord = {
  id: 'agent-coordinator',
  sessionId: 'session-1',
  name: 'Coordinator',
  role: 'Coordinates the session',
  kind: 'coordinator',
  status: 'idle',
  avatarColor: '#0f766e',
  sortOrder: 0,
  createdAt: '2026-03-06T00:00:00.000Z',
  updatedAt: '2026-03-06T00:01:00.000Z'
}

const specResource: SessionContextResourceRecord = {
  id: 'resource-spec',
  sessionId: 'session-1',
  kind: 'spec',
  label: 'Spec',
  sortOrder: 0,
  createdAt: '2026-03-06T00:00:00.000Z',
  updatedAt: '2026-03-06T00:01:00.000Z'
}

const latestRun: RunRecord = {
  id: 'run-latest',
  sessionId: 'session-1',
  prompt:
    'I would like to build the following product for which I have created an overview document that should guide the implementation and rollout for the team.',
  status: 'completed',
  model: 'gpt-5.3-codex',
  provider: 'openai-codex',
  createdAt: '2026-03-06T00:10:00.000Z',
  contextReferences: [],
  messages: []
}

const sessionTwoAgent: SessionAgentRecord = {
  ...coordinatorAgent,
  id: 'agent-coordinator-2',
  sessionId: 'session-2',
  name: 'Coordinator Two'
}

const sessionTwoResource: SessionContextResourceRecord = {
  ...specResource,
  id: 'resource-spec-2',
  sessionId: 'session-2',
  label: 'Spec Two'
}

const sessionTwoRun: RunRecord = {
  ...latestRun,
  id: 'run-latest-2',
  sessionId: 'session-2',
  prompt: 'I would like to build session two.'
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  delete (window as Partial<Window>).kata
})

describe('useCoordinatorSidebarData', () => {
  it('loads coordinator sidebar data from IPC and derives prompt preview + context items', async () => {
    const roster = createDeferred<SessionAgentRecord[]>()
    const resources = createDeferred<SessionContextResourceRecord[]>()
    const runs = createDeferred<RunRecord[]>()
    const sessionAgentRosterList = vi.fn().mockReturnValue(roster.promise)
    const sessionContextResourcesList = vi.fn().mockReturnValue(resources.promise)
    const runList = vi.fn().mockReturnValue(runs.promise)

    window.kata = {
      sessionAgentRosterList,
      sessionContextResourcesList,
      runList
    }

    const { result } = renderHook(() => useCoordinatorSidebarData('session-1'))

    await waitFor(() => expect(result.current.isLoading).toBe(true))
    expect(sessionAgentRosterList).toHaveBeenCalledWith({ sessionId: 'session-1' })
    expect(sessionContextResourcesList).toHaveBeenCalledWith({ sessionId: 'session-1' })
    expect(runList).toHaveBeenCalledWith('session-1')
    expect(result.current.agentItems).toEqual([])
    expect(result.current.contextItems).toEqual([])
    expect(result.current.promptPreview).toBeNull()

    roster.resolve([coordinatorAgent])
    resources.resolve([specResource])
    runs.resolve([latestRun])

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.promptPreview).toContain('I would like to build')
    expect(result.current.contextItems[0]?.label).toBe('Spec')
    expect(result.current.agentItems[0]?.name).toBe('Coordinator')
  })

  it('clears prior derived data when sessionId changes before the next sidebar load resolves', async () => {
    const rosterOne = createDeferred<SessionAgentRecord[]>()
    const resourcesOne = createDeferred<SessionContextResourceRecord[]>()
    const runsOne = createDeferred<RunRecord[]>()
    const rosterTwo = createDeferred<SessionAgentRecord[]>()
    const resourcesTwo = createDeferred<SessionContextResourceRecord[]>()
    const runsTwo = createDeferred<RunRecord[]>()

    window.kata = {
      sessionAgentRosterList: vi
        .fn()
        .mockImplementation(({ sessionId }: { sessionId: string }) =>
          sessionId === 'session-1' ? rosterOne.promise : rosterTwo.promise
        ),
      sessionContextResourcesList: vi
        .fn()
        .mockImplementation(({ sessionId }: { sessionId: string }) =>
          sessionId === 'session-1' ? resourcesOne.promise : resourcesTwo.promise
        ),
      runList: vi
        .fn()
        .mockImplementation((sessionId: string) =>
          sessionId === 'session-1' ? runsOne.promise : runsTwo.promise
        )
    }

    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) => useCoordinatorSidebarData(sessionId),
      { initialProps: { sessionId: 'session-1' } }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(true))

    rosterOne.resolve([coordinatorAgent])
    resourcesOne.resolve([specResource])
    runsOne.resolve([latestRun])

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.agentItems[0]?.name).toBe('Coordinator')
    expect(result.current.contextItems[0]?.label).toBe('Spec')
    expect(result.current.promptPreview).toContain('I would like to build')

    rerender({ sessionId: 'session-2' })

    await waitFor(() => expect(result.current.isLoading).toBe(true))
    expect(result.current.agentItems).toEqual([])
    expect(result.current.contextItems).toEqual([])
    expect(result.current.promptPreview).toBeNull()

    rosterTwo.resolve([sessionTwoAgent])
    resourcesTwo.resolve([sessionTwoResource])
    runsTwo.resolve([sessionTwoRun])

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.agentItems[0]?.name).toBe('Coordinator Two')
    expect(result.current.contextItems[0]?.label).toBe('Spec Two')
    expect(result.current.promptPreview).toContain('session two')
  })

  it('ignores late results from the previous session after switching to a new session', async () => {
    const rosterOne = createDeferred<SessionAgentRecord[]>()
    const resourcesOne = createDeferred<SessionContextResourceRecord[]>()
    const runsOne = createDeferred<RunRecord[]>()
    const rosterTwo = createDeferred<SessionAgentRecord[]>()
    const resourcesTwo = createDeferred<SessionContextResourceRecord[]>()
    const runsTwo = createDeferred<RunRecord[]>()

    window.kata = {
      sessionAgentRosterList: vi
        .fn()
        .mockImplementation(({ sessionId }: { sessionId: string }) =>
          sessionId === 'session-1' ? rosterOne.promise : rosterTwo.promise
        ),
      sessionContextResourcesList: vi
        .fn()
        .mockImplementation(({ sessionId }: { sessionId: string }) =>
          sessionId === 'session-1' ? resourcesOne.promise : resourcesTwo.promise
        ),
      runList: vi
        .fn()
        .mockImplementation((sessionId: string) =>
          sessionId === 'session-1' ? runsOne.promise : runsTwo.promise
        )
    }

    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) => useCoordinatorSidebarData(sessionId),
      { initialProps: { sessionId: 'session-1' } }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(true))

    rerender({ sessionId: 'session-2' })

    await waitFor(() => expect(result.current.isLoading).toBe(true))
    expect(result.current.agentItems).toEqual([])
    expect(result.current.contextItems).toEqual([])
    expect(result.current.promptPreview).toBeNull()

    rosterOne.resolve([coordinatorAgent])
    resourcesOne.resolve([specResource])
    runsOne.resolve([latestRun])

    await Promise.resolve()
    expect(result.current.agentItems).toEqual([])
    expect(result.current.contextItems).toEqual([])
    expect(result.current.promptPreview).toBeNull()
    expect(result.current.isLoading).toBe(true)

    rosterTwo.resolve([sessionTwoAgent])
    resourcesTwo.resolve([sessionTwoResource])
    runsTwo.resolve([sessionTwoRun])

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.agentItems[0]?.name).toBe('Coordinator Two')
    expect(result.current.contextItems[0]?.label).toBe('Spec Two')
    expect(result.current.promptPreview).toContain('session two')
  })
})
