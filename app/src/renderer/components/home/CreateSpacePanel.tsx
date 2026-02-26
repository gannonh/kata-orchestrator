import type { WorkspaceMode } from '@shared/types/space'

type ProvisioningMethod = 'copy-local' | 'clone-github' | 'new-repo'

type CreateSpacePanelProps = {
  spaceName: string
  workspaceMode: WorkspaceMode
  provisioningMethod: ProvisioningMethod
  sourceLocalPath: string
  sourceRemoteUrl: string
  sourceBranch: string
  newRepoParentDir: string
  newRepoFolderName: string
  workspacePath: string
  createError: string | null
  canCreate: boolean
  isCreating: boolean
  summaryLines: string[]
  onSpaceNameChange: (value: string) => void
  onSelectWorkspaceMode: (mode: WorkspaceMode) => void
  onSelectProvisioningMethod: (method: ProvisioningMethod) => void
  onSourceLocalPathChange: (value: string) => void
  onSourceRemoteUrlChange: (value: string) => void
  onSourceBranchChange: (value: string) => void
  onNewRepoParentDirChange: (value: string) => void
  onNewRepoFolderNameChange: (value: string) => void
  onWorkspacePathChange: (value: string) => void
  onCreateSpace: () => void
}

export function CreateSpacePanel({
  spaceName,
  workspaceMode,
  provisioningMethod,
  sourceLocalPath,
  sourceRemoteUrl,
  sourceBranch,
  newRepoParentDir,
  newRepoFolderName,
  workspacePath,
  createError,
  canCreate,
  isCreating,
  summaryLines,
  onSpaceNameChange,
  onSelectWorkspaceMode,
  onSelectProvisioningMethod,
  onSourceLocalPathChange,
  onSourceRemoteUrlChange,
  onSourceBranchChange,
  onNewRepoParentDirChange,
  onNewRepoFolderNameChange,
  onWorkspacePathChange,
  onCreateSpace
}: CreateSpacePanelProps) {
  return (
    <section
      data-testid="create-space-panel"
      className="rounded-2xl border border-border/80 bg-card/60 p-6 shadow-sm"
    >
      <div className="rounded-lg border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Step 1 · Where work happens</p>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Choose the editable workspace location before configuring any repository source settings.
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <button
            type="button"
            aria-label="Use managed workspace"
            aria-pressed={workspaceMode === 'managed'}
            onClick={() => {
              onSelectWorkspaceMode('managed')
            }}
            className="rounded-md border px-2 py-2 text-left text-xs aria-pressed:border-foreground aria-pressed:text-foreground"
          >
            Managed workspace (worktree)
          </button>
          <button
            type="button"
            aria-label="Use my existing folder/worktree (developer-managed)"
            aria-pressed={workspaceMode === 'external'}
            onClick={() => {
              onSelectWorkspaceMode('external')
            }}
            className="rounded-md border px-2 py-2 text-left text-xs aria-pressed:border-foreground aria-pressed:text-foreground"
          >
            Existing folder/worktree
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Step 2 · Source setup</p>
        {workspaceMode === 'managed' ? (
          <>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Configure how the source repository is prepared before the managed worktree is created.
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              <button
                type="button"
                aria-label="Use copy local provisioning"
                aria-pressed={provisioningMethod === 'copy-local'}
                onClick={() => {
                  onSelectProvisioningMethod('copy-local')
                }}
                className="rounded-md border px-2 py-2 text-left text-xs aria-pressed:border-foreground aria-pressed:text-foreground"
              >
                Copy local repo
              </button>
              <button
                type="button"
                aria-label="Use clone github provisioning"
                aria-pressed={provisioningMethod === 'clone-github'}
                onClick={() => {
                  onSelectProvisioningMethod('clone-github')
                }}
                className="rounded-md border px-2 py-2 text-left text-xs aria-pressed:border-foreground aria-pressed:text-foreground"
              >
                Clone from GitHub
              </button>
              <button
                type="button"
                aria-label="Use new repo provisioning"
                aria-pressed={provisioningMethod === 'new-repo'}
                onClick={() => {
                  onSelectProvisioningMethod('new-repo')
                }}
                className="rounded-md border px-2 py-2 text-left text-xs aria-pressed:border-foreground aria-pressed:text-foreground"
              >
                Create new repo
              </button>
            </div>

            {provisioningMethod === 'copy-local' && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-foreground" htmlFor="copy-local-path-input">
                  Local repo path
                </label>
                <input
                  id="copy-local-path-input"
                  type="text"
                  aria-label="Local repo path"
                  value={sourceLocalPath}
                  onChange={(event) => {
                    onSourceLocalPathChange(event.target.value)
                  }}
                  placeholder="/Users/you/dev/my-repo"
                  className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
                />
                <label className="mb-1 mt-2 block text-xs text-foreground" htmlFor="copy-local-branch-input">
                  Branch
                </label>
                <input
                  id="copy-local-branch-input"
                  type="text"
                  aria-label="Branch"
                  value={sourceBranch}
                  onChange={(event) => {
                    onSourceBranchChange(event.target.value)
                  }}
                  placeholder="main"
                  className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
                />
              </div>
            )}

            {provisioningMethod === 'clone-github' && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-foreground" htmlFor="clone-url-input">
                  Remote repo URL
                </label>
                <input
                  id="clone-url-input"
                  type="text"
                  aria-label="Remote repo URL"
                  value={sourceRemoteUrl}
                  onChange={(event) => {
                    onSourceRemoteUrlChange(event.target.value)
                  }}
                  placeholder="https://github.com/org/repo.git"
                  className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
                />
                <label className="mb-1 mt-2 block text-xs text-foreground" htmlFor="clone-branch-input">
                  Branch
                </label>
                <input
                  id="clone-branch-input"
                  type="text"
                  aria-label="Branch"
                  value={sourceBranch}
                  onChange={(event) => {
                    onSourceBranchChange(event.target.value)
                  }}
                  placeholder="main"
                  className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
                />
              </div>
            )}

            {provisioningMethod === 'new-repo' && (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-foreground" htmlFor="new-repo-parent-input">
                    Source repo parent directory
                  </label>
                  <input
                    id="new-repo-parent-input"
                    type="text"
                    aria-label="Source repo parent directory"
                    value={newRepoParentDir}
                    onChange={(event) => {
                      onNewRepoParentDirChange(event.target.value)
                    }}
                    placeholder="/Users/you/dev"
                    className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-foreground" htmlFor="new-repo-folder-input">
                    Source repo folder name
                  </label>
                  <input
                    id="new-repo-folder-input"
                    type="text"
                    aria-label="Source repo folder name"
                    value={newRepoFolderName}
                    onChange={(event) => {
                      onNewRepoFolderNameChange(event.target.value)
                    }}
                    placeholder="my-new-repo"
                    className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mt-1">
            <label className="mb-1 block text-xs text-foreground" htmlFor="workspace-path-input">
              Workspace path
            </label>
            <input
              id="workspace-path-input"
              type="text"
              aria-label="Workspace path"
              value={workspacePath}
              onChange={(event) => {
                onWorkspacePathChange(event.target.value)
              }}
              placeholder="/Users/you/dev/my-repo"
              className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
            />
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">Step 3 · Space name</p>
        <label className="mb-1 block text-xs text-foreground" htmlFor="space-name-input">
          Space name
        </label>
        <input
          id="space-name-input"
          type="text"
          aria-label="Space name"
          value={spaceName}
          onChange={(event) => {
            onSpaceNameChange(event.target.value)
          }}
          className="h-8 w-full rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
        />
      </div>

      <div className="mt-4 rounded-lg border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">Step 4 · Review and create</p>
        <ul className="space-y-1">
          {summaryLines.map((line) => (
            <li key={line} className="leading-relaxed text-[11px] text-muted-foreground">
              {line}
            </li>
          ))}
        </ul>
        {createError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {createError}
          </p>
        )}
        <button
          type="button"
          aria-label="Create space"
          disabled={!canCreate || isCreating}
          className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onCreateSpace}
        >
          {isCreating ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-white" />
              Creating space...
            </span>
          ) : 'Create space'}
        </button>
      </div>
    </section>
  )
}
