// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  SPACE_STATUSES,
  ORCHESTRATION_MODES,
  WORKSPACE_MODES,
  PROVISIONING_METHODS,
  createDefaultAppState
} from '../../../../src/shared/types/space'

import type {
  SpaceRecord,
  SessionRecord,
  CreateSpaceInput,
  CreateSessionInput,
  AppState
} from '../../../../src/shared/types/space'

describe('SPACE_STATUSES', () => {
  it('contains active, idle, and archived', () => {
    expect(SPACE_STATUSES).toEqual(['active', 'idle', 'archived'])
  })
})

describe('ORCHESTRATION_MODES', () => {
  it('contains team and single', () => {
    expect(ORCHESTRATION_MODES).toEqual(['team', 'single'])
  })
})

describe('WORKSPACE_MODES', () => {
  it('contains managed and external', () => {
    expect(WORKSPACE_MODES).toEqual(['managed', 'external'])
  })
})

describe('PROVISIONING_METHODS', () => {
  it('contains copy-local, clone-github, and new-repo', () => {
    expect(PROVISIONING_METHODS).toEqual(['copy-local', 'clone-github', 'new-repo'])
  })
})

describe('createDefaultAppState', () => {
  it('returns empty state with null selections', () => {
    const state = createDefaultAppState()

    expect(state.spaces).toEqual({})
    expect(state.sessions).toEqual({})
    expect(state.activeSpaceId).toBeNull()
    expect(state.activeSessionId).toBeNull()
  })

  it('returns a new object on each call', () => {
    const a = createDefaultAppState()
    const b = createDefaultAppState()
    expect(a).not.toBe(b)
    expect(a.spaces).not.toBe(b.spaces)
    expect(a.sessions).not.toBe(b.sessions)
  })
})

describe('SpaceRecord type', () => {
  it('conforms to expected shape', () => {
    const space: SpaceRecord = {
      id: 'space-1',
      name: 'My Space',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/projects/repo',
      branch: 'main',
      workspaceMode: 'external',
      orchestrationMode: 'team',
      createdAt: '2026-01-01T00:00:00Z',
      status: 'active'
    }

    expect(space.id).toBe('space-1')
    expect(space.name).toBe('My Space')
    expect(space.repoUrl).toBe('https://github.com/user/repo')
    expect(space.rootPath).toBe('/Users/me/projects/repo')
    expect(space.branch).toBe('main')
    expect(space.workspaceMode).toBe('external')
    expect(space.orchestrationMode).toBe('team')
    expect(space.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(space.status).toBe('active')
  })

  it('status values match SPACE_STATUSES constant', () => {
    const statuses: SpaceRecord['status'][] = [...SPACE_STATUSES]
    expect(statuses).toEqual(SPACE_STATUSES)
  })

  it('orchestrationMode values match ORCHESTRATION_MODES constant', () => {
    const modes: SpaceRecord['orchestrationMode'][] = [...ORCHESTRATION_MODES]
    expect(modes).toEqual(ORCHESTRATION_MODES)
  })
})

describe('SessionRecord type', () => {
  it('conforms to expected shape', () => {
    const session: SessionRecord = {
      id: 'session-1',
      spaceId: 'space-1',
      label: 'Initial session',
      createdAt: '2026-01-01T00:00:00Z'
    }

    expect(session.id).toBe('session-1')
    expect(session.spaceId).toBe('space-1')
    expect(session.label).toBe('Initial session')
    expect(session.createdAt).toBe('2026-01-01T00:00:00Z')
  })
})

describe('CreateSpaceInput type', () => {
  it('supports managed provisioning payloads for copy-local, clone-github, and new-repo', () => {
    const copyLocal: CreateSpaceInput = {
      workspaceMode: 'managed',
      provisioningMethod: 'copy-local',
      sourceLocalPath: '/Users/me/dev/repo',
      repoUrl: 'https://github.com/org/repo',
      branch: 'main'
    }
    const cloneGitHub: CreateSpaceInput = {
      workspaceMode: 'managed',
      provisioningMethod: 'clone-github',
      sourceRemoteUrl: 'https://github.com/org/repo.git',
      repoUrl: 'https://github.com/org/repo',
      branch: 'main'
    }
    const newRepo: CreateSpaceInput = {
      workspaceMode: 'managed',
      provisioningMethod: 'new-repo',
      newRepoParentDir: '/Users/me/dev',
      newRepoFolderName: 'new-project',
      repoUrl: '',
      branch: 'main'
    }

    expect(copyLocal.provisioningMethod).toBe('copy-local')
    expect(cloneGitHub.provisioningMethod).toBe('clone-github')
    expect(newRepo.provisioningMethod).toBe('new-repo')
  })

  it('supports external mode payloads without managed provisioning method', () => {
    const input: CreateSpaceInput = {
      name: 'External Space',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/projects/repo',
      branch: 'main',
      workspaceMode: 'external',
      orchestrationMode: 'team'
    }

    expect(input.workspaceMode).toBe('external')
    expect(input.rootPath).toBe('/Users/me/projects/repo')
    expect(input.orchestrationMode).toBe('team')
  })
})

describe('CreateSessionInput type', () => {
  it('contains IPC payload fields without id or createdAt', () => {
    const input: CreateSessionInput = {
      spaceId: 'space-1',
      label: 'New session'
    }

    expect(input.spaceId).toBe('space-1')
    expect(input.label).toBe('New session')
    expect(Object.keys(input)).toHaveLength(2)
  })
})

describe('AppState type', () => {
  it('holds SpaceRecord and SessionRecord records with active selections', () => {
    const space: SpaceRecord = {
      id: 'space-1',
      name: 'Test',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/path',
      branch: 'main',
      workspaceMode: 'external',
      orchestrationMode: 'team',
      createdAt: '2026-01-01T00:00:00Z',
      status: 'active'
    }

    const session: SessionRecord = {
      id: 'session-1',
      spaceId: 'space-1',
      label: 'Session',
      createdAt: '2026-01-01T00:00:00Z'
    }

    const state: AppState = {
      spaces: { 'space-1': space },
      sessions: { 'session-1': session },
      activeSpaceId: 'space-1',
      activeSessionId: 'session-1'
    }

    expect(Object.keys(state.spaces)).toHaveLength(1)
    expect(Object.keys(state.sessions)).toHaveLength(1)
    expect(state.activeSpaceId).toBe('space-1')
    expect(state.activeSessionId).toBe('session-1')
  })
})
