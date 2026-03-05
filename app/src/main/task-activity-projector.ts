import {
  buildTaskCounts,
  type TaskActivitySnapshot,
  type TaskTrackingItem,
  type TaskTrackingStatus
} from '../shared/types/task-tracking'

export type TaskActivitySeedItem = {
  id: string
  title: string
  status?: TaskTrackingStatus
}

type RunPendingInput = {
  sessionId: string
  runId: string
  tasks: TaskActivitySeedItem[]
  activeAgentId?: string
}

type MessageActivityInput = {
  sessionId: string
  runId: string
  detail: string
  activeAgentId?: string
}

type RunSettledInput = {
  sessionId: string
  runId: string
}

export type TaskActivityProjector = {
  onRunPending: (input: RunPendingInput) => TaskActivitySnapshot
  onMessageActivity: (input: MessageActivityInput) => TaskActivitySnapshot | null
  onRunSettled: (input: RunSettledInput) => TaskActivitySnapshot | null
  getSnapshot: (sessionId: string, runId?: string) => TaskActivitySnapshot | null
}

export function createTaskActivityProjector(): TaskActivityProjector {
  const snapshotsBySession = new Map<string, TaskActivitySnapshot>()

  const saveSnapshot = (snapshot: TaskActivitySnapshot): TaskActivitySnapshot => {
    const withCounts = { ...snapshot, counts: buildTaskCounts(snapshot.items) }
    snapshotsBySession.set(withCounts.sessionId, withCounts)
    return cloneSnapshot(withCounts)
  }

  return {
    onRunPending(input) {
      const now = new Date().toISOString()
      const items = input.tasks.map<TaskTrackingItem>((task) => ({
        id: task.id,
        title: task.title,
        status: task.status ?? 'not_started',
        activityLevel: 'none',
        updatedAt: now
      }))

      const firstActiveIndex = findFirstActionableTaskIndex(items)
      if (firstActiveIndex >= 0) {
        const target = items[firstActiveIndex]
        target.status = 'in_progress'
        target.activityLevel = 'high'
        target.activityDetail = 'Starting task activity...'
        target.activeAgentId = input.activeAgentId
        target.updatedAt = now
      }

      return saveSnapshot({
        sessionId: input.sessionId,
        runId: input.runId,
        items,
        counts: { not_started: 0, in_progress: 0, blocked: 0, complete: 0 }
      })
    },

    onMessageActivity(input) {
      const current = snapshotsBySession.get(input.sessionId)
      if (!current || current.runId !== input.runId) {
        return null
      }

      const next = cloneSnapshot(current)
      const targetIndex = findFirstInProgressTaskIndex(next.items)
      if (targetIndex < 0) {
        return saveSnapshot(next)
      }

      const now = new Date().toISOString()
      const target = next.items[targetIndex]
      target.status = 'in_progress'
      target.activityLevel = 'high'
      target.activityDetail = normalizeDetail(input.detail)
      target.activeAgentId = input.activeAgentId
      target.updatedAt = now

      return saveSnapshot(next)
    },

    onRunSettled(input) {
      const current = snapshotsBySession.get(input.sessionId)
      if (!current || current.runId !== input.runId) {
        return null
      }

      const now = new Date().toISOString()
      const items: TaskTrackingItem[] = current.items.map((item): TaskTrackingItem => {
        if (item.status !== 'in_progress') {
          return { ...item }
        }

        return {
          ...item,
          activityLevel: 'none',
          activityDetail: undefined,
          activeAgentId: undefined,
          updatedAt: now
        }
      })

      return saveSnapshot({
        ...current,
        items
      })
    },

    getSnapshot(sessionId, runId) {
      const snapshot = snapshotsBySession.get(sessionId)
      if (!snapshot) {
        return null
      }

      if (runId && snapshot.runId !== runId) {
        return null
      }

      return cloneSnapshot(snapshot)
    }
  }
}

function normalizeDetail(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
}

function findFirstActionableTaskIndex(items: TaskTrackingItem[]): number {
  const inProgressIndex = items.findIndex((task) => task.status === 'in_progress')
  if (inProgressIndex >= 0) {
    return inProgressIndex
  }

  return items.findIndex((task) => task.status !== 'complete')
}

function findFirstInProgressTaskIndex(items: TaskTrackingItem[]): number {
  return items.findIndex((task) => task.status === 'in_progress')
}

function cloneSnapshot(snapshot: TaskActivitySnapshot): TaskActivitySnapshot {
  return {
    ...snapshot,
    items: snapshot.items.map((item) => ({ ...item })),
    counts: { ...snapshot.counts }
  }
}

