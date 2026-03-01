// @vitest-environment node

import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDefaultAppState } from '../../../src/shared/types/space'
import type { AppState } from '../../../src/shared/types/space'

const { mockRemoveHandler, mockHandle, mockOpenExternal, mockShowOpenDialog, mockProvisionManagedWorkspace, mockFsAccess } = vi.hoisted(() => ({
  mockRemoveHandler: vi.fn(),
  mockHandle: vi.fn(),
  mockOpenExternal: vi.fn(),
  mockShowOpenDialog: vi.fn(),
  mockProvisionManagedWorkspace: vi.fn(),
  mockFsAccess: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: mockRemoveHandler,
    handle: mockHandle
  },
  shell: {
    openExternal: mockOpenExternal
  },
  dialog: {
    showOpenDialog: mockShowOpenDialog
  }
}))

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    default: {
      ...actual,
      promises: {
        ...actual.promises,
        access: mockFsAccess
      }
    },
    promises: {
      ...actual.promises,
      access: mockFsAccess
    }
  }
})

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
    await expect(handler?.({}, 42)).resolves.toBe(false)
    await expect(handler?.({}, 'http://example.com')).resolves.toBe(true)
    await expect(handler?.({}, 'not-a-url')).resolves.toBe(false)
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
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/repo',
      branch: 'main',
      workspaceMode: 'external',
      orchestrationMode: 'single'
    }) as { name: string }

    expect(createdSpace.name).toMatch(/^repo-[a-z0-9]{4}$/)
    expect(createdSpace).toMatchObject({
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
      repoUrl: 'https://github.com/org/kata-cloud',
      branch: 'main',
      workspaceMode: 'managed',
      provisioningMethod: 'clone-github',
      sourceRemoteUrl: 'https://github.com/org/kata-cloud.git',
      orchestrationMode: 'team'
    }) as { name: string }

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

    expect(createdSpace.name).toMatch(/^kata-cloud-[a-z0-9]{4}$/)
    expect(createdSpace).toMatchObject({
      rootPath: '/tmp/workspaces/kata-cloud-abcd1234/repo',
      branch: 'main',
      workspaceMode: 'managed',
      orchestrationMode: 'team'
    })
    expect(store.save).toHaveBeenCalledTimes(1)
  })

  it('space:create accepts copy-local managed payloads and derives repo label from local path', async () => {
    mockProvisionManagedWorkspace.mockResolvedValue({
      rootPath: '/tmp/workspaces/local-repo-abcd1234/repo',
      cacheRepoPath: '/tmp/repos/local-repo',
      repoUrl: 'https://github.com/org/local-repo',
      branch: 'main'
    })
    const store = createMockStore(createDefaultAppState())
    registerIpcHandlers(store, {
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos'
    })

    const spaceCreate = getHandlersByChannel().get('space:create')
    const createdSpace = await spaceCreate?.({}, {
      repoUrl: 'https://github.com/org/local-repo',
      branch: 'main',
      workspaceMode: 'managed',
      provisioningMethod: 'copy-local',
      sourceLocalPath: '/Users/me/dev/local-repo'
    })

    expect(mockProvisionManagedWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        provisioningMethod: 'copy-local',
        sourceLocalPath: '/Users/me/dev/local-repo'
      })
    }))
    const created = createdSpace as { name: string }
    expect(created.name).toMatch(/^local-repo-[a-z0-9]{4}$/)
    expect(createdSpace).toMatchObject({
      workspaceMode: 'managed'
    })
  })

  it('defaults omitted workspaceMode to managed and auto-generates nanoid name', async () => {
    mockProvisionManagedWorkspace.mockResolvedValue({
      rootPath: '/tmp/workspaces/override-abcd1234/repo',
      cacheRepoPath: '/tmp/repos/override',
      repoUrl: 'https://github.com/org/override',
      branch: 'main'
    })
    const store = createMockStore(createDefaultAppState())
    registerIpcHandlers(store)
    const spaceCreate = getHandlersByChannel().get('space:create')

    const createdSpace = await spaceCreate?.({}, {
      repoUrl: 'https://github.com/org/override',
      branch: 'main',
      provisioningMethod: 'clone-github',
      sourceRemoteUrl: 'https://github.com/org/override.git'
    }) as { name: string }

    expect(mockProvisionManagedWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        workspaceMode: 'managed'
      })
    }))
    expect(createdSpace.name).toMatch(/^override-[a-z0-9]{4}$/)
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

  it('space:create surfaces managed provisioning errors without remediation text when absent', async () => {
    mockProvisionManagedWorkspace.mockRejectedValue(
      new WorkspaceProvisioningError('git', 'Clone failed')
    )
    registerIpcHandlers(createMockStore())
    const spaceCreate = getHandlersByChannel().get('space:create')
    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/org/repo',
        branch: 'main',
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/org/repo.git'
      })
    ).rejects.toThrow('Managed provisioning failed (git): Clone failed.')
  })

  it('space:create defaults newRepoParentDir when managed new-repo payload leaves it blank', async () => {
    mockProvisionManagedWorkspace.mockResolvedValue({
      rootPath: '/tmp/workspaces/managed-new/repo',
      cacheRepoPath: '/tmp/repos/managed-new',
      repoUrl: '',
      branch: 'main'
    })
    registerIpcHandlers(createMockStore(), {
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos'
    })

    const spaceCreate = getHandlersByChannel().get('space:create')
    await spaceCreate?.({}, {
      repoUrl: '',
      branch: 'main',
      workspaceMode: 'managed',
      provisioningMethod: 'new-repo',
      newRepoParentDir: '',
      newRepoFolderName: 'managed-new'
    })

    expect(mockProvisionManagedWorkspace).toHaveBeenCalledWith({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: expect.objectContaining({
        provisioningMethod: 'new-repo',
        newRepoFolderName: 'managed-new',
        newRepoParentDir: path.join(os.homedir(), 'dev')
      })
    })
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
    await expect(
      spaceCreate?.({}, {
        repoUrl: 123,
        branch: 'main',
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/user/repo.git'
      })
    ).rejects.toThrow('Space input is missing required string fields')
    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        workspaceMode: 'bad-mode',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/user/repo.git'
      })
    ).rejects.toThrow('Space input has an invalid workspaceMode')
    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        workspaceMode: 'managed',
        orchestrationMode: 'bad-mode',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/user/repo.git'
      })
    ).rejects.toThrow('Space input has an invalid orchestrationMode')
    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: ''
      })
    ).rejects.toThrow('Space input sourceLocalPath must be a non-empty string')
    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: ''
      })
    ).rejects.toThrow('Space input sourceRemoteUrl must be a non-empty string')
    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        workspaceMode: 'managed',
        provisioningMethod: 'new-repo',
        newRepoParentDir: 123,
        newRepoFolderName: 'repo'
      })
    ).rejects.toThrow('Space input newRepoParentDir must be a string')
    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        workspaceMode: 'managed',
        provisioningMethod: 'new-repo',
        newRepoParentDir: '/tmp',
        newRepoFolderName: ''
      })
    ).rejects.toThrow('Space input newRepoFolderName must be a non-empty string')
    await expect(spaceGet?.({}, { id: 123 })).rejects.toThrow('space:get input must be an object with string id')
    await expect(sessionCreate?.({}, null)).rejects.toThrow('Session input must be an object')
    await expect(sessionCreate?.({}, { spaceId: 1, label: true })).rejects.toThrow(
      'Session input is missing required string fields'
    )
  })

  it('propagates unknown managed provisioning errors and reports save failures with error code', async () => {
    mockProvisionManagedWorkspace.mockRejectedValueOnce(new Error('unexpected explode'))
    const failingStore = createMockStore()
    registerIpcHandlers(failingStore)
    const spaceCreate = getHandlersByChannel().get('space:create')

    await expect(
      spaceCreate?.({}, {
        repoUrl: 'https://github.com/org/repo',
        branch: 'main',
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/org/repo.git'
      })
    ).rejects.toThrow('unexpected explode')

    mockProvisionManagedWorkspace.mockResolvedValueOnce({
      rootPath: '/tmp/workspaces/repo-1234/repo',
      cacheRepoPath: '/tmp/repos/repo',
      repoUrl: '',
      branch: 'main'
    })

    const saveErrorStore = createMockStore()
    saveErrorStore.save.mockImplementation(() => {
      throw Object.assign(new Error('no space'), { code: 'ENOSPC' })
    })
    registerIpcHandlers(saveErrorStore)
    const saveFailingSpaceCreate = getHandlersByChannel().get('space:create')

    await expect(
      saveFailingSpaceCreate?.({}, {
        repoUrl: '',
        branch: 'main',
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/org/repo.git'
      })
    ).rejects.toThrow('Space created but failed to save state (ENOSPC)')
  })

  it('falls back to default repo label and UNKNOWN save error code where needed', async () => {
    mockProvisionManagedWorkspace.mockResolvedValue({
      rootPath: '/tmp/workspaces/repo-1234/repo',
      cacheRepoPath: '/tmp/repos/repo',
      repoUrl: '',
      branch: 'main'
    })

    const unknownCodeStore = createMockStore()
    unknownCodeStore.save.mockImplementation(() => {
      throw new Error('save failed')
    })
    registerIpcHandlers(unknownCodeStore)
    const spaceCreate = getHandlersByChannel().get('space:create')
    await expect(
      spaceCreate?.({}, {
        repoUrl: '',
        branch: 'main',
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/org/repo.git'
      })
    ).rejects.toThrow('Space created but failed to save state (UNKNOWN)')

    const normalStore = createMockStore(createDefaultAppState())
    registerIpcHandlers(normalStore)
    const externalCreate = getHandlersByChannel().get('space:create')
    const created = await externalCreate?.({}, {
      repoUrl: '',
      branch: 'main',
      workspaceMode: 'external',
      rootPath: '/Users/me/repo'
    })
    const createdRecord = created as { name: string }
    expect(createdRecord.name).toMatch(/^repo-[a-z0-9]{4}$/)
  })

  describe('dialog:openDirectory', () => {
    it('returns selected directory path when .git exists', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/Users/me/dev/repo'] })
      mockFsAccess.mockResolvedValue(undefined)
      registerIpcHandlers(createMockStore())
      const handlers = getHandlersByChannel()
      const handler = handlers.get('dialog:openDirectory')!
      const result = await handler(null)
      expect(result).toEqual({ path: '/Users/me/dev/repo' })
    })

    it('returns null when dialog is canceled', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
      registerIpcHandlers(createMockStore())
      const handlers = getHandlersByChannel()
      const handler = handlers.get('dialog:openDirectory')!
      const result = await handler(null)
      expect(result).toBeNull()
    })
  })

  describe('git:listBranches', () => {
    it('is registered as a handler', () => {
      registerIpcHandlers(createMockStore())
      const handlers = getHandlersByChannel()
      expect(handlers.get('git:listBranches')).toBeDefined()
    })
  })

  describe('github:listRepos', () => {
    it('is registered as a handler', () => {
      registerIpcHandlers(createMockStore())
      const handlers = getHandlersByChannel()
      expect(handlers.get('github:listRepos')).toBeDefined()
    })
  })

  describe('github:listBranches', () => {
    it('is registered as a handler', () => {
      registerIpcHandlers(createMockStore())
      const handlers = getHandlersByChannel()
      expect(handlers.get('github:listBranches')).toBeDefined()
    })
  })
})
