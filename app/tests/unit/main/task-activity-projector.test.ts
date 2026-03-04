// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { createTaskActivityProjector } from '../../../src/main/task-activity-projector'

describe('task activity projector', () => {
  it('marks the first unresolved task as in_progress when a run starts', () => {
    const projector = createTaskActivityProjector()
    const snapshot = projector.onRunPending({
      sessionId: 'session-1',
      runId: 'run-1',
      activeAgentId: 'agent-1',
      tasks: [
        { id: 'task-a', title: 'Task A', status: 'not_started' },
        { id: 'task-b', title: 'Task B', status: 'not_started' }
      ]
    })

    expect(snapshot.items[0]).toMatchObject({
      id: 'task-a',
      status: 'in_progress',
      activityLevel: 'high',
      activeAgentId: 'agent-1'
    })
    expect(snapshot.counts).toEqual({
      not_started: 1,
      in_progress: 1,
      blocked: 0,
      complete: 0
    })
  })

  it('updates active task detail from message activity and normalizes whitespace', () => {
    const projector = createTaskActivityProjector()
    projector.onRunPending({
      sessionId: 'session-1',
      runId: 'run-1',
      tasks: [{ id: 'task-a', title: 'Task A' }]
    })

    const snapshot = projector.onMessageActivity({
      sessionId: 'session-1',
      runId: 'run-1',
      detail: '  Starting   implementation\nfor task A  ',
      activeAgentId: 'agent-2'
    })

    expect(snapshot?.items[0]).toMatchObject({
      id: 'task-a',
      status: 'in_progress',
      activityLevel: 'high',
      activityDetail: 'Starting implementation for task A',
      activeAgentId: 'agent-2'
    })
  })

  it('clears transient activity detail when run settles while preserving status counts', () => {
    const projector = createTaskActivityProjector()
    projector.onRunPending({
      sessionId: 'session-1',
      runId: 'run-1',
      tasks: [{ id: 'task-a', title: 'Task A' }]
    })

    const settled = projector.onRunSettled({
      sessionId: 'session-1',
      runId: 'run-1'
    })

    expect(settled?.items[0]).toMatchObject({
      id: 'task-a',
      status: 'in_progress',
      activityLevel: 'none'
    })
    expect(settled?.items[0]?.activityDetail).toBeUndefined()
    expect(settled?.counts).toEqual({
      not_started: 0,
      in_progress: 1,
      blocked: 0,
      complete: 0
    })
  })

  it('returns null when receiving activity for unknown session/run combinations', () => {
    const projector = createTaskActivityProjector()

    expect(
      projector.onMessageActivity({
        sessionId: 'missing',
        runId: 'run-1',
        detail: 'noop'
      })
    ).toBeNull()

    projector.onRunPending({
      sessionId: 'session-1',
      runId: 'run-1',
      tasks: [{ id: 'task-a', title: 'Task A' }]
    })

    expect(
      projector.onMessageActivity({
        sessionId: 'session-1',
        runId: 'run-2',
        detail: 'noop'
      })
    ).toBeNull()
  })
})
