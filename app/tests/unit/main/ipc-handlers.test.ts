// @vitest-environment node

import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDefaultAppState } from '../../../src/shared/types/space'
import type { AppState, SessionAgentRecord } from '../../../src/shared/types/space'

const { mockRemoveHandler, mockHandle, mockOpenExternal, mockShowOpenDialog, mockProvisionManagedWorkspace, mockFsAccess, mockExecFile } = vi.hoisted(() => ({
  mockRemoveHandler: vi.fn(),
  mockHandle: vi.fn(),
  mockOpenExternal: vi.fn(),
  mockShowOpenDialog: vi.fn(),
  mockProvisionManagedWorkspace: vi.fn(),
  mockFsAccess: vi.fn(),
  mockExecFile: vi.fn()
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

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')
  return {
    ...actual,
    execFile: mockExecFile
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

const mockCreateRun = vi.fn()
const mockUpdateRunStatus = vi.fn()
const mockAppendRunMessage = vi.fn()
const mockSetRunDraft = vi.fn()
const mockMarkRunDraftApplied = vi.fn()
const mockGetRunsForSession = vi.fn()

vi.mock('../../../src/main/orchestrator', () => ({
  createRun: (...args: unknown[]) => mockCreateRun(...args),
  updateRunStatus: (...args: unknown[]) => mockUpdateRunStatus(...args),
  appendRunMessage: (...args: unknown[]) => mockAppendRunMessage(...args),
  setRunDraft: (...args: unknown[]) => mockSetRunDraft(...args),
  markRunDraftApplied: (...args: unknown[]) => mockMarkRunDraftApplied(...args),
  getRunsForSession: (...args: unknown[]) => mockGetRunsForSession(...args)
}))

const mockCreateAgentRunner = vi.fn()

vi.mock('../../../src/main/agent-runner', () => ({
  createAgentRunner: (...args: unknown[]) => mockCreateAgentRunner(...args)
}))

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
    expect(mockRemoveHandler).toHaveBeenCalledWith('app:bootstrap')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:create')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:list')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:get')
    expect(mockRemoveHandler).toHaveBeenCalledWith('space:setActive')
    expect(mockRemoveHandler).toHaveBeenCalledWith('session:create')
    expect(mockRemoveHandler).toHaveBeenCalledWith('session-agent-roster:list')
    expect(mockRemoveHandler).toHaveBeenCalledWith('session:listBySpace')
    expect(mockRemoveHandler).toHaveBeenCalledWith('session:setActive')
    expect(mockRemoveHandler).toHaveBeenCalledWith('spec:get')
    expect(mockRemoveHandler).toHaveBeenCalledWith('spec:save')
    expect(mockRemoveHandler).toHaveBeenCalledWith('spec:applyDraft')
    expect(mockHandle).toHaveBeenCalledWith('app:bootstrap', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('space:create', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('space:setActive', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('session-agent-roster:list', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('session:listBySpace', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('session:setActive', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('spec:get', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('spec:save', expect.any(Function))
    expect(mockHandle).toHaveBeenCalledWith('spec:applyDraft', expect.any(Function))
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

  it('requires a store argument', () => {
    // @ts-expect-error -- verifying runtime behavior when called without store
    expect(() => registerIpcHandlers(undefined)).toThrow()
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

  it('session:create preserves existing roster state and seeds baseline agents for the new session', async () => {
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
    const existingRosterEntry: SessionAgentRecord = {
      id: 'agent-existing',
      sessionId: 'session-existing',
      name: 'Existing Agent',
      role: 'Existing role',
      kind: 'specialist',
      status: 'idle',
      avatarColor: '#999999',
      sortOrder: 9,
      createdAt: '2026-02-24T00:00:00.000Z',
      updatedAt: '2026-02-24T00:00:00.000Z'
    }
    const store = createMockStore({
      ...createDefaultAppState(),
      spaces: { [existingSpace.id]: existingSpace },
      agentRoster: { [existingRosterEntry.id]: existingRosterEntry }
    })
    registerIpcHandlers(store)
    const sessionCreate = getHandlersByChannel().get('session:create')!

    const createdSession = await sessionCreate({}, { spaceId: existingSpace.id, label: 'Session 2' })
    const savedState = store.save.mock.calls[0]?.[0] as AppState
    const seededRoster = Object.values(savedState.agentRoster)
      .filter((entry) => entry.sessionId === (createdSession as { id: string }).id)
      .sort((left, right) => left.sortOrder - right.sortOrder)

    expect(savedState.agentRoster[existingRosterEntry.id]).toEqual(existingRosterEntry)
    expect(seededRoster).toHaveLength(2)
    expect(seededRoster).toEqual([
      expect.objectContaining({
        sessionId: (createdSession as { id: string }).id,
        name: 'Kata Agents',
        role: 'System-managed agent group',
        kind: 'system',
        status: 'idle',
        avatarColor: '#334155',
        sortOrder: 0
      }),
      expect.objectContaining({
        sessionId: (createdSession as { id: string }).id,
        name: 'MVP Planning Coordinator',
        role: 'Coordinates MVP planning tasks',
        kind: 'coordinator',
        status: 'idle',
        avatarColor: '#0f766e',
        sortOrder: 1
      })
    ])
  })

  it('session:create wraps save failures with a descriptive error code', async () => {
    const existingSpace = {
      id: 'space-1',
      name: 'Existing',
      repoLabel: 'org/repo',
      repoUrl: '',
      branch: 'main',
      rootPath: '/tmp/repo',
      workspaceMode: 'managed' as const,
      provisioningMethod: 'clone-github' as const,
      orchestrationMode: 'team' as const,
      createdAt: '2026-03-01T00:00:00.000Z',
      status: 'active' as const
    }

    const saveErrorStore = createMockStore({
      ...createDefaultAppState(),
      spaces: { [existingSpace.id]: existingSpace }
    })
    saveErrorStore.save.mockImplementation(() => {
      throw Object.assign(new Error('disk full'), { code: 'ENOSPC' })
    })
    registerIpcHandlers(saveErrorStore)
    const sessionCreate = getHandlersByChannel().get('session:create')

    await expect(
      sessionCreate?.({}, { spaceId: existingSpace.id, label: 'Session 1' })
    ).rejects.toThrow('Session created but failed to save state (ENOSPC)')
  })

  it('session-agent-roster:list returns sorted entries for a session and [] for unknown session ids', async () => {
    const roster: Record<string, SessionAgentRecord> = {
      late: {
        id: 'late',
        sessionId: 'session-1',
        name: 'Late',
        role: 'Late role',
        kind: 'specialist',
        status: 'idle',
        avatarColor: '#111111',
        sortOrder: 1,
        createdAt: '2026-02-27T00:00:03.000Z',
        updatedAt: '2026-02-27T00:00:03.000Z'
      },
      firstCreated: {
        id: 'first-created',
        sessionId: 'session-1',
        name: 'First Created',
        role: 'First role',
        kind: 'specialist',
        status: 'idle',
        avatarColor: '#222222',
        sortOrder: 1,
        createdAt: '2026-02-27T00:00:01.000Z',
        updatedAt: '2026-02-27T00:00:01.000Z'
      },
      system: {
        id: 'system',
        sessionId: 'session-1',
        name: 'System',
        role: 'System role',
        kind: 'system',
        status: 'idle',
        avatarColor: '#333333',
        sortOrder: 0,
        createdAt: '2026-02-27T00:00:02.000Z',
        updatedAt: '2026-02-27T00:00:02.000Z'
      },
      otherSession: {
        id: 'other-session',
        sessionId: 'session-2',
        name: 'Other Session',
        role: 'Other role',
        kind: 'coordinator',
        status: 'idle',
        avatarColor: '#444444',
        sortOrder: 0,
        createdAt: '2026-02-27T00:00:00.000Z',
        updatedAt: '2026-02-27T00:00:00.000Z'
      }
    }
    const store = createMockStore({
      ...createDefaultAppState(),
      agentRoster: roster
    })
    registerIpcHandlers(store)
    const rosterList = getHandlersByChannel().get('session-agent-roster:list')!

    await expect(rosterList({}, { sessionId: 'session-1' })).resolves.toEqual([
      roster.system,
      roster.firstCreated,
      roster.late
    ])
    await expect(rosterList({}, { sessionId: 'missing' })).resolves.toEqual([])
  })

  it('session:listBySpace returns sessions for the space sorted by newest first', async () => {
    const sessions = {
      old: {
        id: 'session-old',
        spaceId: 'space-1',
        label: 'Old',
        createdAt: '2026-02-27T00:00:00.000Z'
      },
      otherSpace: {
        id: 'session-other-space',
        spaceId: 'space-2',
        label: 'Other Space',
        createdAt: '2026-02-28T00:00:00.000Z'
      },
      newest: {
        id: 'session-newest',
        spaceId: 'space-1',
        label: 'Newest',
        createdAt: '2026-03-01T00:00:00.000Z'
      }
    }
    const store = createMockStore({
      ...createDefaultAppState(),
      sessions
    })
    registerIpcHandlers(store)
    const sessionListBySpace = getHandlersByChannel().get('session:listBySpace')!

    await expect(sessionListBySpace({}, { spaceId: 'space-1' })).resolves.toEqual([
      sessions.newest,
      sessions.old
    ])
  })

  it('app:bootstrap returns persisted startup slices including active IDs and spec documents', async () => {
    const state = {
      ...createDefaultAppState(),
      spaces: {
        'space-1': {
          id: 'space-1',
          name: 'Space 1',
          repoUrl: 'https://github.com/org/repo',
          rootPath: '/tmp/repo',
          branch: 'main',
          orchestrationMode: 'team' as const,
          createdAt: '2026-03-03T00:00:00.000Z',
          status: 'active' as const
        }
      },
      sessions: {
        'session-1': {
          id: 'session-1',
          spaceId: 'space-1',
          label: 'Session 1',
          createdAt: '2026-03-03T00:00:00.000Z'
        }
      },
      specDocuments: {
        'space-1:session-1': {
          markdown: '# Spec',
          updatedAt: '2026-03-03T00:10:00.000Z',
          appliedRunId: 'run-1',
          appliedAt: '2026-03-03T00:11:00.000Z'
        }
      },
      activeSpaceId: 'space-1',
      activeSessionId: 'session-1'
    }
    const store = createMockStore(state)
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('app:bootstrap')!
    await expect(handler({})).resolves.toEqual({
      spaces: state.spaces,
      sessions: state.sessions,
      specDocuments: state.specDocuments,
      activeSpaceId: 'space-1',
      activeSessionId: 'session-1'
    })
  })

  it('space:setActive persists activeSpaceId and clears activeSessionId when session is outside that space', async () => {
    const state = {
      ...createDefaultAppState(),
      spaces: {
        'space-1': {
          id: 'space-1',
          name: 'Space 1',
          repoUrl: 'https://github.com/org/repo1',
          rootPath: '/tmp/repo1',
          branch: 'main',
          orchestrationMode: 'team' as const,
          createdAt: '2026-03-03T00:00:00.000Z',
          status: 'active' as const
        },
        'space-2': {
          id: 'space-2',
          name: 'Space 2',
          repoUrl: 'https://github.com/org/repo2',
          rootPath: '/tmp/repo2',
          branch: 'main',
          orchestrationMode: 'team' as const,
          createdAt: '2026-03-03T00:00:00.000Z',
          status: 'active' as const
        }
      },
      sessions: {
        'session-1': {
          id: 'session-1',
          spaceId: 'space-1',
          label: 'Session 1',
          createdAt: '2026-03-03T00:00:00.000Z'
        }
      },
      activeSpaceId: 'space-1',
      activeSessionId: 'session-1'
    }
    const store = createMockStore(state)
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('space:setActive')!
    await expect(handler({}, { spaceId: 'space-2' })).resolves.toEqual({
      activeSpaceId: 'space-2',
      activeSessionId: null
    })
    expect(store.save).toHaveBeenCalledWith({
      ...state,
      activeSpaceId: 'space-2',
      activeSessionId: null
    })
  })

  it('space:setActive rejects unknown space ids', async () => {
    const store = createMockStore(createDefaultAppState())
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('space:setActive')!
    await expect(handler({}, { spaceId: 'missing-space' })).rejects.toThrow(
      'Cannot set active space to unknown id: missing-space'
    )
  })

  it('session:setActive persists activeSessionId and matching activeSpaceId', async () => {
    const state = {
      ...createDefaultAppState(),
      spaces: {
        'space-1': {
          id: 'space-1',
          name: 'Space 1',
          repoUrl: 'https://github.com/org/repo1',
          rootPath: '/tmp/repo1',
          branch: 'main',
          orchestrationMode: 'team' as const,
          createdAt: '2026-03-03T00:00:00.000Z',
          status: 'active' as const
        },
        'space-2': {
          id: 'space-2',
          name: 'Space 2',
          repoUrl: 'https://github.com/org/repo2',
          rootPath: '/tmp/repo2',
          branch: 'main',
          orchestrationMode: 'team' as const,
          createdAt: '2026-03-03T00:00:00.000Z',
          status: 'active' as const
        }
      },
      sessions: {
        'session-1': {
          id: 'session-1',
          spaceId: 'space-2',
          label: 'Session 1',
          createdAt: '2026-03-03T00:00:00.000Z'
        }
      },
      activeSpaceId: 'space-1',
      activeSessionId: null
    }
    const store = createMockStore(state)
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('session:setActive')!
    await expect(handler({}, { sessionId: 'session-1' })).resolves.toEqual({
      activeSpaceId: 'space-2',
      activeSessionId: 'session-1'
    })
    expect(store.save).toHaveBeenCalledWith({
      ...state,
      activeSpaceId: 'space-2',
      activeSessionId: 'session-1'
    })
  })

  it('session:setActive rejects unknown session ids', async () => {
    const store = createMockStore(createDefaultAppState())
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('session:setActive')!
    await expect(handler({}, { sessionId: 'missing-session' })).rejects.toThrow(
      'Cannot set active session to unknown id: missing-session'
    )
  })

  it('spec:get returns persisted spec document by <spaceId>:<sessionId> key', async () => {
    const store = createMockStore({
      ...createDefaultAppState(),
      spaces: {
        'space-1': {
          id: 'space-1', name: 'S1', repoUrl: 'https://github.com/t/r', rootPath: '/tmp/r',
          branch: 'main', orchestrationMode: 'team', createdAt: '2026-03-03T00:00:00.000Z', status: 'active'
        }
      },
      sessions: {
        'session-1': { id: 'session-1', spaceId: 'space-1', label: 'Sess', createdAt: '2026-03-03T00:00:00.000Z' }
      },
      specDocuments: {
        'space-1:session-1': {
          markdown: '# Persisted',
          updatedAt: '2026-03-03T00:00:00.000Z'
        }
      }
    })
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('spec:get')!
    await expect(handler({}, { spaceId: 'space-1', sessionId: 'session-1' })).resolves.toEqual({
      markdown: '# Persisted',
      updatedAt: '2026-03-03T00:00:00.000Z'
    })
  })

  it('spec:get throws for unknown spaceId', async () => {
    const store = createMockStore(createDefaultAppState())
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('spec:get')!
    await expect(handler({}, { spaceId: 'missing', sessionId: 'sess' })).rejects.toThrow('Unknown spaceId: missing')
  })

  it('spec:get throws for unknown sessionId', async () => {
    const store = createMockStore({
      ...createDefaultAppState(),
      spaces: {
        'space-1': {
          id: 'space-1', name: 'S1', repoUrl: 'https://github.com/t/r', rootPath: '/tmp/r',
          branch: 'main', orchestrationMode: 'team' as const, createdAt: '2026-03-03T00:00:00.000Z', status: 'active' as const
        }
      }
    })
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('spec:get')!
    await expect(handler({}, { spaceId: 'space-1', sessionId: 'missing' })).rejects.toThrow('Unknown sessionId: missing')
  })

  it('spec:get throws when session belongs to a different space', async () => {
    const store = createMockStore({
      ...createDefaultAppState(),
      spaces: {
        'space-1': {
          id: 'space-1', name: 'S1', repoUrl: 'https://github.com/t/r', rootPath: '/tmp/r',
          branch: 'main', orchestrationMode: 'team' as const, createdAt: '2026-03-03T00:00:00.000Z', status: 'active' as const
        }
      },
      sessions: {
        'session-1': { id: 'session-1', spaceId: 'space-2', label: 'Sess', createdAt: '2026-03-03T00:00:00.000Z' }
      }
    })
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('spec:get')!
    await expect(handler({}, { spaceId: 'space-1', sessionId: 'session-1' })).rejects.toThrow(
      'Session session-1 does not belong to space space-1'
    )
  })

  it('spec:save upserts markdown with updatedAt and optional applied fields', async () => {
    const state = {
      ...createDefaultAppState(),
      spaces: {
        'space-1': {
          id: 'space-1', name: 'S1', repoUrl: 'https://github.com/t/r', rootPath: '/tmp/r',
          branch: 'main', orchestrationMode: 'team' as const, createdAt: '2026-03-03T00:00:00.000Z', status: 'active' as const
        }
      },
      sessions: {
        'session-1': { id: 'session-1', spaceId: 'space-1', label: 'Sess', createdAt: '2026-03-03T00:00:00.000Z' }
      }
    }
    const store = createMockStore(state)
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('spec:save')!
    const result = await handler({}, {
      spaceId: 'space-1',
      sessionId: 'session-1',
      markdown: '# Updated markdown',
      appliedRunId: 'run-55',
      appliedAt: '2026-03-03T00:12:00.000Z'
    })

    expect(result).toEqual(expect.objectContaining({
      markdown: '# Updated markdown',
      appliedRunId: 'run-55',
      appliedAt: '2026-03-03T00:12:00.000Z',
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    }))
    expect(store.save).toHaveBeenCalledWith({
      ...state,
      specDocuments: {
        'space-1:session-1': expect.objectContaining({
          markdown: '# Updated markdown',
          appliedRunId: 'run-55',
          appliedAt: '2026-03-03T00:12:00.000Z',
          updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      }
    })
  })

  it('spec:save preserves existing applied metadata when omitted from input', async () => {
    const state = {
      ...createDefaultAppState(),
      spaces: {
        'space-1': {
          id: 'space-1', name: 'S1', repoUrl: 'https://github.com/t/r', rootPath: '/tmp/r',
          branch: 'main', orchestrationMode: 'team' as const, createdAt: '2026-03-03T00:00:00.000Z', status: 'active' as const
        }
      },
      sessions: {
        'session-1': { id: 'session-1', spaceId: 'space-1', label: 'Sess', createdAt: '2026-03-03T00:00:00.000Z' }
      },
      specDocuments: {
        'space-1:session-1': {
          markdown: '# Existing',
          updatedAt: '2026-03-03T00:00:00.000Z',
          appliedRunId: 'run-existing',
          appliedAt: '2026-03-03T00:01:00.000Z'
        }
      }
    }
    const store = createMockStore(state)
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('spec:save')!
    const result = await handler({}, {
      spaceId: 'space-1',
      sessionId: 'session-1',
      markdown: '# Updated without explicit applied metadata'
    })

    expect(result).toEqual(expect.objectContaining({
      markdown: '# Updated without explicit applied metadata',
      appliedRunId: 'run-existing',
      appliedAt: '2026-03-03T00:01:00.000Z',
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    }))
  })

  it('spec:applyDraft saves markdown/applied metadata and marks run draft applied', async () => {
    const state = {
      ...createDefaultAppState(),
      spaces: {
        'space-1': {
          id: 'space-1', name: 'S1', repoUrl: 'https://github.com/t/r', rootPath: '/tmp/r',
          branch: 'main', orchestrationMode: 'team' as const, createdAt: '2026-03-03T00:00:00.000Z', status: 'active' as const
        }
      },
      sessions: {
        'session-1': { id: 'session-1', spaceId: 'space-1', label: 'Sess', createdAt: '2026-03-03T00:00:00.000Z' }
      },
      runs: {
        'run-10': {
          id: 'run-10', sessionId: 'session-1', prompt: 'test', status: 'completed' as const,
          model: 'm', provider: 'p', createdAt: '2026-03-03T00:00:00.000Z', messages: []
        }
      }
    }
    const store = createMockStore(state)
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('spec:applyDraft')!
    const result = await handler({}, {
      spaceId: 'space-1',
      sessionId: 'session-1',
      draft: {
        runId: 'run-10',
        generatedAt: '2026-03-03T00:00:00.000Z',
        content: '## Applied draft'
      }
    })

    expect(result).toEqual(expect.objectContaining({
      markdown: '## Applied draft',
      appliedRunId: 'run-10',
      appliedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    }))
    expect(store.save).toHaveBeenCalledWith({
      ...state,
      specDocuments: {
        'space-1:session-1': expect.objectContaining({
          markdown: '## Applied draft',
          appliedRunId: 'run-10',
          appliedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      }
    })
    expect(mockMarkRunDraftApplied).toHaveBeenCalledTimes(1)
    expect(mockMarkRunDraftApplied).toHaveBeenCalledWith(
      store,
      'run-10',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    )
  })

  it('spec:applyDraft throws when run does not belong to session', async () => {
    const state = {
      ...createDefaultAppState(),
      spaces: {
        'space-1': {
          id: 'space-1', name: 'S1', repoUrl: 'https://github.com/t/r', rootPath: '/tmp/r',
          branch: 'main', orchestrationMode: 'team' as const, createdAt: '2026-03-03T00:00:00.000Z', status: 'active' as const
        }
      },
      sessions: {
        'session-1': { id: 'session-1', spaceId: 'space-1', label: 'Sess', createdAt: '2026-03-03T00:00:00.000Z' }
      },
      runs: {
        'run-10': {
          id: 'run-10', sessionId: 'other-session', prompt: 'test', status: 'completed' as const,
          model: 'm', provider: 'p', createdAt: '2026-03-03T00:00:00.000Z', messages: []
        }
      }
    }
    const store = createMockStore(state)
    registerIpcHandlers(store)

    const handler = getHandlersByChannel().get('spec:applyDraft')!
    await expect(handler({}, {
      spaceId: 'space-1',
      sessionId: 'session-1',
      draft: {
        runId: 'run-10',
        generatedAt: '2026-03-03T00:00:00.000Z',
        content: '## Draft'
      }
    })).rejects.toThrow('Draft run run-10 does not belong to session session-1')
  })

  it('rejects malformed payloads for space and session handlers', async () => {
    registerIpcHandlers(createMockStore())
    const handlers = getHandlersByChannel()
    const spaceSetActive = handlers.get('space:setActive')
    const spaceCreate = handlers.get('space:create')
    const spaceGet = handlers.get('space:get')
    const sessionCreate = handlers.get('session:create')
    const sessionAgentRosterList = handlers.get('session-agent-roster:list')
    const sessionListBySpace = handlers.get('session:listBySpace')
    const sessionSetActive = handlers.get('session:setActive')
    const specGet = handlers.get('spec:get')
    const specSave = handlers.get('spec:save')
    const specApplyDraft = handlers.get('spec:applyDraft')

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
    await expect(sessionAgentRosterList?.({}, { sessionId: 123 })).rejects.toThrow(
      'session-agent-roster:list input must be an object with string sessionId'
    )
    await expect(sessionListBySpace?.({}, { spaceId: 123 })).rejects.toThrow(
      'session:listBySpace input must be an object with string spaceId'
    )
    await expect(spaceSetActive?.({}, { spaceId: 123 })).rejects.toThrow(
      'space:setActive input must be an object with string spaceId'
    )
    await expect(sessionSetActive?.({}, { sessionId: 123 })).rejects.toThrow(
      'session:setActive input must be an object with string sessionId'
    )
    await expect(specGet?.({}, { spaceId: 'space-1', sessionId: 123 })).rejects.toThrow(
      'spec:get input must be an object with string spaceId and sessionId'
    )
    await expect(specSave?.({}, { spaceId: 'space-1', sessionId: 'session-1', markdown: 123 })).rejects.toThrow(
      'spec:save input must include string spaceId, sessionId, and markdown'
    )
    await expect(specSave?.({}, { spaceId: 'space-1', sessionId: 'session-1', markdown: '# ok', appliedRunId: 123 })).rejects.toThrow(
      'spec:save appliedRunId must be a string when provided'
    )
    await expect(specSave?.({}, { spaceId: 'space-1', sessionId: 'session-1', markdown: '# ok', appliedAt: 123 })).rejects.toThrow(
      'spec:save appliedAt must be a string when provided'
    )
    await expect(specApplyDraft?.({}, { spaceId: 'space-1', sessionId: 'session-1', draft: null })).rejects.toThrow(
      'spec:applyDraft input must include a draft object'
    )
    await expect(specApplyDraft?.({}, { spaceId: 'space-1', sessionId: 'session-1', draft: { runId: 123, content: '# bad' } })).rejects.toThrow(
      'spec:applyDraft draft must include string runId and content'
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

    it('returns error when selected directory is not a git repository', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/Users/me/dev/not-a-repo'] })
      mockFsAccess.mockRejectedValue(new Error('ENOENT'))
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('dialog:openDirectory')!
      const result = await handler(null)
      expect(result).toEqual({ error: 'Selected directory is not a git repository.', path: '/Users/me/dev/not-a-repo' })
    })
  })

  describe('git:listBranches', () => {
    it('returns branch list on success', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, result: { stdout: string }) => void) => {
        cb(null, { stdout: 'main\ndevelop\nfeature/test\n' })
      })
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('git:listBranches')!
      const result = await handler(null, '/Users/me/dev/repo')
      expect(result).toEqual(['main', 'develop', 'feature/test'])
    })

    it('returns error object when git fails', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('git failed'))
      })
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('git:listBranches')!
      const result = await handler(null, '/bad/path')
      expect(result).toEqual({ error: 'Could not read branches.' })
    })

    it('returns error object when repoPath is not a string', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('git:listBranches')!
      await expect(handler(null, 123)).resolves.toEqual({ error: 'repoPath must be a string' })
    })
  })

  describe('github:listRepos', () => {
    it('returns parsed repo list on success', async () => {
      const repos = [{ name: 'repo', nameWithOwner: 'org/repo', url: 'https://github.com/org/repo' }]
      mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null, result: { stdout: string }) => void) => {
        cb(null, { stdout: JSON.stringify(repos) })
      })
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('github:listRepos')!
      const result = await handler(null)
      expect(result).toEqual(repos)
    })

    it('returns error object when gh CLI fails', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
        cb(new Error('gh not found'))
      })
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('github:listRepos')!
      const result = await handler(null)
      expect(result).toEqual({ error: 'GitHub CLI not available. Install and authenticate with `gh auth login`.' })
    })

    it('returns parse error object when gh output is malformed JSON', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null, result: { stdout: string }) => void) => {
        cb(null, { stdout: '{not-json' })
      })
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('github:listRepos')!
      const result = await handler(null)
      expect(result).toEqual({ error: 'Failed to parse GitHub CLI response.' })
    })
  })

  describe('github:listBranches', () => {
    it('returns branch list on success', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null, result: { stdout: string }) => void) => {
        cb(null, { stdout: 'main\ndevelop\n' })
      })
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('github:listBranches')!
      const result = await handler(null, { owner: 'org', repo: 'repo' })
      expect(result).toEqual(['main', 'develop'])
    })

    it('returns error object when gh CLI fails', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
        cb(new Error('gh api failed'))
      })
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('github:listBranches')!
      const result = await handler(null, { owner: 'org', repo: 'repo' })
      expect(result).toEqual({ error: 'Could not fetch branches from GitHub.' })
    })

    it('returns error object when input is missing owner or repo', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('github:listBranches')!
      await expect(handler(null, { owner: 'org' })).resolves.toEqual({ error: 'input must have string owner and repo fields' })
      await expect(handler(null, null)).resolves.toEqual({ error: 'input must have string owner and repo fields' })
    })
  })

  describe('run:submit', () => {
    const mockCredentialResolver = {
      getApiKey: vi.fn(),
      getAuthStatus: vi.fn()
    }
    const mockAuthStorage = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    }

    beforeEach(() => {
      mockCreateRun.mockReset()
      mockCreateAgentRunner.mockReset()
      mockCredentialResolver.getApiKey.mockReset()
      mockCredentialResolver.getAuthStatus.mockReset()
      mockSetRunDraft.mockReset()
    })

    it('creates a run and starts an agent runner', async () => {
      const mockRunner = { execute: vi.fn().mockResolvedValue(undefined), abort: vi.fn() }
      mockCredentialResolver.getApiKey.mockResolvedValue('sk-test')
      mockCreateRun.mockReturnValue({ id: 'run-1', sessionId: 'sess-1', prompt: 'hello', status: 'queued', model: 'claude-sonnet-4-6-20250514', provider: 'anthropic', createdAt: '2026-03-01T00:00:00.000Z', messages: [] })
      mockCreateAgentRunner.mockReturnValue(mockRunner)

      const store = createMockStore()
      registerIpcHandlers(store, { credentialResolver: mockCredentialResolver })
      const handler = getHandlersByChannel().get('run:submit')!

      const mockEvent = { sender: { send: vi.fn() } }
      const result = await handler(mockEvent, { sessionId: 'sess-1', prompt: 'hello', model: 'claude-sonnet-4-6-20250514', provider: 'anthropic' })

      expect(result).toEqual({ runId: 'run-1' })
      expect(mockCreateRun).toHaveBeenCalledWith(store, { sessionId: 'sess-1', prompt: 'hello', model: 'claude-sonnet-4-6-20250514', provider: 'anthropic' })
      expect(mockCreateAgentRunner).toHaveBeenCalledWith(expect.objectContaining({
        model: 'claude-sonnet-4-6-20250514',
        provider: 'anthropic',
        apiKey: 'sk-test',
        systemPrompt: expect.any(String)
      }))
      expect(mockRunner.execute).toHaveBeenCalledWith('hello')
    })

    it('onEvent callback forwards events and updates run state', async () => {
      const mockRunner = { execute: vi.fn().mockResolvedValue(undefined), abort: vi.fn() }
      mockCredentialResolver.getApiKey.mockResolvedValue('sk-test')
      mockCreateRun.mockReturnValue({ id: 'run-ev-1', sessionId: 'sess-1', prompt: 'hello', status: 'queued', model: 'm', provider: 'p', createdAt: '2026-03-01T00:00:00.000Z', messages: [] })
      mockCreateAgentRunner.mockReturnValue(mockRunner)

      const store = createMockStore()
      registerIpcHandlers(store, { credentialResolver: mockCredentialResolver })
      const handler = getHandlersByChannel().get('run:submit')!

      const mockSend = vi.fn()
      const mockEvent = { sender: { send: mockSend } }
      await handler(mockEvent, { sessionId: 'sess-1', prompt: 'hello', model: 'm', provider: 'p' })

      // Extract the onEvent callback passed to createAgentRunner
      const onEvent = mockCreateAgentRunner.mock.calls[0][0].onEvent as (event: Record<string, unknown>) => void

      // Test pending -> running transition
      onEvent({ type: 'run_state_changed', runState: 'pending' })
      expect(mockUpdateRunStatus).toHaveBeenCalledWith(store, 'run-ev-1', 'running')
      expect(mockSend).toHaveBeenCalledWith('run:event', expect.objectContaining({ type: 'run_state_changed', runState: 'pending' }))

      // Test message_appended
      onEvent({
        type: 'message_appended',
        message: { id: 'a1', role: 'agent', content: 'response text', createdAt: '2026-03-01T00:00:01Z' }
      })
      expect(mockAppendRunMessage).toHaveBeenCalledWith(store, 'run-ev-1', {
        id: 'a1',
        role: 'agent',
        content: 'response text',
        createdAt: '2026-03-01T00:00:01Z'
      })
      expect(mockSetRunDraft).toHaveBeenCalledWith(store, 'run-ev-1', {
        runId: 'run-ev-1',
        generatedAt: '2026-03-01T00:00:01Z',
        content: 'response text'
      })

      // Test idle -> completed transition (also removes from activeRunners)
      onEvent({ type: 'run_state_changed', runState: 'idle' })
      expect(mockUpdateRunStatus).toHaveBeenCalledWith(store, 'run-ev-1', 'completed')

      // Verify runner was removed by checking abort returns false
      const abortHandler = getHandlersByChannel().get('run:abort')!
      const abortResult = await abortHandler(null, { runId: 'run-ev-1' })
      expect(abortResult).toBe(false)
    })

    it('onEvent callback updates run status to failed on error state change', async () => {
      const mockRunner = { execute: vi.fn().mockResolvedValue(undefined), abort: vi.fn() }
      mockCredentialResolver.getApiKey.mockResolvedValue('sk-test')
      mockCreateRun.mockReturnValue({ id: 'run-err-1', sessionId: 'sess-1', prompt: 'hello', status: 'queued', model: 'm', provider: 'p', createdAt: '2026-03-01T00:00:00.000Z', messages: [] })
      mockCreateAgentRunner.mockReturnValue(mockRunner)

      const store = createMockStore()
      registerIpcHandlers(store, { credentialResolver: mockCredentialResolver })
      const handler = getHandlersByChannel().get('run:submit')!

      const mockSend = vi.fn()
      const mockEvent = { sender: { send: mockSend } }
      await handler(mockEvent, { sessionId: 'sess-1', prompt: 'hello', model: 'm', provider: 'p' })

      const onEvent = mockCreateAgentRunner.mock.calls[0][0].onEvent as (event: Record<string, unknown>) => void

      onEvent({ type: 'run_state_changed', runState: 'error', errorMessage: 'API rate limit' })

      expect(mockUpdateRunStatus).toHaveBeenCalledWith(store, 'run-err-1', 'failed', 'API rate limit')
      expect(mockSend).toHaveBeenCalledWith('run:event', expect.objectContaining({ type: 'run_state_changed', runState: 'error' }))

      const abortHandler = getHandlersByChannel().get('run:abort')!
      const abortResult = await abortHandler(null, { runId: 'run-err-1' })
      expect(abortResult).toBe(false)
    })

    it('aborts orphaned runner and marks run failed when sender is destroyed', async () => {
      const mockRunner = { execute: vi.fn().mockResolvedValue(undefined), abort: vi.fn() }
      mockCredentialResolver.getApiKey.mockResolvedValue('sk-test')
      mockCreateRun.mockReturnValue({ id: 'run-ev-2', sessionId: 'sess-1', prompt: 'hello', status: 'queued', model: 'm', provider: 'p', createdAt: '2026-03-01T00:00:00.000Z', messages: [] })
      mockCreateAgentRunner.mockReturnValue(mockRunner)

      const store = createMockStore()
      registerIpcHandlers(store, { credentialResolver: mockCredentialResolver })
      const handler = getHandlersByChannel().get('run:submit')!

      const mockSend = vi.fn().mockImplementation(() => {
        throw new Error('sender destroyed')
      })
      const mockEvent = { sender: { send: mockSend, isDestroyed: () => true } }
      await handler(mockEvent, { sessionId: 'sess-1', prompt: 'hello', model: 'm', provider: 'p' })

      const onEvent = mockCreateAgentRunner.mock.calls[0][0].onEvent as (event: Record<string, unknown>) => void

      expect(() => {
        onEvent({ type: 'run_state_changed', runState: 'error', errorMessage: 'API rate limit' })
      }).not.toThrow()

      expect(mockRunner.abort).toHaveBeenCalledTimes(1)
      expect(mockUpdateRunStatus).toHaveBeenCalledWith(store, 'run-ev-2', 'failed', 'Renderer window closed')
    })

    it('logs error when sender.send throws but sender is not destroyed', async () => {
      const mockRunner = { execute: vi.fn().mockResolvedValue(undefined), abort: vi.fn() }
      mockCredentialResolver.getApiKey.mockResolvedValue('sk-test')
      mockCreateRun.mockReturnValue({ id: 'run-ev-3', sessionId: 'sess-1', prompt: 'hello', status: 'queued', model: 'm', provider: 'p', createdAt: '2026-03-01T00:00:00.000Z', messages: [] })
      mockCreateAgentRunner.mockReturnValue(mockRunner)

      const store = createMockStore()
      registerIpcHandlers(store, { credentialResolver: mockCredentialResolver })
      const handler = getHandlersByChannel().get('run:submit')!

      const mockSend = vi.fn().mockImplementation(() => {
        throw new Error('serialization error')
      })
      const mockEvent = { sender: { send: mockSend, isDestroyed: () => false } }
      await handler(mockEvent, { sessionId: 'sess-1', prompt: 'hello', model: 'm', provider: 'p' })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onEvent = mockCreateAgentRunner.mock.calls[0][0].onEvent as (event: Record<string, unknown>) => void

      onEvent({ type: 'run_state_changed', runState: 'pending' })

      expect(consoleSpy).toHaveBeenCalledWith(
        '[IPC] Failed to send run event to renderer:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })

    it('returns error when no credentials available', async () => {
      mockCredentialResolver.getApiKey.mockResolvedValue(undefined)

      registerIpcHandlers(createMockStore(), { credentialResolver: mockCredentialResolver })
      const handler = getHandlersByChannel().get('run:submit')!
      const mockEvent = { sender: { send: vi.fn() } }

      await expect(handler(mockEvent, { sessionId: 'sess-1', prompt: 'hello', model: 'gpt-4.1-2025-04-14', provider: 'openai' }))
        .rejects.toThrow('No credentials available for provider: openai')
    })

    it('rejects when no credential resolver is configured', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('run:submit')!
      const mockEvent = { sender: { send: vi.fn() } }

      await expect(handler(mockEvent, { sessionId: 'sess-1', prompt: 'hi', model: 'm', provider: 'p' }))
        .rejects.toThrow('No credential resolver configured')
    })

    it('rejects malformed input', async () => {
      registerIpcHandlers(createMockStore(), { credentialResolver: mockCredentialResolver })
      const handler = getHandlersByChannel().get('run:submit')!
      const mockEvent = { sender: { send: vi.fn() } }

      await expect(handler(mockEvent, null)).rejects.toThrow('run:submit input must be an object')
      await expect(handler(mockEvent, { sessionId: 123 })).rejects.toThrow('run:submit requires sessionId, prompt, model, provider strings')
    })

    it('cleans up activeRunners when execute rejects after fire-and-forget', async () => {
      let executeReject: (reason: Error) => void = () => {}
      const executePromise = new Promise<void>((_resolve, reject) => {
        executeReject = reject
      })
      const mockRunner = { execute: vi.fn().mockReturnValue(executePromise), abort: vi.fn() }
      mockCredentialResolver.getApiKey.mockResolvedValue('sk-test')
      mockCreateRun.mockReturnValue({ id: 'run-cleanup-1', sessionId: 'sess-1', prompt: 'hello', status: 'queued', model: 'm', provider: 'p', createdAt: '2026-03-01T00:00:00.000Z', messages: [] })
      mockCreateAgentRunner.mockReturnValue(mockRunner)

      const store = createMockStore()
      registerIpcHandlers(store, { credentialResolver: mockCredentialResolver })
      const handlers = getHandlersByChannel()
      const submitHandler = handlers.get('run:submit')!
      const abortHandler = handlers.get('run:abort')!
      const mockEvent = { sender: { send: vi.fn() } }

      await submitHandler(mockEvent, { sessionId: 'sess-1', prompt: 'hello', model: 'm', provider: 'p' })

      // Runner is active at this point
      const beforeAbort = await abortHandler(null, { runId: 'run-cleanup-1' })
      // Re-register to get fresh activeRunners for a clean test
      // Instead, just reject the execute and check that abort returns false after cleanup
      mockCreateRun.mockReturnValue({ id: 'run-cleanup-2', sessionId: 'sess-1', prompt: 'hello', status: 'queued', model: 'm', provider: 'p', createdAt: '2026-03-01T00:00:00.000Z', messages: [] })
      const executeRejectPromise = new Promise<void>((_resolve, reject) => {
        executeReject = reject
      })
      const mockRunner2 = { execute: vi.fn().mockReturnValue(executeRejectPromise), abort: vi.fn() }
      mockCreateAgentRunner.mockReturnValue(mockRunner2)

      registerIpcHandlers(store, { credentialResolver: mockCredentialResolver })
      const handlers2 = getHandlersByChannel()
      const submitHandler2 = handlers2.get('run:submit')!
      const abortHandler2 = handlers2.get('run:abort')!

      await submitHandler2(mockEvent, { sessionId: 'sess-1', prompt: 'hello', model: 'm', provider: 'p' })

      // Reject the execute promise to trigger the catch cleanup
      executeReject(new Error('agent crashed'))

      // Allow microtask to process
      await new Promise((resolve) => setTimeout(resolve, 10))

      // After cleanup, abort should return false since runner was removed
      const afterAbort = await abortHandler2(null, { runId: 'run-cleanup-2' })
      expect(afterAbort).toBe(false)
    })
  })

  describe('run:list', () => {
    beforeEach(() => {
      mockGetRunsForSession.mockReset()
    })

    it('returns runs for a session', async () => {
      const runs = [
        { id: 'run-1', sessionId: 'sess-1', prompt: 'hi', status: 'completed', model: 'm', provider: 'p', createdAt: '2026-03-01T00:00:00.000Z', messages: [] }
      ]
      mockGetRunsForSession.mockReturnValue(runs)

      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('run:list')!
      const result = await handler(null, { sessionId: 'sess-1' })

      expect(result).toEqual(runs)
      expect(mockGetRunsForSession).toHaveBeenCalledWith(expect.anything(), 'sess-1')
    })

    it('rejects malformed input', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('run:list')!
      await expect(handler(null, null)).rejects.toThrow('run:list requires a string sessionId')
      await expect(handler(null, { sessionId: 123 })).rejects.toThrow('run:list requires a string sessionId')
    })
  })

  describe('run:markDraftApplied', () => {
    beforeEach(() => {
      mockMarkRunDraftApplied.mockReset()
    })

    it('stamps run draft-applied timestamp through main-process handler', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('run:markDraftApplied')!

      const result = await handler(null, { runId: 'run-1' })

      expect(result).toEqual({ ok: true })
      expect(mockMarkRunDraftApplied).toHaveBeenCalledTimes(1)
      expect(mockMarkRunDraftApplied).toHaveBeenCalledWith(
        expect.anything(),
        'run-1',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      )
    })

    it('rejects malformed input', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('run:markDraftApplied')!

      await expect(handler(null, null)).rejects.toThrow(
        'run:markDraftApplied requires a string runId'
      )
      await expect(handler(null, { runId: 123 })).rejects.toThrow(
        'run:markDraftApplied requires a string runId'
      )
    })
  })

  describe('run:abort', () => {
    const mockCredentialResolver = {
      getApiKey: vi.fn(),
      getAuthStatus: vi.fn()
    }

    beforeEach(() => {
      mockCreateRun.mockReset()
      mockCreateAgentRunner.mockReset()
      mockCredentialResolver.getApiKey.mockReset()
    })

    it('aborts an active runner', async () => {
      const mockRunner = { execute: vi.fn().mockResolvedValue(undefined), abort: vi.fn() }
      mockCredentialResolver.getApiKey.mockResolvedValue('sk-test')
      mockCreateRun.mockReturnValue({ id: 'run-abort-1', sessionId: 'sess-1', prompt: 'hello', status: 'queued', model: 'm', provider: 'p', createdAt: '2026-03-01T00:00:00.000Z', messages: [] })
      mockCreateAgentRunner.mockReturnValue(mockRunner)

      const store = createMockStore()
      registerIpcHandlers(store, { credentialResolver: mockCredentialResolver })
      const handlers = getHandlersByChannel()

      // Submit a run first to register the runner
      const submitHandler = handlers.get('run:submit')!
      const mockEvent = { sender: { send: vi.fn() } }
      await submitHandler(mockEvent, { sessionId: 'sess-1', prompt: 'hello', model: 'm', provider: 'p' })

      // Now abort it
      const abortHandler = handlers.get('run:abort')!
      const result = await abortHandler(null, { runId: 'run-abort-1' })

      expect(result).toBe(true)
      expect(mockRunner.abort).toHaveBeenCalled()
      expect(mockUpdateRunStatus).toHaveBeenCalledWith(store, 'run-abort-1', 'failed', 'Aborted by user')
    })

    it('returns false for unknown runId', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('run:abort')!
      const result = await handler(null, { runId: 'nonexistent' })
      expect(result).toBe(false)
    })

    it('rejects malformed input', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('run:abort')!
      await expect(handler(null, null)).rejects.toThrow('run:abort requires a string runId')
    })
  })

  describe('auth:status', () => {
    const mockCredentialResolver = {
      getApiKey: vi.fn(),
      getAuthStatus: vi.fn()
    }

    beforeEach(() => {
      mockCredentialResolver.getAuthStatus.mockReset()
    })

    it('returns credential status for a provider', async () => {
      mockCredentialResolver.getAuthStatus.mockResolvedValue('api_key')

      registerIpcHandlers(createMockStore(), { credentialResolver: mockCredentialResolver })
      const handler = getHandlersByChannel().get('auth:status')!
      const result = await handler(null, { provider: 'anthropic' })

      expect(result).toBe('api_key')
      expect(mockCredentialResolver.getAuthStatus).toHaveBeenCalledWith('anthropic')
    })

    it('rejects when no credential resolver configured', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('auth:status')!
      await expect(handler(null, { provider: 'anthropic' })).rejects.toThrow('No credential resolver configured')
    })

    it('rejects malformed input', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('auth:status')!
      await expect(handler(null, null)).rejects.toThrow('auth:status requires a string provider')
    })
  })

  describe('auth:login', () => {
    it('returns false (stub) for valid provider input', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('auth:login')!
      const result = await handler(null, { provider: 'anthropic' })
      expect(result).toBe(false)
    })

    it('rejects malformed input', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('auth:login')!
      await expect(handler(null, null)).rejects.toThrow('auth:login requires a string provider')
      await expect(handler(null, { provider: 123 })).rejects.toThrow('auth:login requires a string provider')
    })
  })

  describe('auth:logout', () => {
    const mockAuthStorage = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    }

    beforeEach(() => {
      mockAuthStorage.remove.mockReset()
    })

    it('removes credentials for a provider', async () => {
      mockAuthStorage.remove.mockResolvedValue(undefined)

      registerIpcHandlers(createMockStore(), { authStorage: mockAuthStorage })
      const handler = getHandlersByChannel().get('auth:logout')!
      const result = await handler(null, { provider: 'anthropic' })

      expect(result).toBe(true)
      expect(mockAuthStorage.remove).toHaveBeenCalledWith('anthropic')
    })

    it('returns false when no auth storage configured', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('auth:logout')!
      const result = await handler(null, { provider: 'anthropic' })
      expect(result).toBe(false)
    })

    it('rejects malformed input', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('auth:logout')!
      await expect(handler(null, null)).rejects.toThrow('auth:logout requires a string provider')
    })
  })

  describe('model:list', () => {
    const mockCredentialResolver = {
      getApiKey: vi.fn(),
      getAuthStatus: vi.fn()
    }

    beforeEach(() => {
      mockCredentialResolver.getAuthStatus.mockReset()
    })

    it('returns supported models with auth status', async () => {
      mockCredentialResolver.getAuthStatus
        .mockResolvedValueOnce('none')     // openai-codex
        .mockResolvedValueOnce('api_key')  // anthropic (first model)
        .mockResolvedValueOnce('api_key')  // anthropic (second model)
        .mockResolvedValueOnce('none')     // openai (first model)
        .mockResolvedValueOnce('none')     // openai (second model)

      registerIpcHandlers(createMockStore(), { credentialResolver: mockCredentialResolver })
      const handler = getHandlersByChannel().get('model:list')!
      const result = await handler(null) as Array<{ provider: string; modelId: string; name: string; authStatus: string }>

      expect(result).toHaveLength(5)
      expect(result[0]).toMatchObject({ provider: 'openai-codex', authStatus: 'none' })
      expect(result[1]).toMatchObject({ provider: 'anthropic', authStatus: 'api_key' })
      expect(result[3]).toMatchObject({ provider: 'openai', authStatus: 'none' })
    })

    it('returns all models with none status when no credential resolver', async () => {
      registerIpcHandlers(createMockStore())
      const handler = getHandlersByChannel().get('model:list')!
      const result = await handler(null) as Array<{ authStatus: string }>

      expect(result.length).toBeGreaterThan(0)
      expect(result.every(m => m.authStatus === 'none')).toBe(true)
    })
  })
})
