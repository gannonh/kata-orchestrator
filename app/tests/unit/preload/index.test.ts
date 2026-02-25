// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

const { exposeInMainWorld, invoke } = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld
  },
  ipcRenderer: {
    invoke
  }
}))

describe('preload bridge', () => {
  afterEach(() => {
    exposeInMainWorld.mockReset()
    invoke.mockReset()
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
    const createInput = { name: 'test', repoUrl: 'url', rootPath: '/', branch: 'main' }
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
})
