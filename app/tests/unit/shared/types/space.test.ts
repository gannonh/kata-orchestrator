// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  SPACE_STATUSES,
  ORCHESTRATION_MODES,
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
  it('contains plan, execute, and verify', () => {
    expect(ORCHESTRATION_MODES).toEqual(['plan', 'execute', 'verify'])
  })
})

describe('createDefaultAppState', () => {
  it('returns empty state with null selections', () => {
    const state = createDefaultAppState()

    expect(state.spaces).toEqual([])
    expect(state.sessions).toEqual([])
    expect(state.activeSpaceId).toBeNull()
    expect(state.activeSessionId).toBeNull()
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
      orchestrationMode: 'plan',
      createdAt: '2026-01-01T00:00:00Z',
      status: 'active'
    }

    expect(space.id).toBe('space-1')
    expect(space.name).toBe('My Space')
    expect(space.repoUrl).toBe('https://github.com/user/repo')
    expect(space.rootPath).toBe('/Users/me/projects/repo')
    expect(space.branch).toBe('main')
    expect(space.orchestrationMode).toBe('plan')
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
  it('contains required IPC payload fields without id, createdAt, or status', () => {
    const input: CreateSpaceInput = {
      name: 'New Space',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/projects/repo',
      branch: 'main'
    }

    expect(input.name).toBe('New Space')
    expect(input.repoUrl).toBe('https://github.com/user/repo')
    expect(input.rootPath).toBe('/Users/me/projects/repo')
    expect(input.branch).toBe('main')
  })

  it('accepts optional orchestrationMode', () => {
    const input: CreateSpaceInput = {
      name: 'New Space',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/projects/repo',
      branch: 'main',
      orchestrationMode: 'plan'
    }

    expect(input.orchestrationMode).toBe('plan')
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
  it('holds SpaceRecord and SessionRecord arrays with active selections', () => {
    const space: SpaceRecord = {
      id: 'space-1',
      name: 'Test',
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/path',
      branch: 'main',
      orchestrationMode: 'plan',
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
      spaces: [space],
      sessions: [session],
      activeSpaceId: 'space-1',
      activeSessionId: 'session-1'
    }

    expect(state.spaces).toHaveLength(1)
    expect(state.sessions).toHaveLength(1)
    expect(state.activeSpaceId).toBe('space-1')
    expect(state.activeSessionId).toBe('session-1')
  })
})
