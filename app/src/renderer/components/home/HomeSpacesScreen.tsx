import { useEffect, useMemo, useState } from 'react'

import type { CreateSpaceInput, WorkspaceMode } from '@shared/types/space'
import { mockSpaces, toDisplaySpace, type DisplaySpace } from '../../mock/spaces'
import { CreateSpacePanel } from './CreateSpacePanel'
import { SpacesListPanel } from './SpacesListPanel'

type HomeSpacesScreenProps = {
  onOpenSpace: (spaceId: string) => void
  initialSpaces?: DisplaySpace[]
}

type ProvisioningMethod = 'copy-local' | 'clone-github' | 'new-repo'

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

function extractRepoLabel(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '').replace(/\.git$/i, '')
  const segments = normalized.split(/[/:]/)
  return segments[segments.length - 1] || 'repo'
}

function deriveParentDirectory(value: string): string {
  const normalized = value.trim().replace(/[\\/]+$/, '')
  if (!normalized) {
    return ''
  }

  const lastSeparatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  if (lastSeparatorIndex <= 0) {
    return ''
  }

  if (/^[A-Za-z]:$/.test(normalized.slice(0, lastSeparatorIndex))) {
    return `${normalized.slice(0, lastSeparatorIndex)}\\`
  }

  return normalized.slice(0, lastSeparatorIndex)
}

