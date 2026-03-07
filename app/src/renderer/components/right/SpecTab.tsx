import type { ProjectSpec } from '../../types/project'
import type { StructuredSpecDocument } from '../../types/spec-document'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { AcceptanceCriteria } from './AcceptanceCriteria'
import { ArchitectureDiagram } from './ArchitectureDiagram'
import { SpecOnboardingState } from './SpecOnboardingState'
import { SpecSections } from './SpecSections'
import { TaskList } from './TaskList'

type StructuredSpecTabState =
  | {
      mode: 'generating'
      phase?: 'thinking' | 'drafting'
    }
  | {
      mode: 'viewing'
      document: StructuredSpecDocument
      onEditMarkdown: () => void
      commentStatusNote: string
    }
  | {
      mode: 'editing'
      document: StructuredSpecDocument
      draftMarkdown: string
      onDraftMarkdownChange: (value: string) => void
      onSaveMarkdown: () => void
      onCancelEditing: () => void
      commentStatusNote: string
    }

type SpecTabProps = {
  project: ProjectSpec
  specState?: StructuredSpecTabState
}

export function SpecTab({ project, specState }: SpecTabProps) {
  if (specState) {
    if (specState.mode === 'generating') {
      return <SpecOnboardingState phase={specState.phase} />
    }

    if (specState.mode === 'editing') {
      return (
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide">Edit Spec Markdown</h3>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={specState.onCancelEditing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={specState.onSaveMarkdown}
              >
                Save
              </Button>
            </div>
          </div>
          <Textarea
            aria-label="Spec markdown editor"
            className="min-h-72 font-mono text-sm"
            value={specState.draftMarkdown}
            onChange={(event) => {
              specState.onDraftMarkdownChange(event.currentTarget.value)
            }}
          />
          <p className="text-xs text-muted-foreground">{specState.commentStatusNote}</p>
        </div>
      )
    }

    return (
      <SpecSections
        document={specState.document}
        onEditMarkdown={specState.onEditMarkdown}
        commentStatusNote={specState.commentStatusNote}
      />
    )
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle asChild className="text-sm uppercase tracking-wide">
            <h3>Goal</h3>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{project.goal}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle asChild className="text-sm uppercase tracking-wide">
            <h3>Architecture</h3>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ArchitectureDiagram />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle asChild className="text-sm uppercase tracking-wide">
            <h3>Tasks</h3>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList tasks={project.tasks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle asChild className="text-sm uppercase tracking-wide">
            <h3>Acceptance Criteria</h3>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AcceptanceCriteria criteria={project.acceptanceCriteria} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle asChild className="text-sm uppercase tracking-wide">
            <h3>Non-Goals</h3>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {project.nonGoals.map((nonGoal) => (
              <li key={`${project.id}-non-goal-${nonGoal}`}>{nonGoal}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle asChild className="text-sm uppercase tracking-wide">
            <h3>Assumptions</h3>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {project.assumptions.map((assumption) => (
              <li key={`${project.id}-assumption-${assumption}`}>{assumption}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
