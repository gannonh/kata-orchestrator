import { useEffect, useMemo, useState } from 'react'

import type { CreateSpaceInput, OrchestrationMode, WorkspaceMode } from '@shared/types/space'
import { mockSpaces, toDisplaySpace, type DisplaySpace } from '../../mock/spaces'
import { CreateSpacePanel } from './CreateSpacePanel'
import { SpacesListPanel } from './SpacesListPanel'

type HomeSpacesScreenProps = {
  onOpenSpace: (spaceId: string) => void
  initialSpaces?: DisplaySpace[]
}

type Mode = OrchestrationMode

type CreateDisplaySpaceForHomeInput = {
  prompt: string
  selectedSpace: DisplaySpace | null
  selectedMode: Mode
  workspaceMode: WorkspaceMode
  workspacePath: string
  now?: Date
}

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

export function createDisplaySpaceForHome({
  prompt,
  selectedSpace,
  selectedMode,
  workspaceMode,
  workspacePath,
  now = new Date()
}: CreateDisplaySpaceForHomeInput): DisplaySpace {
  return {
    id: `space-${now.getTime()}`,
    name: prompt.trim() || 'Untitled space',
    repoUrl: selectedSpace?.repoUrl ?? '',
    rootPath: workspaceMode === 'external' ? workspacePath.trim() || selectedSpace?.rootPath || '' : '',
    repo: selectedSpace?.repo ?? '',
    branch: selectedSpace?.branch ?? '',
    workspaceMode,
    orchestrationMode: selectedMode,
    createdAt: now.toISOString(),
    elapsed: 'now',
    archived: false,
    status: 'active'
  }
}

export function HomeSpacesScreen({ onOpenSpace, initialSpaces = mockSpaces }: HomeSpacesScreenProps) {
  const [isCreatePanelActive, setIsCreatePanelActive] = useState(false)
  const [spacePrompt, setSpacePrompt] = useState('')
  const [selectedMode, setSelectedMode] = useState<Mode>('team')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('managed')
  const [workspacePath, setWorkspacePath] = useState('')
  const [rapidFire, setRapidFire] = useState(false)
  const [groupByRepo, setGroupByRepo] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [spaces, setSpaces] = useState(initialSpaces)
  const [createError, setCreateError] = useState<string | null>(null)
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(initialSpaces.find((space) => !space.archived)?.id ?? null)

  useEffect(() => {
    let cancelled = false

    const loadSpaces = async () => {
      try {
        const records = await window.kata?.spaceList?.()
        if (!records || cancelled) {
          return
        }

        const fetchedSpaces = records.map(toDisplaySpace)
        setSpaces(fetchedSpaces)
        setSelectedSpaceId((current) => {
          if (current && fetchedSpaces.some((space) => space.id === current)) {
            return current
          }
          return fetchedSpaces.find((space) => !space.archived)?.id ?? fetchedSpaces[0]?.id ?? null
        })
      } catch (error) {
        console.error('[HomeSpacesScreen] spaceList IPC failed:', error)
      }
    }

    void loadSpaces()

    return () => {
      cancelled = true
    }
  }, [])

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

  useEffect(() => {
    if (workspaceMode === 'external' && !workspacePath && selectedSpace?.rootPath) {
      setWorkspacePath(selectedSpace.rootPath)
    }
  }, [selectedSpace, workspaceMode, workspacePath])

  async function handleCreateSpace() {
    setCreateError(null)

    const spaceCreate = window.kata?.spaceCreate
    if (!spaceCreate) {
      setCreateError('Create Space is only available in the desktop app (IPC unavailable).')
      return
    }

    const createInput: CreateSpaceInput = {
      name: spacePrompt.trim() || 'Untitled space',
      repoUrl: selectedSpace?.repoUrl ?? '',
      branch: selectedSpace?.branch ?? '',
      workspaceMode,
      ...(workspaceMode === 'external'
        ? { rootPath: workspacePath.trim() || selectedSpace?.rootPath || '' }
        : {}),
      orchestrationMode: selectedMode
    }

    try {
      const createdRecord = await spaceCreate(createInput)
      const nextSpace = toDisplaySpace(createdRecord)

      setSpaces((current) => [nextSpace, ...current.filter((space) => space.id !== nextSpace.id)])
      setSelectedSpaceId(nextSpace.id)
      setSpacePrompt('')
      setIsCreatePanelActive(false)
    } catch (error) {
      console.error('[HomeSpacesScreen] spaceCreate IPC failed:', error)
      const message = error instanceof Error ? error.message : String(error)
      setCreateError(message || 'Failed to create space.')
    }
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
            workspaceMode={workspaceMode}
            workspacePath={workspacePath}
            rapidFire={rapidFire}
            repoName={selectedSpace?.repo ?? 'gannonh/kata-cloud'}
            branchName={selectedSpace?.branch ?? 'main'}
            createError={createError}
            onPromptChange={setSpacePrompt}
            onPromptFocus={() => {
              setIsCreatePanelActive(true)
            }}
            onSelectMode={setSelectedMode}
            onSelectWorkspaceMode={setWorkspaceMode}
            onWorkspacePathChange={setWorkspacePath}
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
