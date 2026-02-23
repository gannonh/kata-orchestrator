import { useEffect, useMemo, useState } from 'react'

import { mockSpaces, type MockSpace } from '../../mock/spaces'
import { CreateSpacePanel } from './CreateSpacePanel'
import { SpacesListPanel } from './SpacesListPanel'

type HomeSpacesScreenProps = {
  onOpenSpace: (spaceId: string) => void
  initialSpaces?: MockSpace[]
}

type Mode = 'team' | 'single'

function groupSpacesByRepo(spaces: MockSpace[]): Array<{ repo: string; spaces: MockSpace[] }> {
  const grouped = new Map<string, MockSpace[]>()

  spaces.forEach((space) => {
    const group = grouped.get(space.repo)
    if (group) {
      group.push(space)
      return
    }
    grouped.set(space.repo, [space])
  })

  return [...grouped.entries()].map(([repo, repoSpaces]) => ({ repo, spaces: repoSpaces }))
}

export function HomeSpacesScreen({ onOpenSpace, initialSpaces = mockSpaces }: HomeSpacesScreenProps) {
  const [isCreatePanelActive, setIsCreatePanelActive] = useState(false)
  const [spacePrompt, setSpacePrompt] = useState('')
  const [selectedMode, setSelectedMode] = useState<Mode>('team')
  const [rapidFire, setRapidFire] = useState(false)
  const [groupByRepo, setGroupByRepo] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [spaces, setSpaces] = useState(initialSpaces)
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(initialSpaces.find((space) => !space.archived)?.id ?? null)

  const visibleSpaces = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return spaces.filter((space) => {
      if (!showArchived && space.archived) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return space.name.toLowerCase().includes(normalizedQuery) || space.repo.toLowerCase().includes(normalizedQuery)
    })
  }, [searchQuery, showArchived, spaces])

  useEffect(() => {
    if (selectedSpaceId && visibleSpaces.some((space) => space.id === selectedSpaceId)) {
      return
    }

    setSelectedSpaceId(visibleSpaces[0]?.id ?? null)
  }, [selectedSpaceId, visibleSpaces])

  const groups = useMemo(() => {
    if (!groupByRepo) {
      return [{ repo: 'All spaces', spaces: visibleSpaces }]
    }

    return groupSpacesByRepo(visibleSpaces)
  }, [groupByRepo, visibleSpaces])

  const selectedSpace = useMemo(() => {
    if (!spaces.length) {
      return null
    }

    if (!selectedSpaceId) {
      return spaces[0]
    }

    return spaces.find((space) => space.id === selectedSpaceId) ?? spaces[0]
  }, [selectedSpaceId, spaces])

  const handleCreateSpace = () => {
    const trimmedPrompt = spacePrompt.trim()

    const nextSpace: MockSpace = {
      id: `space-${Date.now()}`,
      name: trimmedPrompt || 'Untitled space',
      repo: selectedSpace?.repo ?? 'gannonh/kata-cloud',
      branch: selectedSpace?.branch ?? 'main',
      elapsed: 'now',
      archived: false,
      status: 'active'
    }

    setSpaces((current) => [nextSpace, ...current])
    setSelectedSpaceId(nextSpace.id)
    setSpacePrompt('')
    setIsCreatePanelActive(false)
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <section className="mx-auto flex h-full w-full max-w-7xl flex-col px-8 py-8">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Open selected space"
            disabled={!selectedSpaceId}
            onClick={selectedSpaceId ? () => onOpenSpace(selectedSpaceId) : undefined}
          >
            Open selected space
          </button>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <CreateSpacePanel
            isActive={isCreatePanelActive}
            prompt={spacePrompt}
            selectedMode={selectedMode}
            rapidFire={rapidFire}
            repoName={selectedSpace?.repo ?? 'gannonh/kata-cloud'}
            branchName={selectedSpace?.branch ?? 'main'}
            onPromptChange={setSpacePrompt}
            onPromptFocus={() => {
              setIsCreatePanelActive(true)
            }}
            onSelectMode={setSelectedMode}
            onToggleRapidFire={() => {
              setRapidFire((current) => !current)
            }}
            onCreateSpace={handleCreateSpace}
          />

          <SpacesListPanel
            groups={groups}
            selectedSpaceId={selectedSpaceId}
            searchQuery={searchQuery}
            groupByRepo={groupByRepo}
            showArchived={showArchived}
            onSearchChange={setSearchQuery}
            onToggleGroupByRepo={() => {
              setGroupByRepo((current) => !current)
            }}
            onToggleShowArchived={() => {
              setShowArchived((current) => !current)
            }}
            onSelectSpace={setSelectedSpaceId}
          />
        </div>
      </section>
    </main>
  )
}
