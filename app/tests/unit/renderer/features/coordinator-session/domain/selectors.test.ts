import { describe, expect, it } from 'vitest'

import { createDefaultAppState } from '@shared/types/space'
import type { CoordinatorContractState } from '../../../../../../src/renderer/features/coordinator-session/domain'
import {
  selectCoordinatorActiveRunContextChips,
  selectCoordinatorActiveRunContextSummary,
  selectCoordinatorAgentList,
  selectCoordinatorContextItems,
  selectCoordinatorPromptPreview
} from '../../../../../../src/renderer/features/coordinator-session/domain'

const state: CoordinatorContractState = {
  ...createDefaultAppState(),
  agentRoster: {
    'agent-2': {
      id: 'agent-2',
      sessionId: 'session-1',
      name: 'Notes Specialist',
      role: 'Synthesizes notes',
      kind: 'specialist',
      status: 'queued',
      avatarColor: '#334155',
      sortOrder: 2,
      createdAt: '2026-03-06T00:00:02.000Z',
      updatedAt: '2026-03-06T00:00:03.000Z'
    },
    'agent-1': {
      id: 'agent-1',
      sessionId: 'session-1',
      name: 'MVP Planning Coordinator',
      role: 'Coordinates MVP planning tasks',
      kind: 'coordinator',
      status: 'idle',
      avatarColor: '#0f766e',
      sortOrder: 1,
      createdAt: '2026-03-06T00:00:01.000Z',
      updatedAt: '2026-03-06T00:00:02.000Z'
    }
  },
  contextResources: {
    'resource-spec': {
      id: 'resource-spec',
      sessionId: 'session-1',
      kind: 'spec',
      label: 'Spec',
      sortOrder: 0,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z'
    }
  },
  runs: {
    'run-older': {
      id: 'run-older',
      sessionId: 'session-1',
      prompt: 'Earlier prompt',
      status: 'completed',
      model: 'gpt-5.3-codex',
      provider: 'openai-codex',
      createdAt: '2026-03-06T00:00:00.000Z',
      contextReferences: [],
      messages: []
    },
    'run-latest': {
      id: 'run-latest',
      sessionId: 'session-1',
      prompt:
        'I would like to build the following product for which I have created an overview document that should guide the implementation and rollout for the team.',
      status: 'completed',
      model: 'gpt-5.3-codex',
      provider: 'openai-codex',
      createdAt: '2026-03-06T00:10:00.000Z',
      contextReferences: [
        {
          id: 'ctx-1',
          kind: 'pasted-text',
          label: '# Kata Cloud (Kata V2)',
          excerpt: '# Kata Cloud (Kata V2)',
          lineCount: 205,
          sortOrder: 0,
          capturedAt: '2026-03-06T00:10:01.000Z'
        },
        {
          id: 'ctx-2',
          kind: 'resource',
          label: '## Context...',
          resourceId: 'resource-spec',
          sortOrder: 1,
          capturedAt: '2026-03-06T00:10:02.000Z'
        }
      ],
      messages: []
    }
  }
}

describe('coordinator-session domain selectors', () => {
  it('derives coordinator prompt preview from the latest run', () => {
    expect(selectCoordinatorPromptPreview(state, 'session-1')).toBe(
      'I would like to build the following product for which I have created an overview...'
    )
  })

  it('returns coordinator agents in sort order', () => {
    expect(selectCoordinatorAgentList(state, 'session-1').map((agent) => agent.name)).toEqual([
      'MVP Planning Coordinator',
      'Notes Specialist'
    ])
  })

  it('returns Spec as a context item for a seeded session', () => {
    expect(selectCoordinatorContextItems(state, 'session-1')).toEqual([
      expect.objectContaining({ label: 'Spec', kind: 'spec' })
    ])
  })

  it('returns run context chips in sortOrder order', () => {
    expect(selectCoordinatorActiveRunContextChips(state, 'session-1').map((chip) => chip.label)).toEqual([
      '# Kata Cloud (Kata V2)',
      '## Context...'
    ])
  })

  it('builds the compact run context summary from references', () => {
    expect(selectCoordinatorActiveRunContextSummary(state, 'session-1')).toEqual({
      referenceCount: 2,
      pastedLineCount: 205,
      labels: ['# Kata Cloud (Kata V2)', '## Context...']
    })
  })

  it('returns total empty values when no matching run or session data exists', () => {
    expect(selectCoordinatorPromptPreview(state, 'missing-session')).toBeNull()
    expect(selectCoordinatorAgentList(state, 'missing-session')).toEqual([])
    expect(selectCoordinatorContextItems(state, 'missing-session')).toEqual([])
    expect(selectCoordinatorActiveRunContextChips(state, 'missing-session')).toEqual([])
    expect(selectCoordinatorActiveRunContextSummary(state, 'missing-session')).toBeNull()
  })
})
