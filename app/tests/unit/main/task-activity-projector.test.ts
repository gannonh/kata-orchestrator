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

  it('preserves non-in_progress tasks unchanged when a run settles', () => {
    const projector = createTaskActivityProjector()
    projector.onRunPending({
      sessionId: 'session-1',
      runId: 'run-1',
      tasks: [
        { id: 'task-a', title: 'Task A', status: 'complete' },
        { id: 'task-b', title: 'Task B', status: 'complete' }
      ]
    })

    const settled = projector.onRunSettled({
      sessionId: 'session-1',
      runId: 'run-1'
    })

    expect(settled?.items[0]).toMatchObject({
      id: 'task-a',
      status: 'complete'
    })
    expect(settled?.items[1]).toMatchObject({
      id: 'task-b',
      status: 'complete'
    })
  })

  it('returns a snapshot clone via getSnapshot for a known session', () => {
    const projector = createTaskActivityProjector()
    projector.onRunPending({
      sessionId: 'session-1',
      runId: 'run-1',
      tasks: [{ id: 'task-a', title: 'Task A' }]
    })

    const snapshot = projector.getSnapshot('session-1')
    expect(snapshot?.sessionId).toBe('session-1')
    expect(snapshot?.items).toHaveLength(1)
  })

  it('returns null from getSnapshot for unknown session', () => {
    const projector = createTaskActivityProjector()
    expect(projector.getSnapshot('missing')).toBeNull()
  })

  it('returns null from getSnapshot when runId does not match', () => {
    const projector = createTaskActivityProjector()
    projector.onRunPending({
      sessionId: 'session-1',
      runId: 'run-1',
      tasks: [{ id: 'task-a', title: 'Task A' }]
    })

    expect(projector.getSnapshot('session-1', 'run-wrong')).toBeNull()
  })

  it('returns snapshot from getSnapshot when runId matches', () => {
    const projector = createTaskActivityProjector()
    projector.onRunPending({
      sessionId: 'session-1',
      runId: 'run-1',
      tasks: [{ id: 'task-a', title: 'Task A' }]
    })

    const snapshot = projector.getSnapshot('session-1', 'run-1')
    expect(snapshot?.runId).toBe('run-1')
  })

  it('returns null from onRunSettled for unknown session', () => {
    const projector = createTaskActivityProjector()
    expect(projector.onRunSettled({ sessionId: 'missing', runId: 'r' })).toBeNull()
  })

  it('returns null from onRunSettled when runId does not match', () => {
    const projector = createTaskActivityProjector()
    projector.onRunPending({
      sessionId: 'session-1',
      runId: 'run-1',
      tasks: [{ id: 'task-a', title: 'Task A' }]
    })
    expect(projector.onRunSettled({ sessionId: 'session-1', runId: 'run-wrong' })).toBeNull()
  })

  it('returns snapshot without mutating tasks when no in_progress task exists during message activity', () => {
    const projector = createTaskActivityProjector()
    projector.onRunPending({
      sessionId: 'session-1',
      runId: 'run-1',
      tasks: [
        { id: 'task-a', title: 'Task A', status: 'complete' },
        { id: 'task-b', title: 'Task B', status: 'complete' }
      ]
    })

    const snapshot = projector.onMessageActivity({
      sessionId: 'session-1',
      runId: 'run-1',
      detail: 'still going'
    })

    expect(snapshot).not.toBeNull()
    expect(snapshot?.items[0].status).toBe('complete')
    expect(snapshot?.items[0].activityDetail).toBeUndefined()
    expect(snapshot?.items[1].status).toBe('complete')
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
