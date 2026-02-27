import { useState } from 'react'

import { HomeSpacesScreen } from './components/home/HomeSpacesScreen'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/shared/ErrorBoundary'

export function App() {
  const [appView, setAppView] = useState<'workspace' | 'home'>('home')
  // TODO(KAT-65): activeSpaceId will be used to load space data via IPC. Currently stub-only.
  // When wiring: add loading state and error handling if the space cannot be found.
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)

  function handleOpenSpace(spaceId: string) {
    setActiveSpaceId(spaceId)
    setAppView('workspace')
  }

  function handleOpenHome() {
    setAppView('home')
  }

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
      onOpenHome={handleOpenHome}
    />
  )
}
