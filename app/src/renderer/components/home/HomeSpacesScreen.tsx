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
type Repo = { name: string; nameWithOwner: string; url: string }

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
  const segments = normalized.split(/[/:\\]/)
  return segments[segments.length - 1] || 'repo'
}

export function HomeSpacesScreen({ onOpenSpace, initialSpaces = mockSpaces }: HomeSpacesScreenProps) {
  // Workspace / provisioning selection
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('managed')
  const [provisioningMethod, setProvisioningMethod] = useState<ProvisioningMethod>('copy-local')

  // RepoPathPicker state (copy-local + external)
  const [repoPath, setRepoPath] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const [repoPathError, setRepoPathError] = useState<string | null>(null)

  // GitHubRepoPicker state (clone-github)
  const [githubRepos, setGithubRepos] = useState<Repo[]>([])
  const [selectedGithubRepo, setSelectedGithubRepo] = useState<Repo | null>(null)
  const [githubSearchQuery, setGithubSearchQuery] = useState('')
  const [githubBranches, setGithubBranches] = useState<string[]>([])
  const [selectedGithubBranch, setSelectedGithubBranch] = useState('')
  const [isLoadingGithubRepos, setIsLoadingGithubRepos] = useState(false)
  const [isLoadingGithubBranches, setIsLoadingGithubBranches] = useState(false)
  const [githubError, setGithubError] = useState<string | null>(null)
  const [showGithubFallbackUrl, setShowGithubFallbackUrl] = useState(false)

  // New repo state
  const [newRepoParentDir, setNewRepoParentDir] = useState('')
  const [newRepoFolderName, setNewRepoFolderName] = useState('')

  // External workspace path
  const [workspacePath, setWorkspacePath] = useState('')

  // Space list state
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

  // Auto-generated name preview (repo label only — server generates the nanoid suffix)
  const autoGeneratedName = useMemo(() => {
    if (workspaceMode === 'external' && repoPath) {
      return extractRepoLabel(repoPath)
    }
    if (provisioningMethod === 'copy-local' && repoPath) {
      return extractRepoLabel(repoPath)
    }
    if (provisioningMethod === 'clone-github' && selectedGithubRepo) {
      return selectedGithubRepo.name
    }
    if (provisioningMethod === 'new-repo' && newRepoFolderName.trim()) {
      return newRepoFolderName.trim()
    }
    return 'repo'
  }, [workspaceMode, provisioningMethod, repoPath, selectedGithubRepo, newRepoFolderName])

  const canCreate = useMemo(() => {
    if (workspaceMode === 'external') {
      return repoPath.length > 0
    }
    if (provisioningMethod === 'copy-local') {
      return repoPath.length > 0
    }
    if (provisioningMethod === 'clone-github') {
      return selectedGithubRepo !== null
    }
    return newRepoFolderName.trim().length > 0
  }, [workspaceMode, provisioningMethod, repoPath, selectedGithubRepo, newRepoFolderName])

  const summaryLines = useMemo(() => {
    const branch = selectedBranch || 'main'
    if (workspaceMode === 'external') {
      return [
        'Workspace ownership: existing folder/worktree.',
        `Branch: ${branch}.`,
        `Editable files path: ${repoPath || '(required)'}.`
      ]
    }

    const sourceLine = provisioningMethod === 'copy-local'
      ? `Source repo action: copy local repo from ${repoPath || '(required)'} on branch ${branch}.`
      : provisioningMethod === 'clone-github'
        ? `Source repo action: clone ${selectedGithubRepo?.url || '(required)'} on branch ${selectedGithubBranch || 'main'}.`
        : `Source repo action: create at ${newRepoParentDir || '~/dev'}/${newRepoFolderName || '(required)'} on branch main.`

    return [
      'Workspace ownership: managed worktree.',
      sourceLine,
      'Editable files path: ~/.kata/workspaces/<repo>-<id>/repo.'
    ]
  }, [provisioningMethod, repoPath, selectedBranch, selectedGithubRepo, selectedGithubBranch, newRepoParentDir, newRepoFolderName, workspaceMode])

  async function handleBrowse() {
    const dialogOpenDirectory = window.kata?.dialogOpenDirectory
    if (!dialogOpenDirectory) {
      return
    }

    try {
      const result = await dialogOpenDirectory()
      if (!result?.path) {
        return
      }

      setRepoPath(result.path)
      setRepoPathError(null)

      setIsLoadingBranches(true)
      try {
        const branchList = await window.kata?.gitListBranches?.(result.path) ?? []
        setBranches(branchList)
        if (branchList.length > 0) {
          setSelectedBranch(branchList[0])
        }
      } catch {
        setBranches([])
      } finally {
        setIsLoadingBranches(false)
      }
    } catch {
      setRepoPathError('Failed to open directory picker.')
    }
  }

  function handleGithubRepoSelect(repo: Repo) {
    setSelectedGithubRepo(repo)
    setGithubBranches([])
    setSelectedGithubBranch('')
    setIsLoadingGithubBranches(true)

    const owner = repo.nameWithOwner.split('/')[0]
    const name = repo.name

    window.kata?.githubListBranches?.(owner!, name)
      .then((branchList) => {
        setGithubBranches(branchList ?? [])
        if (branchList?.length) {
          setSelectedGithubBranch(branchList[0])
        }
      })
      .catch(() => {
        setGithubBranches([])
      })
      .finally(() => {
        setIsLoadingGithubBranches(false)
      })
  }

  function handleGithubSearchChange(query: string) {
    setGithubSearchQuery(query)

    if (!query.trim()) {
      return
    }

    setIsLoadingGithubRepos(true)
    setGithubError(null)

    window.kata?.githubListRepos?.()
      .then((repos) => {
        setGithubRepos(repos ?? [])
        setShowGithubFallbackUrl(false)
      })
      .catch(() => {
        setGithubError('GitHub CLI not available. Enter a URL instead.')
        setShowGithubFallbackUrl(true)
      })
      .finally(() => {
        setIsLoadingGithubRepos(false)
      })
  }

  async function handleCreateSpace() {
    setCreateError(null)

    const spaceCreate = window.kata?.spaceCreate
    if (!spaceCreate) {
      setCreateError('Create Space is only available in the desktop app (IPC unavailable).')
      return
    }
    setIsCreating(true)

    const branch = selectedBranch || 'main'

    const createInput: CreateSpaceInput = workspaceMode === 'external'
      ? {
          repoUrl: repoPath,
          branch,
          workspaceMode: 'external',
          orchestrationMode: 'team',
          rootPath: repoPath
        }
      : provisioningMethod === 'copy-local'
        ? {
            repoUrl: repoPath,
            branch,
            workspaceMode: 'managed',
            orchestrationMode: 'team',
            provisioningMethod: 'copy-local',
            sourceLocalPath: repoPath
          }
        : provisioningMethod === 'clone-github'
          ? {
              repoUrl: selectedGithubRepo?.url ?? '',
              branch: selectedGithubBranch || 'main',
              workspaceMode: 'managed',
              orchestrationMode: 'team',
              provisioningMethod: 'clone-github',
              sourceRemoteUrl: selectedGithubRepo?.url ?? ''
            }
          : {
              repoUrl: '',
              branch: 'main',
              workspaceMode: 'managed',
              orchestrationMode: 'team',
              provisioningMethod: 'new-repo',
              newRepoParentDir: newRepoParentDir || '~/dev',
              newRepoFolderName
            }

    try {
      const createdRecord = await spaceCreate(createInput)
      const nextSpace = toDisplaySpace(createdRecord)

      setSpaces((current) => [nextSpace, ...current.filter((space) => space.id !== nextSpace.id)])
      setSelectedSpaceId(nextSpace.id)
      setRepoPath('')
      setBranches([])
      setSelectedBranch('')
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
            workspaceMode={workspaceMode}
            provisioningMethod={provisioningMethod}
            repoPath={repoPath}
            branches={branches}
            selectedBranch={selectedBranch}
            onBrowse={handleBrowse}
            onBranchChange={setSelectedBranch}
            isLoadingBranches={isLoadingBranches}
            repoPathError={repoPathError}
            githubRepos={githubRepos}
            selectedGithubRepo={selectedGithubRepo}
            onGithubRepoSelect={handleGithubRepoSelect}
            isLoadingGithubRepos={isLoadingGithubRepos}
            githubSearchQuery={githubSearchQuery}
            onGithubSearchChange={handleGithubSearchChange}
            githubBranches={githubBranches}
            selectedGithubBranch={selectedGithubBranch}
            onGithubBranchChange={setSelectedGithubBranch}
            isLoadingGithubBranches={isLoadingGithubBranches}
            githubError={githubError}
            showGithubFallbackUrl={showGithubFallbackUrl}
            onGithubFallbackUrlChange={() => {}}
            newRepoParentDir={newRepoParentDir}
            newRepoFolderName={newRepoFolderName}
            onNewRepoParentDirChange={setNewRepoParentDir}
            onNewRepoFolderNameChange={setNewRepoFolderName}
            workspacePath={workspacePath}
            onWorkspacePathChange={setWorkspacePath}
            autoGeneratedName={autoGeneratedName}
            createError={createError}
            canCreate={canCreate}
            isCreating={isCreating}
            summaryLines={summaryLines}
            onSelectWorkspaceMode={setWorkspaceMode}
            onSelectProvisioningMethod={setProvisioningMethod}
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
