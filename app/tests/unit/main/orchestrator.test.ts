import { beforeEach, describe, expect, it } from 'vitest'
import type { StateStore } from '../../../src/main/state-store'
import type { AppState } from '@shared/types/space'
import { createDefaultAppState } from '@shared/types/space'

describe('Orchestrator', () => {
  let state: AppState
  let store: StateStore

  beforeEach(() => {
    state = {
      ...createDefaultAppState(),
      sessions: {
        's-1': {
          id: 's-1',
          spaceId: 'sp-1',
          label: 'Test',
          createdAt: '2026-03-01T00:00:00Z'
        }
      },
      spaces: {
        'sp-1': {
          id: 'sp-1',
          name: 'Test Space',
          repoUrl: 'https://github.com/test/repo',
          rootPath: '/tmp/test',
          branch: 'main',
          orchestrationMode: 'team',
          createdAt: '2026-03-01T00:00:00Z',
          status: 'active'
        }
      }
    }
    store = {
      load: () => state,
      save: (next: AppState) => {
        state = next
      }
    }
  })

  it('createRun creates a queued RunRecord in state', async () => {
    const { createRun } = await import('../../../src/main/orchestrator')

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'Plan phase 2',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic'
    })

    expect(run.status).toBe('queued')
    expect(run.sessionId).toBe('s-1')
    expect(run.prompt).toBe('Plan phase 2')
    expect(run.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'Plan phase 2' })
    ])
    expect(state.runs[run.id]).toBeDefined()
  })

  it('updateRunStatus transitions and persists', async () => {
    const { createRun, updateRunStatus } = await import('../../../src/main/orchestrator')

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'test',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic'
    })

    updateRunStatus(store, run.id, 'running')
    expect(state.runs[run.id].status).toBe('running')
    expect(state.runs[run.id].startedAt).toBeDefined()

    updateRunStatus(store, run.id, 'completed')
    expect(state.runs[run.id].status).toBe('completed')
    expect(state.runs[run.id].completedAt).toBeDefined()
  })

  it('updateRunStatus sets errorMessage on failed', async () => {
    const { createRun, updateRunStatus } = await import('../../../src/main/orchestrator')

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'test',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic'
    })

    updateRunStatus(store, run.id, 'running')
    updateRunStatus(store, run.id, 'failed', 'No credentials')
    expect(state.runs[run.id].status).toBe('failed')
    expect(state.runs[run.id].errorMessage).toBe('No credentials')
  })

  it('appendRunMessage adds a message to run', async () => {
    const { createRun, appendRunMessage } = await import('../../../src/main/orchestrator')

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'test',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic'
    })

    appendRunMessage(store, run.id, {
      id: 'agent-1',
      role: 'agent',
      content: 'Draft ready.',
      createdAt: new Date().toISOString()
    })

    expect(state.runs[run.id].messages).toHaveLength(2) // user + agent
    expect(state.runs[run.id].messages[1].role).toBe('agent')
  })

  it('getRunsForSession returns runs filtered by sessionId', async () => {
    const { createRun, getRunsForSession } = await import('../../../src/main/orchestrator')

    createRun(store, { sessionId: 's-1', prompt: 'a', model: 'm', provider: 'p' })
    createRun(store, { sessionId: 's-1', prompt: 'b', model: 'm', provider: 'p' })
    createRun(store, { sessionId: 's-other', prompt: 'c', model: 'm', provider: 'p' })

    const runs = getRunsForSession(store, 's-1')
    expect(runs).toHaveLength(2)
    expect(runs.every((r) => r.sessionId === 's-1')).toBe(true)
  })
})
