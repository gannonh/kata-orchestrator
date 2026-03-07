// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  SPACE_STATUSES,
  ORCHESTRATION_MODES,
  WORKSPACE_MODES,
  PROVISIONING_METHODS,
  SESSION_CONTEXT_RESOURCE_KINDS,
  SESSION_AGENT_STATUSES,
  SESSION_AGENT_KINDS,
  createDefaultAppState
} from '../../../../src/shared/types/space'
import type { LatestRunDraft, PersistedSpecDocument } from '../../../../src/shared/types/spec-document'
import type { RunRecord } from '../../../../src/shared/types/run'

import type {
  SpaceRecord,
  SessionRecord,
  SessionAgentRecord,
  SessionContextResourceRecord,
  CreateSpaceInput,
  CreateSessionInput,
  AppState,
  OrchestrationMode
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

describe('SESSION_AGENT_STATUSES', () => {
  it('contains lifecycle statuses used by coordinator + wave + completion surfaces', () => {
    expect(SESSION_AGENT_STATUSES).toEqual([
      'idle',
      'queued',
      'delegating',
      'running',
      'blocked',
      'completed',
      'failed'
    ])
  })
})

describe('SESSION_AGENT_KINDS', () => {
  it('contains system, coordinator, and specialist', () => {
    expect(SESSION_AGENT_KINDS).toEqual(['system', 'coordinator', 'specialist'])
  })
})

describe('SESSION_CONTEXT_RESOURCE_KINDS', () => {
  it('contains spec, note, workspace-file, and manual', () => {
    expect(SESSION_CONTEXT_RESOURCE_KINDS).toEqual(['spec', 'note', 'workspace-file', 'manual'])
  })
})

describe('createDefaultAppState', () => {
  it('returns empty state with null selections and empty records', () => {
    const state = createDefaultAppState()

    expect(state.spaces).toEqual({})
    expect(state.sessions).toEqual({})
    expect(state.runs).toEqual({})
    expect(state.agentRoster).toEqual({})
    expect(state.specDocuments).toEqual({})
    expect(state.contextResources).toEqual({})
    expect(state.activeSpaceId).toBeNull()
    expect(state.activeSessionId).toBeNull()
  })

  it('returns a new object on each call', () => {
    const a = createDefaultAppState()
    const b = createDefaultAppState()
    expect(a).not.toBe(b)
    expect(a.spaces).not.toBe(b.spaces)
    expect(a.sessions).not.toBe(b.sessions)
    expect(a.runs).not.toBe(b.runs)
    expect(a.agentRoster).not.toBe(b.agentRoster)
    expect(a.specDocuments).not.toBe(b.specDocuments)
    expect(a.contextResources).not.toBe(b.contextResources)
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

describe('SessionAgentRecord type', () => {
  it('allows optional wave/run metadata fields', () => {
    const agent: SessionAgentRecord = {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'Wave1 Verifier',
      role: 'Verifies wave outputs',
      kind: 'specialist',
      status: 'queued',
      avatarColor: '#0088cc',
      sortOrder: 2,
      activeRunId: 'run-1',
      waveId: 'wave-1',
      groupLabel: 'Wave 1 Coordinators',
      lastActivityAt: '2026-03-05T00:00:00.000Z',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z'
    }

    expect(agent.status).toBe('queued')
    expect(agent.activeRunId).toBe('run-1')
    expect(agent.waveId).toBe('wave-1')
    expect(agent.groupLabel).toBe('Wave 1 Coordinators')
    expect(agent.lastActivityAt).toBe('2026-03-05T00:00:00.000Z')
  })

  it('conforms to expected shape', () => {
    const agent: SessionAgentRecord = {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'Planner',
      role: 'Coordinates the session',
      kind: 'coordinator',
      status: 'running',
      avatarColor: '#0088cc',
      delegatedBy: 'agent-0',
      currentTask: 'Break down the next step',
      sortOrder: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:05:00Z'
    }

    expect(agent.id).toBe('agent-1')
    expect(agent.sessionId).toBe('session-1')
    expect(agent.name).toBe('Planner')
    expect(agent.role).toBe('Coordinates the session')
    expect(agent.kind).toBe('coordinator')
    expect(agent.status).toBe('running')
    expect(agent.avatarColor).toBe('#0088cc')
    expect(agent.delegatedBy).toBe('agent-0')
    expect(agent.currentTask).toBe('Break down the next step')
    expect(agent.sortOrder).toBe(1)
    expect(agent.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(agent.updatedAt).toBe('2026-01-01T00:05:00Z')
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
    const input: Extract<CreateSpaceInput, { workspaceMode: 'external' }> = {
      repoUrl: 'https://github.com/user/repo',
      rootPath: '/Users/me/projects/repo',
      branch: 'main',
      workspaceMode: 'external',
      orchestrationMode: 'team'
    }

    expect(input.workspaceMode).toBe('external')
    expect(input.rootPath).toBe('/Users/me/projects/repo')
    expect(input.orchestrationMode as OrchestrationMode).toBe('team')
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
  it('holds typed records and active selections', () => {
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

    const agent: SessionAgentRecord = {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'Planner',
      role: 'Coordinates the session',
      kind: 'coordinator',
      status: 'idle',
      avatarColor: '#0088cc',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    }

    const contextResource: SessionContextResourceRecord = {
      id: 'resource-1',
      sessionId: 'session-1',
      kind: 'spec',
      label: 'Coordinator spec',
      sourcePath: '/tmp/spec.md',
      description: 'Pinned coordinator context',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    }

    const state: AppState = {
      spaces: { 'space-1': space },
      sessions: { 'session-1': session },
      runs: {},
      agentRoster: { 'agent-1': agent },
      specDocuments: {},
      contextResources: { 'resource-1': contextResource },
      activeSpaceId: 'space-1',
      activeSessionId: 'session-1'
    }

    expect(Object.keys(state.spaces)).toHaveLength(1)
    expect(Object.keys(state.sessions)).toHaveLength(1)
    expect(Object.keys(state.runs)).toHaveLength(0)
    expect(Object.keys(state.agentRoster)).toHaveLength(1)
    expect(Object.keys(state.specDocuments)).toHaveLength(0)
    expect(Object.keys(state.contextResources)).toHaveLength(1)
    expect(state.activeSpaceId).toBe('space-1')
    expect(state.activeSessionId).toBe('session-1')
  })
})

describe('KAT-161 persistence contracts', () => {
  it('supports session-scoped persisted spec documents', () => {
    const key = 'space-1:session-1'
    const specDocument: PersistedSpecDocument = {
      sourcePath: '/tmp/repo/.kata/sessions/session-1/notes/spec.md',
      raw: [
        '---',
        'status: drafting',
        'updatedAt: 2026-03-03T00:00:00.000Z',
        'sourceRunId: run-1',
        '---',
        '',
        '## Goal',
        'Ship persisted specs'
      ].join('\n'),
      markdown: ['## Goal', 'Ship persisted specs'].join('\n'),
      updatedAt: '2026-03-03T00:00:00.000Z',
      frontmatter: {
        status: 'drafting',
        updatedAt: '2026-03-03T00:00:00.000Z',
        sourceRunId: 'run-1'
      },
      diagnostics: [],
      lastGoodMarkdown: ['## Goal', 'Ship persisted specs'].join('\n'),
      lastGoodFrontmatter: {
        status: 'drafting',
        updatedAt: '2026-03-03T00:00:00.000Z',
        sourceRunId: 'run-1'
      },
      appliedRunId: 'run-1',
    }

    const state: AppState = {
      ...createDefaultAppState(),
      specDocuments: { [key]: specDocument }
    }

    expect(state.specDocuments[key]).toEqual(specDocument)
  })

  it('supports run draft metadata and draft-applied markers', () => {
    const draft: LatestRunDraft = {
      runId: 'run-1',
      generatedAt: '2026-03-03T00:00:00.000Z',
      content: '## Goal\nPersist this draft'
    }

    const run: RunRecord = {
      id: 'run-1',
      sessionId: 'session-1',
      prompt: 'Persist this run draft',
      status: 'completed',
      model: 'gpt',
      provider: 'openai',
      createdAt: '2026-03-03T00:00:00.000Z',
      messages: [],
      draft,
      draftAppliedAt: '2026-03-03T00:01:00.000Z'
    }

    expect(run.draft?.runId).toBe('run-1')
    expect(run.draftAppliedAt).toBe('2026-03-03T00:01:00.000Z')
  })
})
