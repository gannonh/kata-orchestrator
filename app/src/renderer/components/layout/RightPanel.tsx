import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { mockProject } from '../../mock/project'
import type { ProjectSpec } from '../../types/project'
import { cn } from '../../lib/cn'
import { SpecTab } from '../right/SpecTab'
import { DynamicPanelTabs, type DynamicPanelTab } from '../shared/DynamicPanelTabs'
import { NewNoteScaffold } from '../shared/NewNoteScaffold'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'

const BASE_TAB_ID = 'right-spec'

type RightPanelProps = {
  project?: ProjectSpec
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
}

export function RightPanel({ project = mockProject, theme, onToggleTheme }: RightPanelProps) {
  const noteIdCounter = useRef(1)
  const [tabs, setTabs] = useState<DynamicPanelTab[]>([
    { id: BASE_TAB_ID, label: 'Spec', kind: 'base', closable: false, renamable: false }
  ])
  const [activeTabId, setActiveTabId] = useState(BASE_TAB_ID)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    noteIdCounter.current = 1
    setTabs([{ id: BASE_TAB_ID, label: 'Spec', kind: 'base', closable: false, renamable: false }])
    setActiveTabId(BASE_TAB_ID)
  }, [project.id])

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs]
  )

  const handleCreateNote = () => {
    const nextId = `right-note-${noteIdCounter.current}`
    noteIdCounter.current += 1

    setTabs((currentTabs) => [
      ...currentTabs,
      { id: nextId, label: 'New Note', kind: 'note', closable: true, renamable: true }
    ])
    setActiveTabId(nextId)
  }

  const handleCloseTab = (tabId: string) => {
    setTabs((currentTabs) => {
      const tabIndex = currentTabs.findIndex((tab) => tab.id === tabId)
      if (tabIndex < 0) {
        return currentTabs
      }

      const remainingTabs = currentTabs.filter((tab) => tab.id !== tabId)

      if (activeTabId === tabId) {
        const fallbackTab = currentTabs[tabIndex - 1] ?? currentTabs[tabIndex + 1] ?? remainingTabs[0]
        setActiveTabId(fallbackTab?.id ?? BASE_TAB_ID)
      }

      return remainingTabs
    })
  }

  const handleRenameTab = (tabId: string, label: string) => {
    setTabs((currentTabs) => currentTabs.map((tab) => (tab.id === tabId ? { ...tab, label } : tab)))
  }

  const activeContent = useMemo(() => {
    if (activeTab?.kind === 'note') {
      return <NewNoteScaffold />
    }

    return <SpecTab project={project} />
  }, [activeTab?.kind, project])

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-end gap-2 bg-background pl-0 pr-3">
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
          {theme ? (
            <Button
              type="button"
              variant="outline"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={onToggleTheme}
            >
              {theme === 'dark' ? 'Dark' : 'Light'}
            </Button>
          ) : null}
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
        data-testid="right-panel-content"
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden p-4 transition-[opacity] duration-200 ease-linear',
          isCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
      >
        <h2 className="text-2xl font-semibold tracking-tight">
          Spec
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{project.name}</p>
        <ScrollArea className="mt-4 min-h-0 flex-1 pr-2">{activeContent}</ScrollArea>
      </div>
    </div>
  )
}
