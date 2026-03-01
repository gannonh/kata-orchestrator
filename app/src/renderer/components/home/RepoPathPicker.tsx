type RepoPathPickerProps = {
  path: string
  onBrowse: () => void
  branches: string[]
  selectedBranch: string
  onBranchChange: (branch: string) => void
  isLoadingBranches: boolean
  error: string | null
}

export function RepoPathPicker({
  path,
  onBrowse,
  branches,
  selectedBranch,
  onBranchChange,
  isLoadingBranches,
  error
}: RepoPathPickerProps) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 truncate rounded-md border border-border bg-background/70 px-2 py-1.5 text-xs text-muted-foreground">
          {path || 'Select a directory...'}
        </div>
        <button
          type="button"
          aria-label="Browse"
          onClick={onBrowse}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
        >
          Browse
        </button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {path && !error && isLoadingBranches && (
        <p className="text-xs text-muted-foreground">Loading branches...</p>
      )}

      {path && !error && !isLoadingBranches && branches.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-foreground" htmlFor="branch-picker">
            Branch
          </label>
          <select
            id="branch-picker"
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

      {path && !error && !isLoadingBranches && branches.length === 0 && (
        <p className="text-xs text-muted-foreground">No branches found. Defaulting to main.</p>
      )}
    </div>
  )
}
