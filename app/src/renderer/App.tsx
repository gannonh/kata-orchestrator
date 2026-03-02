import { useCallback, useState } from 'react'

import { HomeSpacesScreen } from './components/home/HomeSpacesScreen'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/shared/ErrorBoundary'

export function App() {
  const [appView, setAppView] = useState<'workspace' | 'home'>('home')
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const handleOpenSpace = useCallback((spaceId: string) => {
    setActiveSpaceId(spaceId)
    setActiveSessionId(null)
    setAppView('workspace')

    window.kata?.sessionCreate?.({ spaceId, label: 'Chat' })
      .then((session) => setActiveSessionId(session.id))
      .catch(() => {
        // Session creation failed — ChatPanel stays inert until retry
      })
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
