export const TASK_TRACKING_STATUSES = [
  'not_started',
  'in_progress',
  'blocked',
  'complete'
] as const

export type TaskTrackingStatus = (typeof TASK_TRACKING_STATUSES)[number]

export const TASK_ACTIVITY_LEVELS = ['none', 'low', 'high'] as const

export type TaskActivityLevel = (typeof TASK_ACTIVITY_LEVELS)[number]

export type TaskTrackingItem = {
  id: string
  title: string
  status: TaskTrackingStatus
  activityLevel: TaskActivityLevel
  activityDetail?: string
  activeAgentId?: string
  updatedAt: string
}

export type TaskActivitySnapshot = {
  sessionId: string
  runId: string
  items: TaskTrackingItem[]
  counts: Record<TaskTrackingStatus, number>
}

export function buildTaskCounts(items: TaskTrackingItem[]): TaskActivitySnapshot['counts'] {
  const counts: TaskActivitySnapshot['counts'] = {
    not_started: 0,
    in_progress: 0,
    blocked: 0,
    complete: 0
  }

  for (const item of items) {
    counts[item.status] += 1
  }

  return counts
}
