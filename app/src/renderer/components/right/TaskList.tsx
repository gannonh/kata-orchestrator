import { StatusBadge, type StatusBadgeTone } from '../shared/StatusBadge'
import type { ProjectTask, TaskStatus } from '../../types/project'
import { Card, CardContent } from '../ui/card'
import { TaskBlockList, type TaskBlockListItem } from './primitives/TaskBlockList'

type TaskListProps = {
  tasks: ProjectTask[] | TaskBlockListItem[]
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

function isStructuredTask(task: ProjectTask | TaskBlockListItem): task is TaskBlockListItem {
  return 'markdownLineIndex' in task
}

export function TaskList({ tasks, onToggleTask }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tasks yet.</p>
  }

  if (isStructuredTask(tasks[0])) {
    const structuredTasks = tasks as TaskBlockListItem[]

    return (
      <TaskBlockList
        tasks={structuredTasks}
        onToggleTask={onToggleTask}
      />
    )
  }

  const projectTasks = tasks as ProjectTask[]

  return (
    <ul className="grid gap-2">
      {projectTasks.map((task) => {
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
