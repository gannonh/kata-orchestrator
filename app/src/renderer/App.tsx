import { useCallback, useEffect, useState } from 'react'

import { HomeSpacesScreen } from './components/home/HomeSpacesScreen'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/shared/ErrorBoundary'

export function App() {
  const [appView, setAppView] = useState<'workspace' | 'home'>('home')
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    window.kata?.appBootstrap?.()
      .then((bootstrapState) => {
        if (!isMounted) {
          return
        }

        if (bootstrapState.activeSpaceId && bootstrapState.activeSessionId) {
          setActiveSpaceId(bootstrapState.activeSpaceId)
          setActiveSessionId(bootstrapState.activeSessionId)
          setAppView('workspace')
        }
      })
      .catch(() => {
        // Bootstrap failures should preserve default home startup behavior.
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleOpenSpace = useCallback((spaceId: string) => {
    setActiveSpaceId(spaceId)
    setActiveSessionId(null)
    setAppView('workspace')

    void (async () => {
      try {
        const setActiveResult = await window.kata?.spaceSetActive?.(spaceId)
        if (setActiveResult?.activeSessionId) {
          setActiveSessionId(setActiveResult.activeSessionId)
          return
        }

        const sessions = await window.kata?.sessionListBySpace?.({ spaceId })
        const latestSession = Array.isArray(sessions) ? sessions[0] : undefined
        if (latestSession?.id) {
          try {
            await window.kata?.sessionSetActive?.(latestSession.id)
          } catch {
            // Best-effort persist; keep local state if activation persistence fails.
          }
          setActiveSessionId(latestSession.id)
          return
        }

        const createdSession = await window.kata?.sessionCreate?.({ spaceId, label: 'Chat' })
        if (createdSession?.id) {
          setActiveSessionId(createdSession.id)
        }
      } catch {
        // Session restoration/creation failed — ChatPanel stays inert until retry.
      }
    })()
  }, [])

  const handleOpenHome = useCallback(() => {
    setAppView('home')
  }, [])

  if (appView === 'home') {
    return (
      <ErrorBoundary fallback={<p className="p-8 text-sm text-muted-foreground">Unable to load Home. Please restart the application.</p>}>
        <HomeSpacesScreen onOpenSpace={handleOpenSpace} />
      </ErrorBoundary>
    )
  }

  return (
    <AppShell
      activeSpaceId={activeSpaceId}
      activeSessionId={activeSessionId}
      onOpenHome={handleOpenHome}
    />
  )
}
