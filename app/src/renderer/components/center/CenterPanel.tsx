import { type ReactNode, useMemo, useRef, useState } from 'react'

import { DynamicPanelTabs, type DynamicPanelTab } from '../shared/DynamicPanelTabs'
import { NewNoteScaffold } from '../shared/NewNoteScaffold'

type CenterPanelProps = {
  children: ReactNode
}

const BASE_TAB_ID = 'center-coordinator'
export function CenterPanel({ children }: CenterPanelProps) {
  const noteIdCounter = useRef(1)
  const [tabs, setTabs] = useState<DynamicPanelTab[]>([
    { id: BASE_TAB_ID, label: 'Coordinator', kind: 'base', closable: false, renamable: false }
  ])
  const [activeTabId, setActiveTabId] = useState(BASE_TAB_ID)

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs]
  )

  const handleCreateNote = () => {
    const nextId = `center-note-${noteIdCounter.current}`
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

  return (
    <section
      data-testid="center-panel"
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
    >
      <header className="flex h-14 shrink-0 items-end bg-background px-3">
        <DynamicPanelTabs
          ariaLabel="Center panel tabs"
          tabs={tabs}
          activeTabId={activeTabId}
          onActiveTabChange={setActiveTabId}
          onCreateNote={handleCreateNote}
          onCloseTab={handleCloseTab}
          onRenameTab={handleRenameTab}
          className="w-full border-0 px-0"
        />
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col p-4">
        {activeTab?.kind === 'note' ? (
          <NewNoteScaffold />
        ) : (
          children
        )}
      </div>
    </section>
  )
}
