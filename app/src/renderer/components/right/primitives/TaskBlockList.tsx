import { cn } from '../../../lib/cn'
import { StatusBadge, type StatusBadgeTone } from '../../shared/StatusBadge'
import { Checkbox } from '../../ui/checkbox'
import { Card, CardContent } from '../../ui/card'

import type { ParsedSpecTaskItem, ParsedSpecTaskStatus } from './spec-markdown-types'

type TaskBlockDisplayStatus = ParsedSpecTaskStatus | 'blocked'

export type TaskBlockListItem = ParsedSpecTaskItem & {
  displayStatus?: TaskBlockDisplayStatus
  activityLevel?: 'none' | 'low' | 'high'
  activityDetail?: string
  activeAgentId?: string
}

type TaskBlockListProps = {
  tasks: TaskBlockListItem[]
  mode?: 'interactive' | 'readonly'
  onToggleTask?: (taskId: string) => void
}

type StatusConfig = {
  label: string
  tone: StatusBadgeTone
}

const taskStatusConfig: Record<TaskBlockDisplayStatus, StatusConfig> = {
  not_started: {
    label: 'Not Started',
    tone: 'neutral'
  },
  in_progress: {
    label: 'In Progress',
    tone: 'info'
  },
  complete: {
    label: 'Complete',
    tone: 'success'
  },
  blocked: {
    label: 'Blocked',
    tone: 'danger'
  }
}

export function TaskBlockList({ tasks, onToggleTask, mode = 'interactive' }: TaskBlockListProps) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tasks yet.</p>
  }

  return (
    <ul className="grid gap-2">
      {tasks.map((task) => {
        const displayStatus = task.displayStatus ?? task.status
        const status = taskStatusConfig[displayStatus]
        const isHighActivity = task.activityLevel === 'high' && Boolean(task.activityDetail)

        return (
          <li key={task.id}>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
                    <Checkbox
                      checked={
                        displayStatus === 'in_progress'
                          ? 'indeterminate'
                          : displayStatus === 'complete'
                      }
                      aria-label={task.title}
                      disabled={mode === 'readonly'}
                      onCheckedChange={() => {
                        onToggleTask?.(task.id)
                      }}
                    />
                    <span className="truncate">{task.title}</span>
                  </label>
                  <StatusBadge
                    label={status.label}
                    tone={status.tone}
                  />
                </div>
                {isHighActivity ? (
                  <div className="mt-2 flex items-center gap-2 border-t border-border/60 pt-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {task.activityDetail}
                    </p>
                    {task.activeAgentId ? (
                      <span
                        aria-label="Active specialist"
                        className={cn(
                          'inline-flex h-4 items-center rounded bg-status-in-progress/20 px-1.5 text-[10px] font-medium text-status-in-progress'
                        )}
                      >
                        {task.activeAgentId}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
