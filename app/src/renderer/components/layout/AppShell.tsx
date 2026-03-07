import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { LeftPanel } from './LeftPanel'
import { CenterPanel } from '../center/CenterPanel'
import { ChatPanel } from '../center/ChatPanel'
import { PanelResizer } from './PanelResizer'
import { RightPanel } from './RightPanel'
import type { ScrollToMessage } from '../center/MessageList'
import type { ConversationEntry } from '../left/conversation-entry-index'
import { resolveLeftPanelMode } from '../left/left-panel-mode'
import type { LatestRunDraft } from '../../types/spec-document'
import type { TaskActivitySnapshot } from '@shared/types/task-tracking'

const RESIZER_WIDTH = 10
const LEFT_MIN_BUILD = 320
const LEFT_MIN_COORDINATOR = 320
const LEFT_COLLAPSED = 56
const LEFT_DEFAULT_BUILD = 390
const LEFT_DEFAULT_COORDINATOR = 390
const LEFT_MAX = 520
const DOCUMENT_MIN = 300
export const THEME_STORAGE_KEY = 'kata-theme'

type Theme = 'dark' | 'light'
type DocumentSplit = { center: number; right: number }
type AppShellProps = {
  activeSpaceId?: string | null
  activeSessionId?: string | null
  onOpenHome?: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getMaxLeftWidth(availableWidth: number, leftMin: number): number {
  return Math.max(leftMin, Math.min(LEFT_MAX, availableWidth - RESIZER_WIDTH * 2 - DOCUMENT_MIN * 2))
}

function clampCenterRightOffset(offset: number, documentWidth: number): number {
  if (documentWidth <= DOCUMENT_MIN * 2) {
    return 0
  }

  const maxOffset = documentWidth / 2 - DOCUMENT_MIN
  return clamp(offset, -maxOffset, maxOffset)
}

function getDocumentSplit(documentWidth: number, offset: number): DocumentSplit {
  if (documentWidth <= 0) {
    return { center: 0, right: 0 }
  }

  const clampedOffset = clampCenterRightOffset(offset, documentWidth)
  const center = Math.round(documentWidth / 2 + clampedOffset)
  return {
    center,
    right: Math.max(0, documentWidth - center)
  }
}

export function observeShellWidth(
  shellElement: HTMLDivElement | null,
  onWidthChange: (width: number) => void
): (() => void) | void {
  if (!shellElement) {
    return
  }

  const updateWidth = (): void => {
    onWidthChange(shellElement.clientWidth)
  }

  updateWidth()

  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', updateWidth)
    return () => {
      window.removeEventListener('resize', updateWidth)
    }
  }

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    onWidthChange(entry?.contentRect.width ?? shellElement.clientWidth)
  })
  observer.observe(shellElement)

  return () => {
    observer.disconnect()
  }
}

