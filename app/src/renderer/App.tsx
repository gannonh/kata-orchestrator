import { useState } from 'react'

import { HomeSpacesScreen } from './components/home/HomeSpacesScreen'
import { AppShell } from './components/layout/AppShell'

export function App() {
  const [appView, setAppView] = useState<'workspace' | 'home'>('workspace')
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)

  if (appView === 'home') {
    return (
      <HomeSpacesScreen
        onOpenSpace={(spaceId) => {
          setActiveSpaceId(spaceId)
          setAppView('workspace')
        }}
      />
    )
  }

  return (
    <AppShell
      activeSpaceId={activeSpaceId}
      onOpenHome={() => {
        setAppView('home')
      }}
    />
  )
}
