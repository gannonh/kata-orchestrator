// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDefaultAppState } from '../../../src/shared/types/space'
import type { AppState } from '../../../src/shared/types/space'

const { mockRemoveHandler, mockHandle, mockOpenExternal, mockProvisionManagedWorkspace } = vi.hoisted(() => ({
  mockRemoveHandler: vi.fn(),
  mockHandle: vi.fn(),
  mockOpenExternal: vi.fn(),
  mockProvisionManagedWorkspace: vi.fn()
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

vi.mock('../../../src/main/workspace-provisioning', async () => {
  const actual = await vi.importActual<typeof import('../../../src/main/workspace-provisioning')>(
    '../../../src/main/workspace-provisioning'
  )
  return {
    ...actual,
    provisionManagedWorkspace: mockProvisionManagedWorkspace
  }
})

import { WorkspaceProvisioningError } from '../../../src/main/workspace-provisioning'
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
    mockProvisionManagedWorkspace.mockReset()
  })

  it('registers expected channels', () => {
    registerIpcHandlers(createMockStore())

    expect(mockRemoveHandler).toHaveBeenCalledWith('kata:openExternalUrl')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:create')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:list')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:get')
    expect(mockRemoveHandler).toHaveBeenCalledWith('session:create')
    expect(mockHandle).toHaveBeenCalledWith('space:create', expect.any(Function))
  })

  it('opens valid external http(s) URLs through shell', async () => {
    mockOpenExternal.mockResolvedValue(undefined)

    registerIpcHandlers(createMockStore())
    const handler = getHandlersByChannel().get('kata:openExternalUrl')

    await expect(handler?.({}, 'https://example.com')).resolves.toBe(true)
    await expect(handler?.({}, 'file:///tmp/unsafe')).resolves.toBe(false)
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com')
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
      branch: 'main',
      workspaceMode: 'external'
    })

    await expect(spaceList?.({})).resolves.toEqual([createdSpace])
  })

  it('space:create persists an external-mode space using provided rootPath', async () => {
    const store = createMockStore(createDefaultAppState())
    registerIpcHandlers(store)
    const spaceCreate = getHandlersByChannel().get('space:create')

    const createdSpace = await spaceCreate?.({}, {
      name: 'My External Space',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/repo',
      branch: 'main',
      workspaceMode: 'external',
      orchestrationMode: 'single'
    })

    expect(createdSpace).toMatchObject({
      name: 'My External Space',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/repo',
      branch: 'main',
      workspaceMode: 'external',
      orchestrationMode: 'single',
      status: 'active'
    })
    expect(store.save).toHaveBeenCalledTimes(1)
  })

  it('space:create delegates managed provisioning and persists rootPath/branch/name', async () => {
    mockProvisionManagedWorkspace.mockResolvedValue({
      rootPath: '/tmp/workspaces/kata-cloud-abcd1234/repo',
      cacheRepoPath: '/tmp/repos/kata-cloud',
      repoUrl: 'https://github.com/org/kata-cloud',
      branch: 'main'
    })
    const store = createMockStore({
      ...createDefaultAppState(),
      spaces: {
        existing: {
          id: 'existing',
          name: 'kata-cloud main',
          repoUrl: 'https://github.com/org/kata-cloud',
          rootPath: '/tmp/old',
          branch: 'main',
          workspaceMode: 'managed',
          orchestrationMode: 'team',
          createdAt: '2026-02-26T00:00:00.000Z',
          status: 'active'
        }
      }
    })
    registerIpcHandlers(store, {
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos'
    })

    const spaceCreate = getHandlersByChannel().get('space:create')
    const createdSpace = await spaceCreate?.({}, {
      prompt: 'Build feature',
      repoUrl: 'https://github.com/org/kata-cloud',
      branch: 'main',
      workspaceMode: 'managed',
      provisioningMethod: 'clone-github',
      sourceRemoteUrl: 'https://github.com/org/kata-cloud.git',
      orchestrationMode: 'team'
    })

    expect(mockProvisionManagedWorkspace).toHaveBeenCalledWith({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: expect.objectContaining({
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/org/kata-cloud.git',
        repoUrl: 'https://github.com/org/kata-cloud',
        branch: 'main'
      })
    })

    expect(createdSpace).toMatchObject({
      name: 'kata-cloud main (2)',
      rootPath: '/tmp/workspaces/kata-cloud-abcd1234/repo',
      branch: 'main',
      workspaceMode: 'managed',
      orchestrationMode: 'team'
    })
    expect(store.save).toHaveBeenCalledTimes(1)
  })

  it('space:create surfaces actionable managed provisioning errors', async () => {
    mockProvisionManagedWorkspace.mockRejectedValue(
      new WorkspaceProvisioningError('git', 'Clone failed', 'Check GitHub auth')
    )
    registerIpcHandlers(createMockStore(), {
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos'
    })

    const spaceCreate = getHandlersByChannel().get('space:create')
    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/org/repo',
        branch: 'main',
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/org/repo.git'
      })
    ).rejects.toThrow('Check GitHub auth')
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
    const sessionCreate = getHandlersByChannel().get('session:create')

    await expect(sessionCreate?.({}, { spaceId: 'missing', label: 'Session 1' })).rejects.toThrow()

    const createdSession = await sessionCreate?.({}, { spaceId: existingSpace.id, label: 'Session 1' })
    expect(createdSession).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        spaceId: existingSpace.id,
        label: 'Session 1'
      })
    )
    expect(store.save).toHaveBeenCalledTimes(1)
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
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        workspaceMode: 'external'
      })
    ).rejects.toThrow('External workspace mode requires a non-empty rootPath')
    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        workspaceMode: 'external',
        rootPath: 'relative/path'
      })
    ).rejects.toThrow('External workspace rootPath must be an absolute path')
    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        workspaceMode: 'managed'
      })
    ).rejects.toThrow('Space input has an invalid provisioningMethod')
    await expect(spaceGet?.({}, { id: 123 })).rejects.toThrow('space:get input must be an object with string id')
    await expect(sessionCreate?.({}, null)).rejects.toThrow('Session input must be an object')
  })
})
