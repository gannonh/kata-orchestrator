import type { StructuredSpecDocument } from '../../types/spec-document'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { StatusBadge } from '../shared/StatusBadge'
import { TaskList } from './TaskList'

type SpecSectionsProps = {
  document: StructuredSpecDocument
  onToggleTask: (taskId: string) => void
  onEditMarkdown: () => void
  commentStatusNote: string
}

type SectionListProps = {
  title: string
  items: string[]
  ordered?: boolean
}

function SectionList({ title, items, ordered = false }: SectionListProps) {
  const ListTag = ordered ? 'ol' : 'ul'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ListTag
            className={[
              'space-y-1 pl-5 text-sm text-muted-foreground',
              ordered ? 'list-decimal' : 'list-disc'
            ].join(' ')}
          >
            {items.map((item, index) => (
              <li key={`${title}-${index}`}>{item}</li>
            ))}
          </ListTag>
        ) : (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function SpecSections({
  document,
  onToggleTask,
  onEditMarkdown,
  commentStatusNote
}: SpecSectionsProps) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge
          label={document.appliedRunId ? `Applied from ${document.appliedRunId}` : 'Draft applied'}
          tone="info"
        />
        <button
          type="button"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={onEditMarkdown}
        >
          Edit markdown
        </button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wide">Goal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {document.sections.goal || 'No goal yet.'}
          </p>
        </CardContent>
      </Card>

      <SectionList
        title="Acceptance Criteria"
        items={document.sections.acceptanceCriteria}
        ordered
      />
      <SectionList
        title="Non-goals"
        items={document.sections.nonGoals}
      />
      <SectionList
        title="Assumptions"
        items={document.sections.assumptions}
      />
      <SectionList
        title="Verification Plan"
        items={document.sections.verificationPlan}
        ordered
      />
      <SectionList
        title="Rollback Plan"
        items={document.sections.rollbackPlan}
        ordered
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wide">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList
            tasks={document.tasks}
            onToggleTask={onToggleTask}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{commentStatusNote}</p>
    </div>
  )
}
