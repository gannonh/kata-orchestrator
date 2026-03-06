import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    expect(run.contextReferences).toEqual([])
    expect(run.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'Plan phase 2' })
    ])
    expect(state.runs[run.id]).toBeDefined()
  })

  it('createRun throws for unknown sessionId', async () => {
    const { createRun } = await import('../../../src/main/orchestrator')

    expect(() =>
      createRun(store, {
        sessionId: 'nonexistent',
        prompt: 'test',
        model: 'm',
        provider: 'p'
      })
    ).toThrow('Session not found: nonexistent')
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

  it('setRunDraft and markRunDraftApplied persist draft metadata for an existing run', async () => {
    const { createRun, setRunDraft, markRunDraftApplied } = await import('../../../src/main/orchestrator')

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'test',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic'
    })

    setRunDraft(store, run.id, {
      runId: run.id,
      generatedAt: '2026-03-01T00:01:00.000Z',
      content: '## Goal\nPersist draft'
    })
    markRunDraftApplied(store, run.id, '2026-03-01T00:02:00.000Z')

    expect(state.runs[run.id].draft).toEqual({
      runId: run.id,
      generatedAt: '2026-03-01T00:01:00.000Z',
      content: '## Goal\nPersist draft'
    })
    expect(state.runs[run.id].draftAppliedAt).toBe('2026-03-01T00:02:00.000Z')
  })

  it('replaceRunContextReferences replaces run context references for an existing run', async () => {
    const { createRun, replaceRunContextReferences } = await import('../../../src/main/orchestrator')

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'Prompt',
      model: 'm',
      provider: 'p'
    })

    replaceRunContextReferences(store, run.id, [
      {
        id: 'ctx-1',
        kind: 'resource',
        label: 'Spec',
        resourceId: 'resource-spec',
        sortOrder: 0,
        capturedAt: '2026-03-06T00:00:01.000Z'
      }
    ])

    expect(state.runs[run.id]?.contextReferences).toHaveLength(1)
    expect(state.runs[run.id]?.contextReferences?.[0]).toMatchObject({
      id: 'ctx-1',
      kind: 'resource',
      label: 'Spec'
    })
  })

  it('updateRunStatus is a no-op for nonexistent runId', async () => {
    const { updateRunStatus } = await import('../../../src/main/orchestrator')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const saveSpy = vi.fn()
    const noopStore = {
      load: () => ({ ...state }),
      save: saveSpy
    }

    updateRunStatus(noopStore, 'nonexistent-run-id', 'running')
    expect(saveSpy).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot update status for unknown run')
    )
    consoleSpy.mockRestore()
  })

  it('appendRunMessage is a no-op for nonexistent runId', async () => {
    const { appendRunMessage } = await import('../../../src/main/orchestrator')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const saveSpy = vi.fn()
    const noopStore = {
      load: () => ({ ...state }),
      save: saveSpy
    }

    appendRunMessage(noopStore, 'nonexistent-run-id', {
      id: 'agent-1',
      role: 'agent',
      content: 'Should not be saved.',
      createdAt: new Date().toISOString()
    })
    expect(saveSpy).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot append message to unknown run')
    )
    consoleSpy.mockRestore()
  })

  it('setRunDraft and markRunDraftApplied are no-ops for nonexistent runId', async () => {
    const { setRunDraft, markRunDraftApplied } = await import('../../../src/main/orchestrator')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const saveSpy = vi.fn()
    const noopStore = {
      load: () => ({ ...state }),
      save: saveSpy
    }

    setRunDraft(noopStore, 'nonexistent-run-id', {
      runId: 'nonexistent-run-id',
      generatedAt: '2026-03-01T00:00:00.000Z',
      content: '## Goal\nNo-op'
    })
    markRunDraftApplied(noopStore, 'nonexistent-run-id', '2026-03-01T00:00:01.000Z')

    expect(saveSpy).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot set draft for unknown run')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot mark draft-applied for unknown run')
    )
    consoleSpy.mockRestore()
  })

  it('replaceRunContextReferences is a no-op for nonexistent runId', async () => {
    const { replaceRunContextReferences } = await import('../../../src/main/orchestrator')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const saveSpy = vi.fn()
    const noopStore = {
      load: () => ({ ...state }),
      save: saveSpy
    }

    replaceRunContextReferences(noopStore, 'nonexistent-run-id', [])

    expect(saveSpy).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot set context references for unknown run')
    )
    consoleSpy.mockRestore()
  })

  it('setRunDraft rejects draft with mismatched runId', async () => {
    const { createRun, setRunDraft } = await import('../../../src/main/orchestrator')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'test',
      model: 'm',
      provider: 'p'
    })

    setRunDraft(store, run.id, {
      runId: 'different-run-id',
      generatedAt: '2026-03-01T00:01:00.000Z',
      content: '## Goal\nMismatch'
    })

    expect(state.runs[run.id].draft).toBeUndefined()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Draft runId mismatch')
    )
    consoleSpy.mockRestore()
  })

  it('updateRunStatus rejects invalid transitions', async () => {
    const { createRun, updateRunStatus } = await import('../../../src/main/orchestrator')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const run = createRun(store, {
      sessionId: 's-1',
      prompt: 'test',
      model: 'm',
      provider: 'p'
    })

    // queued -> completed is not valid (must go through running first)
    updateRunStatus(store, run.id, 'completed')
    expect(state.runs[run.id].status).toBe('queued')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid transition: queued -> completed')
    )

    // Valid: queued -> running -> completed
    updateRunStatus(store, run.id, 'running')
    expect(state.runs[run.id].status).toBe('running')

    // running -> queued is not valid
    updateRunStatus(store, run.id, 'queued')
    expect(state.runs[run.id].status).toBe('running')

    consoleSpy.mockRestore()
  })

  it('getRunsForSession returns runs filtered by sessionId', async () => {
    const { createRun, getRunsForSession } = await import('../../../src/main/orchestrator')

    // Add a second session so the filter test is meaningful
    state.sessions['s-other'] = {
      id: 's-other',
      spaceId: 'sp-1',
      label: 'Other',
      createdAt: '2026-03-01T00:00:00Z'
    }
    createRun(store, { sessionId: 's-1', prompt: 'a', model: 'm', provider: 'p' })
    createRun(store, { sessionId: 's-1', prompt: 'b', model: 'm', provider: 'p' })
    createRun(store, { sessionId: 's-other', prompt: 'c', model: 'm', provider: 'p' })

    const runs = getRunsForSession(store, 's-1')
    expect(runs).toHaveLength(2)
    expect(runs.every((r) => r.sessionId === 's-1')).toBe(true)
  })
})
