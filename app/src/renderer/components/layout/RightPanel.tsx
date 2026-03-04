import { useLayoutEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { mockProject } from '../../mock/project'
import { useSpecDocument } from '../../hooks/useSpecDocument'
import type { ProjectSpec } from '../../types/project'
import type { LatestRunDraft } from '../../types/spec-document'
import type { TaskActivitySnapshot } from '@shared/types/task-tracking'
import { cn } from '../../lib/cn'
import { SpecTab } from '../right/SpecTab'
import { DynamicPanelTabs } from '../shared/DynamicPanelTabs'
import { NewNoteScaffold } from '../shared/NewNoteScaffold'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { useDynamicTabs } from '../../hooks/useDynamicTabs'

const BASE_TAB_ID = 'right-spec'

type RightPanelProps = {
  project?: ProjectSpec
  spaceId?: string | null
  sessionId?: string | null
  latestDraft?: LatestRunDraft
  taskActivitySnapshot?: TaskActivitySnapshot
}

const COMMENT_STATUS_NOTE =
  'Comment threads are intentionally deferred in this release so the structured spec draft and checkbox task state remain the current source of truth.'

export function RightPanel({
  project = mockProject,
  spaceId,
  sessionId,
  latestDraft,
  taskActivitySnapshot
}: RightPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftMarkdown, setDraftMarkdown] = useState('')
  const hasStructuredSpec = Boolean(spaceId && sessionId)
  const specDocument = useSpecDocument({
    spaceId: spaceId ?? 'inactive-space',
    sessionId: sessionId ?? 'inactive-session',
    enabled: hasStructuredSpec
  })

  useLayoutEffect(() => {
    setIsEditing(false)
    setDraftMarkdown('')
  }, [sessionId, spaceId])

  const { tabs, activeTabId, setActiveTabId, activeTab, handleCreateNote, handleCloseTab, handleRenameTab } =
    useDynamicTabs({
      prefix: 'right',
      baseTabId: BASE_TAB_ID,
      baseTab: { id: BASE_TAB_ID, label: 'Spec', kind: 'base' },
      resetKey: project.id
    })

  const activeContent = useMemo(() => {
    if (activeTab?.kind === 'note') {
      return <NewNoteScaffold />
    }

    if (!hasStructuredSpec) {
      return <SpecTab project={project} />
    }

    if (isEditing) {
      return (
        <SpecTab
          project={project}
          specState={{
            mode: 'editing',
            document: specDocument.document,
            draftMarkdown,
            onDraftMarkdownChange: setDraftMarkdown,
            onSaveMarkdown: () => {
              specDocument.setMarkdown(draftMarkdown)
              setIsEditing(false)
            },
            onCancelEditing: () => {
              setDraftMarkdown(specDocument.document.markdown)
              setIsEditing(false)
            },
            commentStatusNote: COMMENT_STATUS_NOTE
          }}
        />
      )
    }

    if (latestDraft && !specDocument.document.appliedRunId) {
      return (
        <SpecTab
          project={project}
          specState={{
            mode: 'draft_ready',
            latestDraft,
            onApplyDraft: () => {
              specDocument.applyDraft(latestDraft)
              setIsEditing(false)
            },
            commentStatusNote: COMMENT_STATUS_NOTE
          }}
        />
      )
    }

    if (!specDocument.document.markdown) {
      return (
        <SpecTab
          project={project}
          specState={{ mode: 'generating' }}
        />
      )
    }

    return (
      <SpecTab
        project={project}
        specState={{
          mode: 'structured_view',
          document: specDocument.document,
          taskActivitySnapshot,
          onToggleTask: specDocument.toggleTask,
          onEditMarkdown: () => {
            setDraftMarkdown(specDocument.document.markdown)
            setIsEditing(true)
          },
          commentStatusNote: COMMENT_STATUS_NOTE
        }}
      />
    )
  }, [
    activeTab?.kind,
    draftMarkdown,
    hasStructuredSpec,
    isEditing,
    latestDraft,
    project,
    specDocument,
    taskActivitySnapshot
  ])

  return (
    <div className="flex h-full flex-col">
      <header
        data-testid="right-panel-header"
        className="flex h-14 shrink-0 items-end gap-2 bg-background pl-0 pr-3"
      >
        <DynamicPanelTabs
          className="w-full border-0 px-0"
          ariaLabel="Right panel tabs"
          tabs={tabs}
          activeTabId={activeTabId}
          onActiveTabChange={setActiveTabId}
          onCreateNote={handleCreateNote}
          onCloseTab={handleCloseTab}
          onRenameTab={handleRenameTab}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={isCollapsed ? 'Expand right column' : 'Collapse right column'}
            onClick={() => setIsCollapsed((current) => !current)}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div
        id={`${activeTabId}-panel`}
        role="tabpanel"
        aria-labelledby={`${activeTabId}-tab`}
        data-testid="right-panel-content"
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden p-4 transition-[opacity] duration-200 ease-linear',
          isCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
      >
        {activeTab?.kind !== 'note' ? (
          <>
            <h2 className="text-2xl font-semibold tracking-tight">
              Spec
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{project.name}</p>
          </>
        ) : null}
        <ScrollArea className="mt-4 min-h-0 flex-1 pr-2">{activeContent}</ScrollArea>
      </div>
    </div>
  )
}
