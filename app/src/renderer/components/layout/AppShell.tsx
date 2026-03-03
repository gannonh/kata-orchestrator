import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { LeftPanel } from './LeftPanel'
import { CenterPanel } from '../center/CenterPanel'
import { ChatPanel } from '../center/ChatPanel'
import { PanelResizer } from './PanelResizer'
import { RightPanel } from './RightPanel'
import type { LatestRunDraft } from '../../types/spec-document'

const RESIZER_WIDTH = 10
const LEFT_MIN = 320
const LEFT_COLLAPSED = 56
const LEFT_DEFAULT = 390
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

function getMaxLeftWidth(availableWidth: number): number {
  return Math.max(LEFT_MIN, Math.min(LEFT_MAX, availableWidth - RESIZER_WIDTH * 2 - DOCUMENT_MIN * 2))
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

export function AppShell({ activeSpaceId, activeSessionId, onOpenHome }: AppShellProps = {}) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)
  const [centerRightOffset, setCenterRightOffset] = useState(0)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [availableWidth, setAvailableWidth] = useState(1440)
  const activeSessionKey = activeSessionId ?? null
  const [latestDraftState, setLatestDraftState] = useState<{
    sessionId: string | null
    draft: LatestRunDraft | undefined
  }>({
    sessionId: activeSessionKey,
    draft: undefined
  })
  const [theme, setTheme] = useState<Theme>(() => {
    const persistedTheme = globalThis.localStorage?.getItem(THEME_STORAGE_KEY)
    return persistedTheme === 'light' || persistedTheme === 'dark' ? persistedTheme : 'dark'
  })

  useEffect(() => {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useLayoutEffect(() => {
    setLeftWidth((current) => {
      const maxLeft = getMaxLeftWidth(availableWidth)
      const next = clamp(current, LEFT_MIN, maxLeft)
      return next === current ? current : next
    })
  }, [availableWidth])

  useLayoutEffect(() => {
    const shellElement = shellRef.current
    if (!shellElement) {
      return
    }

    const updateWidth = (): void => {
      setAvailableWidth(shellElement.clientWidth)
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
      setAvailableWidth(entry?.contentRect.width ?? shellElement.clientWidth)
    })
    observer.observe(shellElement)

    return () => {
      observer.disconnect()
    }
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
      setLeftWidth((current) => clamp(current + deltaX, LEFT_MIN, getMaxLeftWidth(availableWidth)))
    },
    [availableWidth]
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
          collapsed={leftCollapsed}
          onCollapsedChange={setLeftCollapsed}
          theme={theme}
          onToggleTheme={() => {
            setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
          }}
          onOpenHome={onOpenHome}
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
            onLatestDraftChange={handleLatestDraftChange}
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
          />
        </aside>
      </section>
    </main>
  )
}
