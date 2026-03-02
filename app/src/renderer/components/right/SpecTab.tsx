import type { ProjectSpec } from '../../types/project'
import type { LatestRunDraft, StructuredSpecDocument } from '../../types/spec-document'
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
    }
  | {
      mode: 'draft_ready'
      latestDraft: LatestRunDraft
      onApplyDraft: () => void
      commentStatusNote: string
    }
  | {
      mode: 'structured_view'
      document: StructuredSpecDocument
      onToggleTask: (taskId: string) => void
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
      return <SpecOnboardingState />
    }

    if (specState.mode === 'draft_ready') {
      return (
        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide">Draft Ready</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Latest run {specState.latestDraft.runId} produced a structured spec draft that can be applied into this panel.
              </p>
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                Generated at {specState.latestDraft.generatedAt}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={specState.onApplyDraft}
              >
                Apply Draft to Spec
              </Button>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">{specState.commentStatusNote}</p>
        </div>
      )
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
        onToggleTask={specState.onToggleTask}
        onEditMarkdown={specState.onEditMarkdown}
        commentStatusNote={specState.commentStatusNote}
      />
    )
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wide">Goal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{project.goal}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wide">Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchitectureDiagram />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wide">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList tasks={project.tasks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wide">Acceptance Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <AcceptanceCriteria criteria={project.acceptanceCriteria} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wide">Non-Goals</CardTitle>
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
          <CardTitle className="text-sm uppercase tracking-wide">Assumptions</CardTitle>
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
