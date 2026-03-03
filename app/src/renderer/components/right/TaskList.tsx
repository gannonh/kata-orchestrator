import { Checkbox } from '../ui/checkbox'
import { StatusBadge, type StatusBadgeTone } from '../shared/StatusBadge'
import type { ProjectTask, TaskStatus } from '../../types/project'
import type { SpecTaskItem, SpecTaskStatus } from '../../types/spec-document'
import { Card, CardContent } from '../ui/card'

type TaskListProps = {
  tasks: ProjectTask[] | SpecTaskItem[]
  onToggleTask?: (taskId: string) => void
}

type StatusConfig = {
  label: string
  tone: StatusBadgeTone
}

const taskStatusConfig: Record<TaskStatus, StatusConfig> = {
  todo: {
    label: 'Todo',
    tone: 'neutral'
  },
  in_progress: {
    label: 'In Progress',
    tone: 'info'
  },
  done: {
    label: 'Done',
    tone: 'success'
  },
  blocked: {
    label: 'Blocked',
    tone: 'danger'
  }
}

const specTaskStatusConfig: Record<SpecTaskStatus, StatusConfig> = {
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
  }
}

function isStructuredTask(task: ProjectTask | SpecTaskItem): task is SpecTaskItem {
  return 'markdownLineIndex' in task
}

export function TaskList({ tasks, onToggleTask }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tasks yet.</p>
  }

  return (
    <ul className="grid gap-2">
      {tasks.map((task) => {
        if (isStructuredTask(task)) {
          const status = specTaskStatusConfig[task.status]

          return (
            <li key={task.id}>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
                      <Checkbox
                        checked={
                          task.status === 'in_progress'
                            ? 'indeterminate'
                            : task.status === 'complete'
                        }
                        aria-label={task.title}
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
                </CardContent>
              </Card>
            </li>
          )
        }

        const status = taskStatusConfig[task.status]

        return (
          <li key={task.id}>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">{task.title}</p>
                  <StatusBadge
                    label={status.label}
                    tone={status.tone}
                  />
                </div>
                {task.owner ? (
                  <p className="mt-1 text-xs text-muted-foreground">Owner: {task.owner}</p>
                ) : null}
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