export function AppShell({ activeSpaceId, activeSessionId, onOpenHome }: AppShellProps = {}) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT_COORDINATOR)
  const [centerRightOffset, setCenterRightOffset] = useState(0)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [availableWidth, setAvailableWidth] = useState(1440)
  const [conversationEntries, setConversationEntries] = useState<ConversationEntry[]>([])
  const scrollToMessageRef = useRef<ScrollToMessage | null>(null)
  const activeSessionKey = activeSessionId ?? null
  const [latestDraftState, setLatestDraftState] = useState<{
    sessionId: string | null
    draft: LatestRunDraft | undefined
  }>({
    sessionId: activeSessionKey,
    draft: undefined
  })
  const [taskActivitySnapshotState, setTaskActivitySnapshotState] = useState<{
    sessionId: string | null
    snapshot: TaskActivitySnapshot | undefined
  }>({
    sessionId: activeSessionKey,
    snapshot: undefined
  })
  const [theme, setTheme] = useState<Theme>(() => {
    const persistedTheme = globalThis.localStorage?.getItem(THEME_STORAGE_KEY)
    return persistedTheme === 'light' || persistedTheme === 'dark' ? persistedTheme : 'dark'
  })
  const taskActivitySnapshot =
    taskActivitySnapshotState.sessionId === activeSessionKey
      ? taskActivitySnapshotState.snapshot
      : undefined
  const panelMode = resolveLeftPanelMode({ taskActivitySnapshot })
  const leftMin = panelMode === 'coordinator' ? LEFT_MIN_COORDINATOR : LEFT_MIN_BUILD
  const leftDefault = panelMode === 'coordinator' ? LEFT_DEFAULT_COORDINATOR : LEFT_DEFAULT_BUILD

  useEffect(() => {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useLayoutEffect(() => {
    setLeftWidth((current) => {
      const maxLeft = getMaxLeftWidth(availableWidth, leftMin)
      const next =
        current === LEFT_DEFAULT_BUILD || current === LEFT_DEFAULT_COORDINATOR
          ? clamp(leftDefault, leftMin, maxLeft)
          : clamp(current, leftMin, maxLeft)
      return next === current ? current : next
    })
  }, [availableWidth, leftDefault, leftMin])

  useLayoutEffect(() => {
    return observeShellWidth(shellRef.current, setAvailableWidth)
  }, [])

  const effectiveLeftWidth = leftCollapsed ? LEFT_COLLAPSED : leftWidth
  const leftResizerWidth = leftCollapsed ? 0 : RESIZER_WIDTH
  const documentWidth = Math.max(0, availableWidth - effectiveLeftWidth - leftResizerWidth - RESIZER_WIDTH)

  useLayoutEffect(() => {
    setCenterRightOffset((current) => {
      const next = clampCenterRightOffset(current, documentWidth)
      return next === current ? current : next
    })
  }, [documentWidth])

  const documentSplit = useMemo(
    () => getDocumentSplit(documentWidth, centerRightOffset),
    [documentWidth, centerRightOffset]
  )

  const handleLeftDelta = useCallback(
    (deltaX: number) => {
      setLeftWidth((current) => clamp(current + deltaX, leftMin, getMaxLeftWidth(availableWidth, leftMin)))
    },
    [availableWidth, leftMin]
  )

  const handleCenterRightDelta = useCallback(
    (deltaX: number) => {
      setCenterRightOffset((current) => clampCenterRightOffset(current + deltaX, documentWidth))
    },
    [documentWidth]
  )

  const handleCenterRightReset = useCallback(() => {
    setCenterRightOffset(0)
  }, [])

  const gridTemplateColumns = useMemo(
    () =>
      `${effectiveLeftWidth}px ${leftResizerWidth}px ${documentSplit.center}px ${RESIZER_WIDTH}px ${documentSplit.right}px`,
    [effectiveLeftWidth, leftResizerWidth, documentSplit.center, documentSplit.right]
  )
  const latestDraft =
    latestDraftState.sessionId === activeSessionKey
      ? latestDraftState.draft
      : undefined
  const handleLatestDraftChange = useCallback(
    (draft: LatestRunDraft | undefined) => {
      setLatestDraftState((current) => {
        if (current.sessionId === activeSessionKey && current.draft === draft) {
          return current
        }

        return {
          sessionId: activeSessionKey,
          draft
        }
      })
    },
    [activeSessionKey]
  )
  const handleTaskActivitySnapshotChange = useCallback(
    (snapshot: TaskActivitySnapshot | undefined) => {
      const snapshotSessionId = snapshot?.sessionId ?? activeSessionKey
      setTaskActivitySnapshotState((current) => {
        if (current.sessionId === snapshotSessionId && current.snapshot === snapshot) {
          return current
        }

        return {
          sessionId: snapshotSessionId,
          snapshot
        }
      })
    },
    [activeSessionKey]
  )
  const handleRegisterScrollToMessage = useCallback((nextScrollToMessage: ScrollToMessage) => {
    scrollToMessageRef.current = nextScrollToMessage
  }, [])

  const handleJumpToMessage = useCallback(
    (messageId: string) => {
      scrollToMessageRef.current?.(messageId)
    },
    []
  )

  return (
    <main
      data-testid="app-shell-root"
      data-active-space-id={activeSpaceId ?? ''}
      className="h-screen w-screen overflow-hidden bg-background text-foreground"
    >
      <section
        ref={shellRef}
        data-testid="app-shell-grid"
        style={{ gridTemplateColumns }}
        className="relative grid h-full bg-background transition-[grid-template-columns] duration-200 ease-linear"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-14 z-10 h-px bg-border"
        />

        <LeftPanel
          activeSpaceId={activeSpaceId}
          activeSessionId={activeSessionId}
          taskActivitySnapshot={taskActivitySnapshot}
          collapsed={leftCollapsed}
          onCollapsedChange={setLeftCollapsed}
          theme={theme}
          onToggleTheme={() => {
            setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
          }}
          onOpenHome={onOpenHome}
          conversationEntries={conversationEntries}
          onJumpToMessage={handleJumpToMessage}
        />

        {leftCollapsed ? (
          <div aria-hidden="true" />
        ) : (
          <PanelResizer
            label="Resize left panel"
            testId="left-resizer"
            lineAt="end"
            onDelta={handleLeftDelta}
          />
        )}

        <CenterPanel>
          <ChatPanel
            sessionId={activeSessionId ?? null}
            spaceId={activeSpaceId ?? null}
            onLatestDraftChange={handleLatestDraftChange}
            onTaskActivitySnapshotChange={handleTaskActivitySnapshotChange}
            onConversationEntriesChange={setConversationEntries}
            onRegisterScrollToMessage={handleRegisterScrollToMessage}
          />
        </CenterPanel>

        <PanelResizer
          label="Resize center-right divider"
          testId="right-resizer"
          lineAt="start"
          onDelta={handleCenterRightDelta}
          onReset={handleCenterRightReset}
        />

        <aside
          data-testid="right-panel"
          className="overflow-hidden bg-background"
        >
          <RightPanel
            spaceId={activeSpaceId ?? null}
            sessionId={activeSessionId ?? null}
            latestDraft={latestDraft}
            taskActivitySnapshot={taskActivitySnapshot}
            onTaskActivitySnapshotChange={handleTaskActivitySnapshotChange}
          />
        </aside>
      </section>
    </main>
  )
}
