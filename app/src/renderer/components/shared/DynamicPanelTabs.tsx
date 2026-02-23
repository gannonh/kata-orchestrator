import { useEffect, useRef, useState } from 'react'
import { Bot, FileText, Globe, Plus, Terminal, X } from 'lucide-react'

import { cn } from '../../lib/cn'
import { Input } from '../ui/input'

export type DynamicPanelTab = {
  id: string
  label: string
  kind: 'base' | 'note'
  closable: boolean
  renamable: boolean
}

type DynamicPanelTabsProps = {
  tabs: DynamicPanelTab[]
  activeTabId: string
  onActiveTabChange: (tabId: string) => void
  onCreateNote: () => void
  onCloseTab: (tabId: string) => void
  onRenameTab: (tabId: string, label: string) => void
  ariaLabel: string
  className?: string
}

export function DynamicPanelTabs({
  tabs,
  activeTabId,
  onActiveTabChange,
  onCreateNote,
  onCloseTab,
  onRenameTab,
  ariaLabel,
  className
}: DynamicPanelTabsProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (!editingTabId) {
      return
    }

    const input = inputRef.current
    /* v8 ignore start -- defensive for rapid unmount/remount around inline rename */
    if (!input) {
      return
    }
    /* v8 ignore stop */

    input.focus()
    input.select()
  }, [editingTabId])

  const beginRename = (tab: DynamicPanelTab) => {
    if (!tab.renamable) {
      return
    }
    setEditingTabId(tab.id)
    setEditingValue(tab.label)
  }

  const cancelRename = () => {
    setEditingTabId(null)
    setEditingValue('')
  }

  const commitRename = () => {
    /* v8 ignore start -- defensive guard for stale blur/keydown events */
    if (!editingTabId) {
      return
    }
    /* v8 ignore stop */

    const tab = tabs.find((candidate) => candidate.id === editingTabId)
    /* v8 ignore start -- defensive guard if edited tab disappears mid-commit */
    if (!tab || !tab.renamable) {
      cancelRename()
      return
    }
    /* v8 ignore stop */

    const nextLabel = editingValue.trim() || tab.label
    if (nextLabel !== tab.label) {
      onRenameTab(editingTabId, nextLabel)
    }

    cancelRename()
  }

  const handleMenuAction = (action: 'note' | 'agent' | 'terminal' | 'browser') => {
    if (action === 'note') {
      onCreateNote()
    }
    setIsMenuOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={cn('flex h-10 items-end gap-1 border-b border-border', className)}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto pl-0 pr-1"
      >
        {tabs.map((tab, tabIndex) => {
          const isActive = tab.id === activeTabId
          const isEditing = tab.id === editingTabId

          return (
            <div
              key={tab.id}
              data-first-tab={tabIndex === 0 ? 'true' : undefined}
              className={cn(
                'relative -mb-px flex h-9 shrink-0 items-center rounded-t-sm rounded-b-none border border-transparent border-b-0 text-sm',
                tabIndex === 0 ? '-ml-px rounded-tl-none' : null,
                isActive ? 'border-border bg-background text-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {isEditing ? (
                <Input
                  ref={inputRef}
                  aria-label={`Rename ${tab.label} tab`}
                  value={editingValue}
                  className="h-7 w-36 border-0 bg-transparent px-2 py-0 text-sm shadow-none focus-visible:ring-0"
                  onChange={(event) => {
                    setEditingValue(event.currentTarget.value)
                  }}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitRename()
                      return
                    }

                    if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelRename()
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className="flex h-9 max-w-52 items-center gap-1 px-2 pb-[3px] text-sm"
                  onMouseDown={(event) => {
                    if (event.button !== 0) {
                      return
                    }
                    event.preventDefault()
                    onActiveTabChange(tab.id)
                  }}
                  onDoubleClick={() => {
                    beginRename(tab)
                  }}
                >
                  <span className="text-xs text-muted-foreground">≡</span>
                  <span className="truncate">{tab.label}</span>
                </button>
              )}

              {tab.closable ? (
                <button
                  type="button"
                  aria-label={`Close ${tab.label} tab`}
                  className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (editingTabId === tab.id) {
                      cancelRename()
                    }
                    onCloseTab(tab.id)
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="relative shrink-0 pr-1">
        <button
          type="button"
          aria-label="New tab"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          onClick={() => {
            setIsMenuOpen((current) => !current)
          }}
        >
          <Plus className="h-4 w-4" />
        </button>

        {isMenuOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                handleMenuAction('agent')
              }}
            >
              <Bot className="h-4 w-4" />
              New Agent
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                handleMenuAction('note')
              }}
            >
              <FileText className="h-4 w-4" />
              New Note
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                handleMenuAction('terminal')
              }}
            >
              <Terminal className="h-4 w-4" />
              New Terminal
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                handleMenuAction('browser')
              }}
            >
              <Globe className="h-4 w-4" />
              New Browser
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
