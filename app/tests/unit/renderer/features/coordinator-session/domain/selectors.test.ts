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

  it('returns null when the latest run prompt is blank after trimming', () => {
    const blankPromptState: CoordinatorContractState = {
      ...state,
      runs: {
        'run-blank': {
          id: 'run-blank',
          sessionId: 'session-blank',
          prompt: '   \n   ',
          status: 'completed',
          model: 'gpt-5.3-codex',
          provider: 'openai-codex',
          createdAt: '2026-03-06T00:20:00.000Z',
          contextReferences: [],
          messages: []
        }
      }
    }

    expect(selectCoordinatorPromptPreview(blankPromptState, 'session-blank')).toBeNull()
  })

  it('returns the full prompt when it already fits on one line', () => {
    const shortPromptState: CoordinatorContractState = {
      ...state,
      runs: {
        'run-short': {
          id: 'run-short',
          sessionId: 'session-short',
          prompt: 'Short prompt',
          status: 'completed',
          model: 'gpt-5.3-codex',
          provider: 'openai-codex',
          createdAt: '2026-03-06T00:20:00.000Z',
          contextReferences: [],
          messages: []
        }
      }
    }

    expect(selectCoordinatorPromptPreview(shortPromptState, 'session-short')).toBe('Short prompt')
  })

  it('falls back to hard truncation when there is no safe word boundary', () => {
    const longToken = 'x'.repeat(120)
    const longTokenState: CoordinatorContractState = {
      ...state,
      runs: {
        'run-token': {
          id: 'run-token',
          sessionId: 'session-token',
          prompt: longToken,
          status: 'completed',
          model: 'gpt-5.3-codex',
          provider: 'openai-codex',
          createdAt: '2026-03-06T00:20:00.000Z',
          contextReferences: [],
          messages: []
        }
      }
    }

    expect(selectCoordinatorPromptPreview(longTokenState, 'session-token')).toBe(`${'x'.repeat(85)}...`)
  })

  it('uses run id as a deterministic tiebreaker when createdAt matches', () => {
    const tiedRunState: CoordinatorContractState = {
      ...state,
      runs: {
        'run-b': {
          id: 'run-b',
          sessionId: 'session-tie',
          prompt: 'Older by id',
          status: 'completed',
          model: 'gpt-5.3-codex',
          provider: 'openai-codex',
          createdAt: '2026-03-06T00:30:00.000Z',
          contextReferences: [],
          messages: []
        },
        'run-a': {
          id: 'run-a',
          sessionId: 'session-tie',
          prompt: 'Selected by id',
          status: 'completed',
          model: 'gpt-5.3-codex',
          provider: 'openai-codex',
          createdAt: '2026-03-06T00:30:00.000Z',
          contextReferences: [],
          messages: []
        }
      }
    }

    expect(selectCoordinatorPromptPreview(tiedRunState, 'session-tie')).toBe('Selected by id')
  })

  it('sorts context items deterministically when sortOrder matches', () => {
    const tiedContextState: CoordinatorContractState = {
      ...state,
      contextResources: {
        'resource-b': {
          id: 'resource-b',
          sessionId: 'session-context',
          kind: 'note',
          label: 'B',
          sortOrder: 0,
          createdAt: '2026-03-06T00:00:02.000Z',
          updatedAt: '2026-03-06T00:00:02.000Z'
        },
        'resource-a': {
          id: 'resource-a',
          sessionId: 'session-context',
          kind: 'spec',
          label: 'A',
          sortOrder: 0,
          createdAt: '2026-03-06T00:00:01.000Z',
          updatedAt: '2026-03-06T00:00:01.000Z'
        }
      }
    }

    expect(selectCoordinatorContextItems(tiedContextState, 'session-context').map((item) => item.id)).toEqual([
      'resource-a',
      'resource-b'
    ])
  })

  it('sorts agents deterministically by id when order and timestamp match', () => {
    const tiedAgentState: CoordinatorContractState = {
      ...state,
      agentRoster: {
        'agent-b': {
          id: 'agent-b',
          sessionId: 'session-agent-tie',
          name: 'Agent B',
          role: 'Role',
          kind: 'specialist',
          status: 'idle',
          avatarColor: '#111111',
          sortOrder: 0,
          createdAt: '2026-03-06T00:00:00.000Z',
          updatedAt: '2026-03-06T00:00:00.000Z'
        },
        'agent-a': {
          id: 'agent-a',
          sessionId: 'session-agent-tie',
          name: 'Agent A',
          role: 'Role',
          kind: 'specialist',
          status: 'idle',
          avatarColor: '#222222',
          sortOrder: 0,
          createdAt: '2026-03-06T00:00:00.000Z',
          updatedAt: '2026-03-06T00:00:00.000Z'
        }
      }
    }

    expect(selectCoordinatorAgentList(tiedAgentState, 'session-agent-tie').map((item) => item.id)).toEqual([
      'agent-a',
      'agent-b'
    ])
  })

  it('sorts run context chips deterministically by id when order and timestamp match', () => {
    const tiedChipState: CoordinatorContractState = {
      ...state,
      runs: {
        'run-chip-tie': {
          id: 'run-chip-tie',
          sessionId: 'session-chip-tie',
          prompt: 'Prompt',
          status: 'completed',
          model: 'gpt-5.3-codex',
          provider: 'openai-codex',
          createdAt: '2026-03-06T00:50:00.000Z',
          contextReferences: [
            {
              id: 'ctx-b',
              kind: 'resource',
              label: 'B',
              sortOrder: 0,
              capturedAt: '2026-03-06T00:50:01.000Z'
            },
            {
              id: 'ctx-a',
              kind: 'resource',
              label: 'A',
              sortOrder: 0,
              capturedAt: '2026-03-06T00:50:01.000Z'
            }
          ],
          messages: []
        }
      }
    }

    expect(selectCoordinatorActiveRunContextChips(tiedChipState, 'session-chip-tie').map((item) => item.id)).toEqual([
      'ctx-a',
      'ctx-b'
    ])
  })

  it('returns an empty chip list when the latest run has no contextReferences', () => {
    const noReferencesState: CoordinatorContractState = {
      ...state,
      runs: {
        'run-empty': {
          id: 'run-empty',
          sessionId: 'session-empty-refs',
          prompt: 'Prompt',
          status: 'completed',
          model: 'gpt-5.3-codex',
          provider: 'openai-codex',
          createdAt: '2026-03-06T00:40:00.000Z',
          messages: []
        }
      }
    }

    expect(selectCoordinatorActiveRunContextChips(noReferencesState, 'session-empty-refs')).toEqual([])
    expect(selectCoordinatorActiveRunContextSummary(noReferencesState, 'session-empty-refs')).toBeNull()
  })

  it('treats missing pasted line counts as zero in the compact summary', () => {
    const missingLineCountState: CoordinatorContractState = {
      ...state,
      runs: {
        'run-missing-linecount': {
          id: 'run-missing-linecount',
          sessionId: 'session-linecount',
          prompt: 'Prompt',
          status: 'completed',
          model: 'gpt-5.3-codex',
          provider: 'openai-codex',
          createdAt: '2026-03-06T00:50:00.000Z',
          contextReferences: [
            {
              id: 'ctx-a',
              kind: 'pasted-text',
              label: 'Pasted',
              sortOrder: 0,
              capturedAt: '2026-03-06T00:50:01.000Z'
            },
            {
              id: 'ctx-b',
              kind: 'resource',
              label: 'Spec',
              sortOrder: 1,
              capturedAt: '2026-03-06T00:50:02.000Z'
            }
          ],
          messages: []
        }
      }
    }

    expect(selectCoordinatorActiveRunContextSummary(missingLineCountState, 'session-linecount')).toEqual({
      referenceCount: 2,
      pastedLineCount: 0,
      labels: ['Pasted', 'Spec']
    })
  })
})
