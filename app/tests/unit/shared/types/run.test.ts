import { describe, expect, it } from 'vitest'
import { RUN_CONTEXT_REFERENCE_KINDS, RUN_STATUSES } from '../../../../src/shared/types/run'
import type {
  RunContextReferenceRecord,
  RunRecord,
  RunStatus,
  PersistedMessage
} from '../../../../src/shared/types/run'

describe('RunRecord types', () => {
  it('exports RUN_STATUSES tuple', () => {
    expect(RUN_STATUSES).toEqual(['queued', 'running', 'completed', 'failed'])
  })

  it('exports RUN_CONTEXT_REFERENCE_KINDS tuple', () => {
    expect(RUN_CONTEXT_REFERENCE_KINDS).toEqual(['pasted-text', 'resource', 'workspace-snippet'])
  })

  it('RunRecord satisfies shape with all required fields', () => {
    const run: RunRecord = {
      id: 'run-1',
      sessionId: 'session-1',
      prompt: 'Build a dashboard',
      status: 'queued',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      createdAt: '2026-03-01T00:00:00.000Z',
      messages: []
    }

    expect(run.id).toBe('run-1')
    expect(run.status).toBe('queued')
    expect(run.messages).toEqual([])
  })

  it('RunRecord accepts optional timing and error fields', () => {
    const run: RunRecord = {
      id: 'run-2',
      sessionId: 'session-1',
      prompt: 'Plan phase 2',
      status: 'failed',
      model: 'gpt-4.1-2025-04-14',
      provider: 'openai',
      createdAt: '2026-03-01T00:00:00.000Z',
      startedAt: '2026-03-01T00:00:01.000Z',
      completedAt: '2026-03-01T00:00:05.000Z',
      errorMessage: 'Provider timed out',
      messages: [
        { id: 'user-1', role: 'user', content: 'Plan phase 2', createdAt: '2026-03-01T00:00:00.000Z' }
      ]
    }

    expect(run.errorMessage).toBe('Provider timed out')
    expect(run.messages).toHaveLength(1)
  })

  it('RunRecord allows contextReferences with resource references', () => {
    const contextReference: RunContextReferenceRecord = {
      id: 'context-1',
      kind: 'resource',
      label: 'Coordinator spec',
      resourceId: 'resource-1',
      excerpt: '## Goal\nShip context contracts',
      lineCount: 2,
      sortOrder: 0,
      capturedAt: '2026-03-01T00:00:03.000Z'
    }

    const run: RunRecord = {
      id: 'run-3',
      sessionId: 'session-1',
      prompt: 'Use the coordinator context',
      status: 'completed',
      model: 'claude-sonnet-4-6-20250514',
      provider: 'anthropic',
      createdAt: '2026-03-01T00:00:00.000Z',
      messages: [],
      contextReferences: [contextReference]
    }

    expect(run.contextReferences).toEqual([contextReference])
    expect(run.contextReferences?.[0]?.resourceId).toBe('resource-1')
  })

  it('PersistedMessage satisfies shape', () => {
    const msg: PersistedMessage = {
      id: 'agent-1',
      role: 'agent',
      content: 'Draft ready.',
      createdAt: '2026-03-01T00:00:02.000Z'
    }

    expect(msg.role).toBe('agent')
  })

  it('RunStatus only allows valid values', () => {
    const statuses: RunStatus[] = ['queued', 'running', 'completed', 'failed']
    for (const status of statuses) {
      expect(RUN_STATUSES).toContain(status)
    }
  })
})
