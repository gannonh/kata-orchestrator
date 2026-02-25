import { useMemo, useState } from 'react'

import { mockSpaces, type DisplaySpace } from '../../mock/spaces'
import { CreateSpacePanel } from './CreateSpacePanel'
import { SpacesListPanel } from './SpacesListPanel'

type HomeSpacesScreenProps = {
  onOpenSpace: (spaceId: string) => void
  initialSpaces?: DisplaySpace[]
}

type Mode = 'team' | 'single'

// Groups spaces by repository, normalizing the repo key to lowercase so that
// differently-cased repo strings (e.g. 'MyOrg/repo' vs 'myorg/repo') land in
// the same group. The display name preserves the first occurrence's casing.
function groupSpacesByRepo(spaces: DisplaySpace[]): Array<{ repo: string; spaces: DisplaySpace[] }> {
  const grouped = new Map<string, { repo: string; spaces: DisplaySpace[] }>()

  for (const space of spaces) {
    const key = space.repo.toLowerCase()
    const existing = grouped.get(key)
    if (existing) {
      existing.spaces.push(space)
    } else {
      grouped.set(key, { repo: space.repo, spaces: [space] })
    }
  }

  return [...grouped.values()]
}

export function HomeSpacesScreen({ onOpenSpace, initialSpaces = mockSpaces }: HomeSpacesScreenProps) {
  // TODO(KAT-65): Replace mockSpaces default with IPC/API data fetch.
  // When implementing: add loading state, error state, and empty state.
  // Remove the mockSpaces default from initialSpaces.
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

  // Derive the effective selected ID synchronously to avoid a double-render on every
  // filter change. When the user's selectedSpaceId is no longer in visibleSpaces
  // (e.g. search filtered it out), fall back to the first visible space.
  // The raw selectedSpaceId state is preserved so the selection restores when
  // the filter is cleared.
  const effectiveSelectedSpaceId = useMemo(() => {
    if (selectedSpaceId && visibleSpaces.some((space) => space.id === selectedSpaceId)) {
      return selectedSpaceId
    }
    return visibleSpaces[0]?.id ?? null
  }, [selectedSpaceId, visibleSpaces])

  const groups = useMemo(() => {
    if (!groupByRepo) {
      return [{ repo: 'All spaces', spaces: visibleSpaces }]
    }

    return groupSpacesByRepo(visibleSpaces)
  }, [groupByRepo, visibleSpaces])

  const selectedSpace = useMemo(() => {
    if (!effectiveSelectedSpaceId) {
      return null
    }
    // effectiveSelectedSpaceId is always derived from visibleSpaces ⊆ spaces,
    // so find() will always succeed when effectiveSelectedSpaceId is non-null.
    return spaces.find((space) => space.id === effectiveSelectedSpaceId) ?? null
  }, [effectiveSelectedSpaceId, spaces])

  function handleCreateSpace() {
    // TODO(KAT-65): Space creation is currently UI-only (no persistence).
    // When wiring persistence, replace this local state mutation with an IPC call
    // and surface errors to the user if the call fails.
    const nextSpace: DisplaySpace = {
      id: `space-${Date.now()}`,
      name: spacePrompt.trim() || 'Untitled space',
      repoUrl: selectedSpace?.repoUrl ?? 'https://github.com/gannonh/kata-cloud',
      rootPath: selectedSpace?.rootPath ?? '/Users/gannonh/dev/kata/kata-cloud',
      repo: selectedSpace?.repo ?? 'gannonh/kata-cloud',
      branch: selectedSpace?.branch ?? 'main',
      orchestrationMode: selectedSpace?.orchestrationMode ?? 'team',
      createdAt: new Date().toISOString(),
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
            disabled={!effectiveSelectedSpaceId}
            onClick={() => effectiveSelectedSpaceId && onOpenSpace(effectiveSelectedSpaceId)}
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
            selectedSpaceId={effectiveSelectedSpaceId}
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
