// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultAppState } from '../../../src/shared/types/space'
import type { AppState } from '../../../src/shared/types/space'

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
type MockStore = {
  load: ReturnType<typeof vi.fn<[], AppState>>
  save: ReturnType<typeof vi.fn<[AppState], void>>
}

function getHandlersByChannel(): Map<string, IpcHandler> {
  const handlers = new Map<string, IpcHandler>()
  for (const [channel, handler] of mockHandle.mock.calls) {
    handlers.set(channel as string, handler as IpcHandler)
  }

  return handlers
}

function createMockStore(state: AppState = createDefaultAppState()): MockStore {
  return {
    load: vi.fn<[], AppState>().mockReturnValue(state),
    save: vi.fn<[AppState], void>()
  }
}

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers the external URL handler', () => {
    registerIpcHandlers(createMockStore())

    expect(mockRemoveHandler).toHaveBeenCalledWith('kata:openExternalUrl')
    expect(mockHandle).toHaveBeenCalledWith('kata:openExternalUrl', expect.any(Function))
  })

  it('rejects invalid and non-http(s) URLs', async () => {
    registerIpcHandlers(createMockStore())

    const handler = getHandlersByChannel().get('kata:openExternalUrl')

    expect(handler).toBeTypeOf('function')
    await expect(handler?.({}, 'not-a-url')).resolves.toBe(false)
    await expect(handler?.({}, 'file:///tmp/unsafe')).resolves.toBe(false)
    await expect(handler?.({}, 123)).resolves.toBe(false)
    expect(mockOpenExternal).not.toHaveBeenCalled()
  })

  it('opens valid external http(s) URLs through shell', async () => {
    mockOpenExternal.mockResolvedValue(undefined)

    registerIpcHandlers(createMockStore())

    const handler = getHandlersByChannel().get('kata:openExternalUrl')

    await expect(handler?.({}, 'https://example.com')).resolves.toBe(true)
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('registers all store-backed space/session IPC handlers', () => {
    registerIpcHandlers(createMockStore())

    expect(mockRemoveHandler).toHaveBeenCalledWith('space:create')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:list')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:get')
    expect(mockRemoveHandler).toHaveBeenCalledWith('session:create')
    expect(mockHandle).toHaveBeenCalledWith('space:create', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('space:list', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('space:get', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('session:create', expect.any(Function))
  })

  it('falls back to in-memory store when no store is injected', async () => {
    vi.resetModules()
    const { registerIpcHandlers: register } = await import('../../../src/main/ipc-handlers')
    register()
    const handlers = getHandlersByChannel()
    const spaceCreate = handlers.get('space:create')
    const spaceList = handlers.get('space:list')

    const createdSpace = await spaceCreate?.({}, {
      name: 'Fallback Space',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/repo',
      branch: 'main'
    })

    await expect(spaceList?.({})).resolves.toEqual([createdSpace])
  })

  it('space:create persists a new SpaceRecord with generated id and createdAt', async () => {
    const initialState = createDefaultAppState()
    const store = createMockStore(initialState)
    registerIpcHandlers(store)

    const handlers = getHandlersByChannel()
    const spaceCreate = handlers.get('space:create')

    expect(spaceCreate).toBeTypeOf('function')

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
    expect(store.save).toHaveBeenCalledTimes(1)
    const [savedState] = store.save.mock.calls[0]
    expect(savedState.spaces[(createdSpace as { id: string }).id]).toMatchObject(createdSpace as object)
  })

  it('space:list and space:get read from store state', async () => {
    const existing = {
      id: 'space-1',
      name: 'Existing',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/repo',
      branch: 'main',
      orchestrationMode: 'team' as const,
      createdAt: '2026-02-25T00:00:00.000Z',
      status: 'active' as const
    }
    const store = createMockStore({
      ...createDefaultAppState(),
      spaces: { [existing.id]: existing }
    })
    registerIpcHandlers(store)
    const handlers = getHandlersByChannel()
    const spaceList = handlers.get('space:list')
    const spaceGet = handlers.get('space:get')

    await expect(spaceList?.({})).resolves.toEqual([existing])
    await expect(spaceGet?.({}, { id: existing.id })).resolves.toEqual(existing)
    await expect(spaceGet?.({}, { id: 'missing' })).resolves.toBeNull()
  })

  it('session:create persists a new SessionRecord only when space exists', async () => {
    const existingSpace = {
      id: 'space-1',
      name: 'Existing',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/repo',
      branch: 'main',
      orchestrationMode: 'team' as const,
      createdAt: '2026-02-25T00:00:00.000Z',
      status: 'active' as const
    }
    const store = createMockStore({
      ...createDefaultAppState(),
      spaces: { [existingSpace.id]: existingSpace }
    })
    registerIpcHandlers(store)
    const handlers = getHandlersByChannel()
    const sessionCreate = handlers.get('session:create')

    await expect(sessionCreate?.({}, { spaceId: 'missing', label: 'Session 1' })).rejects.toThrow()

    const createdSession = await sessionCreate?.({}, {
      spaceId: existingSpace.id,
      label: 'Session 1'
    })

    expect(createdSession).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        spaceId: existingSpace.id,
        label: 'Session 1',
        createdAt: expect.any(String)
      })
    )
    expect(store.save).toHaveBeenCalledTimes(1)
    const [savedState] = store.save.mock.calls[0]
    expect(savedState.activeSpaceId).toBe(existingSpace.id)
    expect(savedState.activeSessionId).toBe((createdSession as { id: string }).id)
    expect(savedState.sessions[(createdSession as { id: string }).id]).toMatchObject(createdSession as object)
  })

  it('rejects malformed payloads for space and session handlers', async () => {
    registerIpcHandlers(createMockStore())
    const handlers = getHandlersByChannel()
    const spaceCreate = handlers.get('space:create')
    const spaceGet = handlers.get('space:get')
    const sessionCreate = handlers.get('session:create')

    await expect(spaceCreate?.({}, null)).rejects.toThrow('Space input must be an object')
    await expect(
      spaceCreate?.({}, {
        name: 'My Space',
        repoUrl: 'https://github.com/user/repo',
        rootPath: '/Users/me/repo'
      })
    ).rejects.toThrow('Space input is missing required string fields')

    await expect(
      spaceCreate?.({}, {
        name: 'My Space',
        repoUrl: 'https://github.com/user/repo',
        rootPath: '/Users/me/repo',
        branch: 'main',
        orchestrationMode: 'invalid-mode'
      })
    ).rejects.toThrow('Space input has an invalid orchestrationMode')

    await expect(spaceGet?.({}, { id: 123 })).rejects.toThrow('space:get input must be an object with string id')
    await expect(sessionCreate?.({}, null)).rejects.toThrow('Session input must be an object')

    await expect(sessionCreate?.({}, { spaceId: 'space-1' })).rejects.toThrow('Session input is missing required string fields')
  })
})
