import type { StructuredSpecDocument } from '../../types/spec-document'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { StatusBadge } from '../shared/StatusBadge'
import { SpecArtifactDiagnostics } from './SpecArtifactDiagnostics'

type SpecSectionsProps = {
  document: StructuredSpecDocument
  onEditMarkdown: () => void
  commentStatusNote: string
}

export function SpecSections({ document, onEditMarkdown, commentStatusNote }: SpecSectionsProps) {
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

      <MarkdownRenderer content={document.visibleMarkdown} />

      <p className="text-xs text-muted-foreground">{commentStatusNote}</p>
    </div>
  )
}
