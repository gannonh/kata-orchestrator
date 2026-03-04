// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  TASK_ACTIVITY_LEVELS,
  TASK_TRACKING_STATUSES,
  type TaskActivitySnapshot
} from '../../../../src/shared/types/task-tracking'

describe('task-tracking shared types', () => {
  it('exports status and activity enums', () => {
    expect(TASK_TRACKING_STATUSES).toEqual(['not_started', 'in_progress', 'blocked', 'complete'])
    expect(TASK_ACTIVITY_LEVELS).toEqual(['none', 'low', 'high'])
  })

  it('supports typed snapshot shape', () => {
    const snapshot: TaskActivitySnapshot = {
      sessionId: 'session-1',
      runId: 'run-1',
      items: [],
      counts: { not_started: 0, in_progress: 0, blocked: 0, complete: 0 }
    }

    expect(snapshot.counts.in_progress).toBe(0)
  })
})
