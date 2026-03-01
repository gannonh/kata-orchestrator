type Repo = { name: string; nameWithOwner: string; url: string }

type GitHubRepoPickerProps = {
  repos: Repo[]
  selectedRepo: Repo | null
  onRepoSelect: (repo: Repo) => void
  isLoadingRepos: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  branches: string[]
  selectedBranch: string
  onBranchChange: (branch: string) => void
  isLoadingBranches: boolean
  error: string | null
  onFallbackUrlChange: (url: string) => void
  showFallbackUrl: boolean
}

export function GitHubRepoPicker({
  repos,
  selectedRepo,
  onRepoSelect,
  isLoadingRepos,
  searchQuery,
  onSearchChange,
  branches,
  selectedBranch,
  onBranchChange,
  isLoadingBranches,
  error,
  onFallbackUrlChange,
  showFallbackUrl
}: GitHubRepoPickerProps) {
  const query = searchQuery.toLowerCase()
  const filtered = query
    ? repos.filter((r) => r.nameWithOwner.toLowerCase().includes(query))
    : repos

  return (
    <div className="mt-3 space-y-2">
      <label className="mb-1 block text-xs text-foreground" htmlFor="github-search">
        Search repos
      </label>
      <input
        id="github-search"
        type="text"
        aria-label="Search repos"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Filter repositories..."
        className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
      />

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {showFallbackUrl && (
        <div>
          <label className="mb-1 block text-xs text-foreground" htmlFor="fallback-url">
            Repository URL
          </label>
          <input
            id="fallback-url"
            type="text"
            aria-label="Repository URL"
            onChange={(e) => onFallbackUrlChange(e.target.value)}
            placeholder="https://github.com/org/repo.git"
            className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
          />
        </div>
      )}

      {isLoadingRepos && (
        <p className="text-xs text-muted-foreground">Loading repos...</p>
      )}

      {!isLoadingRepos && !error && filtered.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {filtered.map((repo) => (
            <li key={repo.nameWithOwner}>
              <button
                type="button"
                aria-pressed={selectedRepo?.nameWithOwner === repo.nameWithOwner}
                onClick={() => onRepoSelect(repo)}
                className="w-full rounded-md border border-border/70 px-2 py-1.5 text-left text-xs hover:bg-muted/40 aria-pressed:border-foreground aria-pressed:text-foreground"
              >
                {repo.nameWithOwner}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedRepo && !error && isLoadingBranches && (
        <p className="text-xs text-muted-foreground">Loading branches...</p>
      )}

      {selectedRepo && !error && !isLoadingBranches && branches.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-foreground" htmlFor="github-branch-picker">
            Branch
          </label>
          <select
            id="github-branch-picker"
            aria-label="Branch"
            value={selectedBranch}
            onChange={(e) => onBranchChange(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
          >
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