export function HomeSpacesScreen({ onOpenSpace, initialSpaces = mockSpaces }: HomeSpacesScreenProps) {
  const [spaceNameOverride, setSpaceNameOverride] = useState('')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('managed')
  const [provisioningMethod, setProvisioningMethod] = useState<ProvisioningMethod>('copy-local')
  const [sourceLocalPath, setSourceLocalPath] = useState('')
  const [sourceRemoteUrl, setSourceRemoteUrl] = useState('')
  const [sourceBranch, setSourceBranch] = useState('')
  const [newRepoParentDir, setNewRepoParentDir] = useState('')
  const [newRepoFolderName, setNewRepoFolderName] = useState('')
  const [workspacePath, setWorkspacePath] = useState('')
  const [groupByRepo, setGroupByRepo] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [spaces, setSpaces] = useState(initialSpaces)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
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
    return spaces.find((space) => space.id === effectiveSelectedSpaceId) ?? null
  }, [effectiveSelectedSpaceId, spaces])

  const defaultRepoLabel = useMemo(() => {
    if (provisioningMethod === 'new-repo' && newRepoFolderName.trim()) {
      return newRepoFolderName.trim()
    }
    if (provisioningMethod === 'clone-github' && sourceRemoteUrl.trim()) {
      return extractRepoLabel(sourceRemoteUrl)
    }
    if (selectedSpace?.repo) {
      return extractRepoLabel(selectedSpace.repo)
    }
    if (selectedSpace?.repoUrl) {
      return extractRepoLabel(selectedSpace.repoUrl)
    }
    return 'repo'
  }, [newRepoFolderName, provisioningMethod, selectedSpace, sourceRemoteUrl])

  const defaultBranchName = selectedSpace?.branch || 'main'
  const derivedNewRepoParentDir = useMemo(
    () => deriveParentDirectory(selectedSpace?.rootPath ?? ''),
    [selectedSpace?.rootPath]
  )
  const derivedSpaceName = useMemo(() => defaultRepoLabel.trim() || 'repo', [defaultRepoLabel])
  const resolvedSpaceName = spaceNameOverride || derivedSpaceName

  const resolvedSourceLocalPath = sourceLocalPath.trim() || selectedSpace?.rootPath || ''
  const resolvedSourceRemoteUrl = sourceRemoteUrl.trim() || selectedSpace?.repoUrl || ''
  const resolvedSourceBranch = sourceBranch.trim() || defaultBranchName
  const resolvedExternalWorkspacePath = workspacePath.trim() || selectedSpace?.rootPath || ''
  const resolvedNewRepoParentDir = newRepoParentDir.trim() || derivedNewRepoParentDir
  const resolvedNewRepoFolderName = newRepoFolderName.trim() || defaultRepoLabel

  const validationError = useMemo(() => {
    if (workspaceMode === 'external') {
      return resolvedExternalWorkspacePath ? null : 'Workspace path is required.'
    }

    if (provisioningMethod === 'copy-local') {
      return resolvedSourceLocalPath ? null : 'Local repo path is required.'
    }
    if (provisioningMethod === 'clone-github') {
      return resolvedSourceRemoteUrl ? null : 'Remote repo URL is required.'
    }
    if (provisioningMethod === 'new-repo') {
      return resolvedNewRepoFolderName ? null : 'Source repo folder name is required.'
    }

    return null
  }, [
    provisioningMethod,
    resolvedExternalWorkspacePath,
    resolvedNewRepoFolderName,
    resolvedSourceLocalPath,
    resolvedSourceRemoteUrl,
    workspaceMode
  ])

  const canCreate = validationError === null

  const summaryLines = useMemo(() => {
    if (workspaceMode === 'external') {
      return [
        'Workspace ownership: existing folder/worktree.',
        `Branch: ${defaultBranchName}.`,
        `Editable files path: ${resolvedExternalWorkspacePath || '(required)'}.`
      ]
    }

    const sourceLine = provisioningMethod === 'copy-local'
      ? `Source repo action: copy local repo from ${resolvedSourceLocalPath || '(required)'} on branch ${resolvedSourceBranch}.`
      : provisioningMethod === 'clone-github'
        ? `Source repo action: clone ${resolvedSourceRemoteUrl || '(required)'} on branch ${resolvedSourceBranch}.`
        : `Source repo action: create at ${(resolvedNewRepoParentDir || '~/dev')}/${resolvedNewRepoFolderName} on branch ${defaultBranchName}.`

    return [
      'Workspace ownership: managed worktree.',
      sourceLine,
      'Editable files path: ~/.kata/workspaces/<repo>-<id>/repo.'
    ]
  }, [
    provisioningMethod,
    resolvedExternalWorkspacePath,
    resolvedNewRepoFolderName,
    resolvedNewRepoParentDir,
    resolvedSourceLocalPath,
    resolvedSourceBranch,
    resolvedSourceRemoteUrl,
    workspaceMode,
    defaultBranchName
  ])

  useEffect(() => {
    if (workspaceMode === 'external' && !workspacePath && selectedSpace?.rootPath) {
      setWorkspacePath(selectedSpace.rootPath)
    }
  }, [selectedSpace, workspaceMode, workspacePath])

  async function handleCreateSpace() {
    setCreateError(null)

    if (!canCreate) {
      setCreateError(validationError ?? 'Complete required fields before creating a space.')
      return
    }

    const spaceCreate = window.kata?.spaceCreate
    if (!spaceCreate) {
      setCreateError('Create Space is only available in the desktop app (IPC unavailable).')
      return
    }
    setIsCreating(true)

    const hasExplicitSpaceNameOverride = spaceNameOverride.trim().length > 0 && spaceNameOverride.trim() !== derivedSpaceName
    const externalBranch = selectedSpace?.branch ?? 'main'
    const managedBranch = provisioningMethod === 'copy-local' || provisioningMethod === 'clone-github'
      ? resolvedSourceBranch
      : (selectedSpace?.branch ?? 'main')

    const baseCreateInput = {
      repoUrl: selectedSpace?.repoUrl ?? '',
      branch: workspaceMode === 'external' ? externalBranch : managedBranch,
      orchestrationMode: 'team' as const,
      ...(hasExplicitSpaceNameOverride ? { spaceNameOverride: spaceNameOverride.trim() } : {})
    }

    const createInput: CreateSpaceInput = workspaceMode === 'external'
      ? {
          ...baseCreateInput,
          name: resolvedSpaceName,
          workspaceMode: 'external',
          rootPath: resolvedExternalWorkspacePath
        }
      : provisioningMethod === 'copy-local'
        ? {
            ...baseCreateInput,
            workspaceMode: 'managed',
            provisioningMethod: 'copy-local',
            sourceLocalPath: resolvedSourceLocalPath
          }
        : provisioningMethod === 'clone-github'
          ? {
              ...baseCreateInput,
              workspaceMode: 'managed',
              provisioningMethod: 'clone-github',
              sourceRemoteUrl: resolvedSourceRemoteUrl
            }
          : {
              ...baseCreateInput,
              workspaceMode: 'managed',
              provisioningMethod: 'new-repo',
              newRepoParentDir: resolvedNewRepoParentDir,
              newRepoFolderName: resolvedNewRepoFolderName
            }

    try {
      const createdRecord = await spaceCreate(createInput)
      const nextSpace = toDisplaySpace(createdRecord)

      setSpaces((current) => [nextSpace, ...current.filter((space) => space.id !== nextSpace.id)])
      setSelectedSpaceId(nextSpace.id)
      setSpaceNameOverride('')
    } catch (error) {
      console.error('[HomeSpacesScreen] spaceCreate IPC failed:', error)
      const message = error instanceof Error ? error.message : String(error)
      setCreateError(message || 'Failed to create space.')
    } finally {
      setIsCreating(false)
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
            spaceName={resolvedSpaceName}
            workspaceMode={workspaceMode}
            provisioningMethod={provisioningMethod}
            sourceLocalPath={sourceLocalPath}
            sourceRemoteUrl={sourceRemoteUrl}
            sourceBranch={sourceBranch || defaultBranchName}
            newRepoParentDir={newRepoParentDir || derivedNewRepoParentDir}
            newRepoFolderName={newRepoFolderName}
            workspacePath={workspacePath}
            createError={createError}
            canCreate={canCreate}
            isCreating={isCreating}
            summaryLines={summaryLines}
            onSpaceNameChange={setSpaceNameOverride}
            onSelectWorkspaceMode={setWorkspaceMode}
            onSelectProvisioningMethod={setProvisioningMethod}
            onSourceLocalPathChange={setSourceLocalPath}
            onSourceRemoteUrlChange={setSourceRemoteUrl}
            onSourceBranchChange={setSourceBranch}
            onNewRepoParentDirChange={setNewRepoParentDir}
            onNewRepoFolderNameChange={setNewRepoFolderName}
            onWorkspacePathChange={setWorkspacePath}
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
