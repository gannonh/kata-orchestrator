import { type ReactNode } from 'react'

import { DynamicPanelTabs } from '../shared/DynamicPanelTabs'
import { NewNoteScaffold } from '../shared/NewNoteScaffold'
import { useDynamicTabs } from '../../hooks/useDynamicTabs'

type CenterPanelProps = {
  children: ReactNode
}

const BASE_TAB_ID = 'center-coordinator'

export function CenterPanel({ children }: CenterPanelProps) {
  const { tabs, activeTabId, setActiveTabId, activeTab, handleCreateNote, handleCloseTab, handleRenameTab } =
    useDynamicTabs({
      prefix: 'center',
      baseTabId: BASE_TAB_ID,
      baseTab: { id: BASE_TAB_ID, label: 'Coordinator', kind: 'base' }
    })

  return (
    <section
      data-testid="center-panel"
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
    >
      <header className="flex h-14 shrink-0 items-end bg-background pl-0 pr-3">
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
      <div
        id={`${activeTabId}-panel`}
        role="tabpanel"
        aria-labelledby={`${activeTabId}-tab`}
        className="relative flex min-h-0 flex-1 flex-col p-4"
      >
        {activeTab?.kind === 'note' ? (
          <NewNoteScaffold />
        ) : (
          children
        )}
      </div>
    </section>
  )
}
