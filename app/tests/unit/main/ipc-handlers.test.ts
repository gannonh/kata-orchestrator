// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRemoveHandler, mockHandle, mockOpenExternal } = vi.hoisted(() => ({
  mockRemoveHandler: vi.fn(),
  mockHandle: vi.fn(),
  mockOpenExternal: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: mockRemoveHandler,
    handle: mockHandle
  },
  shell: {
    openExternal: mockOpenExternal
  }
}))

import { registerIpcHandlers } from '../../../src/main/ipc-handlers'

type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>

function getHandlersByChannel(): Map<string, IpcHandler> {
  const handlers = new Map<string, IpcHandler>()
  for (const [channel, handler] of mockHandle.mock.calls) {
    handlers.set(channel as string, handler as IpcHandler)
  }

  return handlers
}

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers all preload IPC handlers', () => {
    registerIpcHandlers()

    expect(mockRemoveHandler).toHaveBeenCalledWith('kata:openExternalUrl')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:create')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:list')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:get')
    expect(mockRemoveHandler).toHaveBeenCalledWith('session:create')

    expect(mockHandle).toHaveBeenCalledTimes(5)
    expect(mockHandle).toHaveBeenCalledWith('kata:openExternalUrl', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('space:create', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('space:list', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('space:get', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('session:create', expect.any(Function))
  })

  it('rejects invalid and non-http(s) URLs', async () => {
    registerIpcHandlers()

    const handler = getHandlersByChannel().get('kata:openExternalUrl')

    expect(handler).toBeTypeOf('function')
    await expect(handler?.({}, 'not-a-url')).resolves.toBe(false)
    await expect(handler?.({}, 'file:///tmp/unsafe')).resolves.toBe(false)
    await expect(handler?.({}, 123)).resolves.toBe(false)
    expect(mockOpenExternal).not.toHaveBeenCalled()
  })

  it('opens valid external http(s) URLs through shell', async () => {
    mockOpenExternal.mockResolvedValue(undefined)

    registerIpcHandlers()

    const handler = getHandlersByChannel().get('kata:openExternalUrl')

    await expect(handler?.({}, 'https://example.com')).resolves.toBe(true)
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('creates, lists, and gets spaces through IPC handlers', async () => {
    registerIpcHandlers()
    const handlers = getHandlersByChannel()

    const spaceCreate = handlers.get('space:create')
    const spaceList = handlers.get('space:list')
    const spaceGet = handlers.get('space:get')

    expect(spaceCreate).toBeTypeOf('function')
    expect(spaceList).toBeTypeOf('function')
    expect(spaceGet).toBeTypeOf('function')

    const createdSpace = await spaceCreate?.({}, {
      name: 'My Space',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/repo',
      branch: 'main'
    })

    expect(createdSpace).toMatchObject({
      name: 'My Space',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/repo',
      branch: 'main',
      orchestrationMode: 'team',
      status: 'active'
    })
    expect(createdSpace).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        createdAt: expect.any(String)
      })
    )

    await expect(spaceList?.({})).resolves.toEqual([createdSpace])
    await expect(spaceGet?.({}, { id: (createdSpace as { id: string }).id })).resolves.toEqual(createdSpace)
    await expect(spaceGet?.({}, { id: 'missing' })).resolves.toBeNull()
  })

  it('creates a session only when the target space exists', async () => {
    registerIpcHandlers()
    const handlers = getHandlersByChannel()
    const spaceCreate = handlers.get('space:create')
    const sessionCreate = handlers.get('session:create')

    expect(sessionCreate).toBeTypeOf('function')

    await expect(sessionCreate?.({}, { spaceId: 'missing', label: 'Session 1' })).rejects.toThrow(
      'Cannot create session for unknown space'
    )

    const createdSpace = await spaceCreate?.({}, {
      name: 'My Space',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/repo',
      branch: 'main'
    })

    const createdSession = await sessionCreate?.({}, {
      spaceId: (createdSpace as { id: string }).id,
      label: 'Session 1'
    })

    expect(createdSession).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        spaceId: (createdSpace as { id: string }).id,
        label: 'Session 1',
        createdAt: expect.any(String)
      })
    )
  })
})
