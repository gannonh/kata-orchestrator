// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

const { exposeInMainWorld, invoke, on, removeListener } = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld
  },
  ipcRenderer: {
    invoke,
    on,
    removeListener
  }
}))

describe('preload bridge', () => {
  afterEach(() => {
    exposeInMainWorld.mockReset()
    invoke.mockReset()
    on.mockReset()
    removeListener.mockReset()
    vi.resetModules()
  })

  it('exposes the kata API with default values and external-url support', async () => {
    invoke.mockResolvedValue(true)

    await import('../../../src/preload/index')

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)

    const [key, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        getAgents: () => Promise<unknown[]>
        getMessages: () => Promise<unknown[]>
        getProject: () => Promise<null>
        getGitStatus: () => Promise<null>
        openExternalUrl: (url: string) => Promise<boolean>
      }
    ]

    expect(key).toBe('kata')
    await expect(api.getAgents()).resolves.toEqual([])
    await expect(api.getMessages()).resolves.toEqual([])
    await expect(api.getProject()).resolves.toBeNull()
    await expect(api.getGitStatus()).resolves.toBeNull()
    await expect(api.openExternalUrl('https://example.com')).resolves.toBe(true)
    expect(invoke).toHaveBeenCalledWith('kata:openExternalUrl', 'https://example.com')
  })

  it('exposes space and session IPC methods', async () => {
    const mockSpace = { id: '1', name: 'test' }
    const mockSpaces = [mockSpace]

    await import('../../../src/preload/index')

    const [, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        spaceCreate: (input: unknown) => Promise<unknown>
        spaceList: () => Promise<unknown>
        spaceGet: (id: string) => Promise<unknown>
        sessionCreate: (input: unknown) => Promise<unknown>
      }
    ]

    // spaceCreate
    invoke.mockResolvedValueOnce(mockSpace)
    const createInput = {
      workspaceMode: 'managed',
      provisioningMethod: 'copy-local',
      sourceLocalPath: '/Users/me/dev/repo',
      repoUrl: 'https://github.com/org/repo',
      branch: 'main'
    }
    await expect(api.spaceCreate(createInput)).resolves.toEqual(mockSpace)
    expect(invoke).toHaveBeenCalledWith('space:create', createInput)

    // spaceList
    invoke.mockResolvedValueOnce(mockSpaces)
    await expect(api.spaceList()).resolves.toEqual(mockSpaces)
    expect(invoke).toHaveBeenCalledWith('space:list')

    // spaceGet
    invoke.mockResolvedValueOnce(mockSpace)
    await expect(api.spaceGet('1')).resolves.toEqual(mockSpace)
    expect(invoke).toHaveBeenCalledWith('space:get', { id: '1' })

    // sessionCreate
    const sessionInput = { spaceId: '1', label: 'session-1' }
    const mockSession = { id: 's1', ...sessionInput, createdAt: 'now' }
    invoke.mockResolvedValueOnce(mockSession)
    await expect(api.sessionCreate(sessionInput)).resolves.toEqual(mockSession)
    expect(invoke).toHaveBeenCalledWith('session:create', sessionInput)
  })

  it('exposes sessionAgentRosterList and invokes the session-agent-roster:list channel', async () => {
    const mockRoster = [
      {
        id: 'agent-1',
        sessionId: 'session-1',
        name: 'Coordinator',
        role: 'Coordinate work',
        kind: 'coordinator',
        status: 'running',
        avatarColor: '#123456',
        currentTask: 'Dispatching',
        sortOrder: 0,
        createdAt: 'now',
        updatedAt: 'now'
      }
    ]

    await import('../../../src/preload/index')

    const [, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        sessionAgentRosterList: (input: { sessionId: string }) => Promise<unknown>
      }
    ]

    invoke.mockResolvedValueOnce(mockRoster)

    await expect(api.sessionAgentRosterList({ sessionId: 'session-1' })).resolves.toEqual(mockRoster)
    expect(invoke).toHaveBeenCalledWith('session-agent-roster:list', { sessionId: 'session-1' })
  })

  it('exposes sessionContextResourcesList and invokes the session-context-resources:list channel', async () => {
    const mockResources = [
      {
        id: 'ctx-1',
        sessionId: 'session-1',
        kind: 'spec',
        label: 'Spec',
        sortOrder: 0,
        createdAt: 'now',
        updatedAt: 'now'
      }
    ]

    await import('../../../src/preload/index')

    const [, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        sessionContextResourcesList: (input: { sessionId: string }) => Promise<unknown>
      }
    ]

    invoke.mockResolvedValueOnce(mockResources)

    await expect(api.sessionContextResourcesList({ sessionId: 'session-1' })).resolves.toEqual(mockResources)
    expect(invoke).toHaveBeenCalledWith('session-context-resources:list', { sessionId: 'session-1' })
  })

  it('exposes sessionListBySpace and invokes the session:listBySpace channel', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        spaceId: 'space-1',
        label: 'Build session',
        createdAt: 'now'
      }
    ]

    await import('../../../src/preload/index')

    const [, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        sessionListBySpace: (input: { spaceId: string }) => Promise<unknown>
      }
    ]

    invoke.mockResolvedValueOnce(mockSessions)

    await expect(api.sessionListBySpace({ spaceId: 'space-1' })).resolves.toEqual(mockSessions)
    expect(invoke).toHaveBeenCalledWith('session:listBySpace', { spaceId: 'space-1' })
  })

  it('returns false when external open invoke throws', async () => {
    invoke.mockRejectedValue(new Error('ipc unavailable'))

    await import('../../../src/preload/index')

    const [, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        openExternalUrl: (url: string) => Promise<boolean>
      }
    ]

    await expect(api.openExternalUrl('https://example.com')).resolves.toBe(false)
  })

  it('exposes run, auth, and model IPC methods', async () => {
    await import('../../../src/preload/index')

    const [, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        runSubmit: (input: unknown) => Promise<unknown>
        runAbort: (input: unknown) => Promise<unknown>
        runList: (sessionId: string) => Promise<unknown>
        onRunEvent: (callback: (event: unknown) => void) => () => void
        authStatus: (provider: string) => Promise<unknown>
        authLogin: (provider: string) => Promise<unknown>
        authLogout: (provider: string) => Promise<unknown>
        modelList: () => Promise<Array<{ provider: string; modelId: string; name: string; authStatus: 'oauth' | 'api_key' | 'none' }>>
      }
    ]

    // runSubmit
    invoke.mockResolvedValueOnce({ runId: 'run-1' })
    await expect(api.runSubmit({ sessionId: 's1', prompt: 'test', model: 'm', provider: 'p' })).resolves.toEqual({ runId: 'run-1' })
    expect(invoke).toHaveBeenCalledWith('run:submit', { sessionId: 's1', prompt: 'test', model: 'm', provider: 'p' })

    // runAbort
    invoke.mockResolvedValueOnce(true)
    await expect(api.runAbort({ runId: 'run-1' })).resolves.toBe(true)
    expect(invoke).toHaveBeenCalledWith('run:abort', { runId: 'run-1' })

    // runList
    invoke.mockResolvedValueOnce([])
    await expect(api.runList('s1')).resolves.toEqual([])
    expect(invoke).toHaveBeenCalledWith('run:list', { sessionId: 's1' })

    // onRunEvent returns an unsubscribe function
    expect(typeof api.onRunEvent).toBe('function')
    const callback = vi.fn()
    const unsubscribe = api.onRunEvent(callback)
    expect(on).toHaveBeenCalledWith('run:event', expect.any(Function))
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
    expect(removeListener).toHaveBeenCalledWith('run:event', expect.any(Function))

    // authStatus
    invoke.mockResolvedValueOnce('api_key')
    await expect(api.authStatus('anthropic')).resolves.toBe('api_key')
    expect(invoke).toHaveBeenCalledWith('auth:status', { provider: 'anthropic' })

    // authLogin
    invoke.mockResolvedValueOnce(false)
    await expect(api.authLogin('anthropic')).resolves.toBe(false)
    expect(invoke).toHaveBeenCalledWith('auth:login', { provider: 'anthropic' })

    // authLogout
    invoke.mockResolvedValueOnce(true)
    await expect(api.authLogout('anthropic')).resolves.toBe(true)
    expect(invoke).toHaveBeenCalledWith('auth:logout', { provider: 'anthropic' })

    // modelList
    const mockModels = [{ provider: 'anthropic', modelId: 'm', name: 'Model', authStatus: 'api_key' as const }]
    invoke.mockResolvedValueOnce(mockModels)
    await expect(api.modelList()).resolves.toEqual(mockModels)
    expect(invoke).toHaveBeenCalledWith('model:list')
  })

  it('exposes bootstrap, active selection, and spec IPC methods', async () => {
    await import('../../../src/preload/index')

    const [, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        appBootstrap: () => Promise<unknown>
        spaceSetActive: (spaceId: string) => Promise<unknown>
        sessionSetActive: (sessionId: string) => Promise<unknown>
        specGet: (input: { spaceId: string; sessionId: string }) => Promise<unknown>
        specSave: (input: {
          spaceId: string
          sessionId: string
          markdown: string
          appliedRunId?: string
          appliedAt?: string
        }) => Promise<unknown>
      }
    ]

    invoke.mockResolvedValueOnce({
      spaces: {},
      sessions: {},
      specDocuments: {},
      activeSpaceId: null,
      activeSessionId: null
    })
    await expect(api.appBootstrap()).resolves.toEqual({
      spaces: {},
      sessions: {},
      specDocuments: {},
      activeSpaceId: null,
      activeSessionId: null
    })
    expect(invoke).toHaveBeenCalledWith('app:bootstrap')

    invoke.mockResolvedValueOnce({ activeSpaceId: 'space-2', activeSessionId: null })
    await expect(api.spaceSetActive('space-2')).resolves.toEqual({ activeSpaceId: 'space-2', activeSessionId: null })
    expect(invoke).toHaveBeenCalledWith('space:setActive', { spaceId: 'space-2' })

    invoke.mockResolvedValueOnce({ activeSpaceId: 'space-1', activeSessionId: 'session-1' })
    await expect(api.sessionSetActive('session-1')).resolves.toEqual({
      activeSpaceId: 'space-1',
      activeSessionId: 'session-1'
    })
    expect(invoke).toHaveBeenCalledWith('session:setActive', { sessionId: 'session-1' })

    invoke.mockResolvedValueOnce({
      sourcePath: '/tmp/r/.kata/sessions/session-1/notes/spec.md',
      raw: '---\nstatus: drafting\nupdatedAt: 2026-03-03T00:00:00.000Z\n---\n\n# Spec',
      markdown: '# Spec',
      frontmatter: {
        status: 'drafting',
        updatedAt: '2026-03-03T00:00:00.000Z'
      },
      diagnostics: [],
      updatedAt: '2026-03-03T00:00:00.000Z'
    })
    await expect(api.specGet({ spaceId: 'space-1', sessionId: 'session-1' })).resolves.toEqual({
      sourcePath: '/tmp/r/.kata/sessions/session-1/notes/spec.md',
      raw: '---\nstatus: drafting\nupdatedAt: 2026-03-03T00:00:00.000Z\n---\n\n# Spec',
      markdown: '# Spec',
      frontmatter: {
        status: 'drafting',
        updatedAt: '2026-03-03T00:00:00.000Z'
      },
      diagnostics: [],
      updatedAt: '2026-03-03T00:00:00.000Z'
    })
    expect(invoke).toHaveBeenCalledWith('spec:get', { spaceId: 'space-1', sessionId: 'session-1' })

    const saveInput = {
      spaceId: 'space-1',
      sessionId: 'session-1',
      markdown: '# Saved',
      appliedRunId: 'run-9',
      appliedAt: '2026-03-03T00:10:00.000Z'
    }
    invoke.mockResolvedValueOnce({
      sourcePath: '/tmp/r/.kata/sessions/session-1/notes/spec.md',
      raw: '---\nstatus: drafting\nupdatedAt: 2026-03-03T00:11:00.000Z\nsourceRunId: run-9\n---\n\n# Saved',
      markdown: '# Saved',
      frontmatter: {
        status: 'drafting',
        updatedAt: '2026-03-03T00:11:00.000Z',
        sourceRunId: 'run-9'
      },
      diagnostics: [],
      updatedAt: '2026-03-03T00:11:00.000Z',
      appliedRunId: 'run-9'
    })
    await expect(api.specSave(saveInput)).resolves.toEqual({
      sourcePath: '/tmp/r/.kata/sessions/session-1/notes/spec.md',
      raw: '---\nstatus: drafting\nupdatedAt: 2026-03-03T00:11:00.000Z\nsourceRunId: run-9\n---\n\n# Saved',
      markdown: '# Saved',
      frontmatter: {
        status: 'drafting',
        updatedAt: '2026-03-03T00:11:00.000Z',
        sourceRunId: 'run-9'
      },
      diagnostics: [],
      updatedAt: '2026-03-03T00:11:00.000Z',
      appliedRunId: 'run-9'
    })
    expect(invoke).toHaveBeenCalledWith('spec:save', saveInput)
  })

  it('onRunEvent handler forwards event data to callback', async () => {
    await import('../../../src/preload/index')

    const [, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        onRunEvent: (callback: (event: unknown) => void) => () => void
      }
    ]

    const callback = vi.fn()
    api.onRunEvent(callback)

    // Extract the handler that was registered via ipcRenderer.on
    const registeredHandler = on.mock.calls.find(
      (call: unknown[]) => call[0] === 'run:event'
    )?.[1] as (event: unknown, data: unknown) => void

    expect(registeredHandler).toBeDefined()

    // Invoke the handler with mock IPC event and data
    const mockEvent = {}
    const mockData = { type: 'message_appended', message: { id: 'm1', role: 'agent', content: 'test', createdAt: 'now' } }
    registeredHandler(mockEvent, mockData)

    expect(callback).toHaveBeenCalledWith(mockData)
  })

  it('exposes dialogOpenDirectory, gitListBranches, githubListRepos, and githubListBranches', async () => {
    await import('../../../src/preload/index')

    const [, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      {
        dialogOpenDirectory: () => Promise<unknown>
        gitListBranches: (repoPath: string) => Promise<unknown>
        githubListRepos: () => Promise<unknown>
        githubListBranches: (owner: string, repo: string) => Promise<unknown>
      }
    ]

    // dialogOpenDirectory
    invoke.mockResolvedValueOnce({ path: '/Users/me/dev/repo' })
    await expect(api.dialogOpenDirectory()).resolves.toEqual({ path: '/Users/me/dev/repo' })
    expect(invoke).toHaveBeenCalledWith('dialog:openDirectory')

    // gitListBranches
    invoke.mockResolvedValueOnce(['main', 'develop'])
    await expect(api.gitListBranches('/Users/me/dev/repo')).resolves.toEqual(['main', 'develop'])
    expect(invoke).toHaveBeenCalledWith('git:listBranches', '/Users/me/dev/repo')

    // githubListRepos
    const mockRepos = [{ name: 'repo', nameWithOwner: 'org/repo', url: 'https://github.com/org/repo' }]
    invoke.mockResolvedValueOnce(mockRepos)
    await expect(api.githubListRepos()).resolves.toEqual(mockRepos)
    expect(invoke).toHaveBeenCalledWith('github:listRepos')

    // githubListBranches
    invoke.mockResolvedValueOnce(['main', 'feature'])
    await expect(api.githubListBranches('org', 'repo')).resolves.toEqual(['main', 'feature'])
    expect(invoke).toHaveBeenCalledWith('github:listBranches', { owner: 'org', repo: 'repo' })
  })
})
