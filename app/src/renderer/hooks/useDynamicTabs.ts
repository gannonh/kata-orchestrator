import { useEffect, useMemo, useRef, useState } from 'react'

import type { DynamicPanelTab } from '../components/shared/DynamicPanelTabs'

type UseDynamicTabsOptions = {
  prefix: string
  baseTabId: string
  baseTab: DynamicPanelTab
  resetKey?: string | number
}

export function useDynamicTabs({ prefix, baseTabId, baseTab, resetKey }: UseDynamicTabsOptions) {
  const noteIdCounter = useRef(1)
  const [tabs, setTabs] = useState<DynamicPanelTab[]>([baseTab])
  const [activeTabId, setActiveTabId] = useState(baseTabId)

  // Keep a ref in sync so handleCloseTab's functional updater can read the
  // current value without capturing a stale closure from the last render.
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId

  useEffect(() => {
    if (resetKey === undefined) {
      return
    }
    noteIdCounter.current = 1
    setTabs([baseTab])
    setActiveTabId(baseTabId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const activeTab = useMemo(() => {
    const found = tabs.find((tab) => tab.id === activeTabId)
    /* v8 ignore next -- fallback only reachable if caller passes an invalid activeTabId */
    if (!found) {
      console.warn(`[useDynamicTabs] activeTabId "${activeTabId}" not found in tabs — falling back to tabs[0]`)
    }
    return found ?? tabs[0]
  }, [activeTabId, tabs])

  const handleCreateNote = () => {
    const nextId = `${prefix}-note-${noteIdCounter.current}`
    noteIdCounter.current += 1

    setTabs((currentTabs) => [
      ...currentTabs,
      { id: nextId, label: 'New Note', kind: 'note' }
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

      if (activeTabIdRef.current === tabId) {
        const fallbackTab = currentTabs[tabIndex - 1] ?? currentTabs[tabIndex + 1] ?? remainingTabs[0]
        setActiveTabId(fallbackTab?.id ?? baseTabId)
      }

      return remainingTabs
    })
  }

  const handleRenameTab = (tabId: string, label: string) => {
    setTabs((currentTabs) =>
      currentTabs.map((tab) => (tab.id === tabId ? { ...tab, label } : tab))
    )
  }

  return {
    tabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    handleCreateNote,
    handleCloseTab,
    handleRenameTab
  }
}
