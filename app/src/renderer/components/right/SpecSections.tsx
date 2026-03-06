import type { StructuredSpecDocument } from '../../types/spec-document'
import type { TaskActivitySnapshot } from '@shared/types/task-tracking'
import { StatusBadge } from '../shared/StatusBadge'
import { SpecArtifactDiagnostics } from './SpecArtifactDiagnostics'
import { StructuredSectionBlocks } from './primitives/StructuredSectionBlocks'
import { TaskList } from './TaskList'

type SpecSectionsProps = {
  document: StructuredSpecDocument
  taskActivitySnapshot?: TaskActivitySnapshot
  onToggleTask: (taskId: string) => void
  onEditMarkdown: () => void
  commentStatusNote: string
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

export function SpecSections({
  document,
  taskActivitySnapshot,
  onToggleTask,
  onEditMarkdown,
  commentStatusNote
}: SpecSectionsProps) {
  const snapshotTaskById = new Map(taskActivitySnapshot?.items.map((task) => [task.id, task]))
  const documentUpdatedAt = toTimestamp(document.updatedAt)
  const mergedTasks = document.tasks.map((task) => {
    const snapshotTask = snapshotTaskById.get(task.id)
    if (!snapshotTask) {
      return task
    }

    const snapshotUpdatedAt = toTimestamp(snapshotTask.updatedAt)
    const preferSnapshotStatus =
      snapshotUpdatedAt !== null &&
      (documentUpdatedAt === null || snapshotUpdatedAt >= documentUpdatedAt)

    return {
      ...task,
      displayStatus: preferSnapshotStatus ? snapshotTask.status : task.status,
      activityLevel: preferSnapshotStatus ? snapshotTask.activityLevel : undefined,
      activityDetail: preferSnapshotStatus ? snapshotTask.activityDetail : undefined,
      activeAgentId: preferSnapshotStatus ? snapshotTask.activeAgentId : undefined
    }
  })

  return (
    <div className="grid gap-4">
      <SpecArtifactDiagnostics
        sourcePath={document.sourcePath}
        diagnostics={document.diagnostics}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={`Source of truth: ${document.sourcePath || 'notes/spec.md'}`}
            tone="info"
          />
          <StatusBadge
            label={document.status}
            tone={document.status === 'ready' ? 'success' : 'warning'}
          />
          {document.sourceRunId ? (
            <StatusBadge
              label={`Trace: ${document.sourceRunId}`}
              tone="neutral"
            />
          ) : null}
        </div>
        <button
          type="button"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={onEditMarkdown}
        >
          Edit markdown
        </button>
      </div>

      <StructuredSectionBlocks
        sections={document.sections}
        renderTasks={() => (
          <TaskList
            tasks={mergedTasks}
            onToggleTask={onToggleTask}
          />
        )}
      />

      <p className="text-xs text-muted-foreground">{commentStatusNote}</p>
    </div>
  )
}
