import { Globe, Pin, Timer, TrendingUp } from 'lucide-react'
import type { WorkspaceMode } from '@shared/types/space'

type CreateSpacePanelProps = {
  isActive: boolean
  prompt: string
  selectedMode: 'team' | 'single'
  workspaceMode: WorkspaceMode
  workspacePath: string
  rapidFire: boolean
  repoName: string
  branchName: string
  onPromptChange: (value: string) => void
  onPromptFocus: () => void
  onSelectMode: (mode: 'team' | 'single') => void
  onSelectWorkspaceMode: (mode: WorkspaceMode) => void
  onWorkspacePathChange: (value: string) => void
  onToggleRapidFire: () => void
  onCreateSpace: () => void
}

export function CreateSpacePanel({
  isActive,
  prompt,
  selectedMode,
  workspaceMode,
  workspacePath,
  rapidFire,
  repoName,
  branchName,
  onPromptChange,
  onPromptFocus,
  onSelectMode,
  onSelectWorkspaceMode,
  onWorkspacePathChange,
  onToggleRapidFire,
  onCreateSpace
}: CreateSpacePanelProps) {
  return (
    <section
      data-testid="create-space-panel"
      data-active={isActive ? 'true' : 'false'}
      className="rounded-2xl border border-border/80 bg-card/60 p-6 shadow-sm"
    >
      <h2 className="mb-4 text-xl font-semibold tracking-tight">Let&apos;s get building!</h2>

      <label className="sr-only" htmlFor="home-space-prompt">
        Space prompt
      </label>
      <textarea
        id="home-space-prompt"
        aria-label="Space prompt"
        value={prompt}
        onFocus={onPromptFocus}
        onClick={onPromptFocus}
        onChange={(event) => {
          onPromptChange(event.target.value)
        }}
        placeholder="What would you like to work on? Describe your goal or leave blank to start an empty space."
        className="min-h-28 w-full resize-y rounded-xl border border-border/80 bg-background/80 px-3 py-2 text-sm outline-none focus:border-ring"
      />

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          aria-label="Add context"
          className="rounded-md px-2 py-1 hover:bg-muted/50"
          onClick={onPromptFocus}
        >
          + Add context
        </button>
        <button
          type="button"
          className="rounded-md p-1.5 hover:bg-muted/50"
          aria-label="Attach web context"
          onClick={onPromptFocus}
        >
          <Globe className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded-md p-1.5 hover:bg-muted/50"
          aria-label="Attach timeline context"
          onClick={onPromptFocus}
        >
          <Timer className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded-md p-1.5 hover:bg-muted/50"
          aria-label="Attach metrics context"
          onClick={onPromptFocus}
        >
          <TrendingUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded-md p-1.5 hover:bg-muted/50"
          aria-label="Attach pinned context"
          onClick={onPromptFocus}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        data-testid="repo-branch-context"
        className="mt-4 flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground"
      >
        <p>
          Work on <span className="font-semibold text-foreground">{repoName}</span> off{' '}
          <span className="font-semibold text-foreground">{branchName}</span>
        </p>
        <button
          type="button"
          aria-label="Create space"
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          onClick={onCreateSpace}
        >
          Create space
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          aria-label="Select team mode"
          aria-pressed={selectedMode === 'team'}
          onClick={() => {
            onSelectMode('team')
          }}
          className="rounded-xl border px-3 py-3 text-left text-xs transition-colors hover:bg-muted/40 aria-pressed:border-foreground aria-pressed:bg-muted/30"
        >
          <p className="font-semibold text-foreground">Team orchestration</p>
          <p className="mt-1 text-muted-foreground">Coordinator plans and delegates across multiple agents.</p>
        </button>

        <button
          type="button"
          aria-label="Select single-agent mode"
          aria-pressed={selectedMode === 'single'}
          onClick={() => {
            onSelectMode('single')
          }}
          className="rounded-xl border px-3 py-3 text-left text-xs transition-colors hover:bg-muted/40 aria-pressed:border-foreground aria-pressed:bg-muted/30"
        >
          <p className="font-semibold text-foreground">Start with single agent</p>
          <p className="mt-1 text-muted-foreground">Developer plans then implements in one stream.</p>
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">Workspace ownership</p>
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
            Create managed worktree
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
            Use my existing folder/worktree
          </button>
        </div>

        {workspaceMode === 'external' && (
          <div className="mt-3">
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

      <div className="mt-4 flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
        <p>Set up environment with copy-config or script.</p>
        <button
          type="button"
          aria-label="Toggle rapid fire mode"
          aria-pressed={rapidFire}
          onClick={onToggleRapidFire}
          className="rounded-md border border-border px-2 py-1 text-xs aria-pressed:border-foreground aria-pressed:text-foreground"
        >
          Rapid fire mode
        </button>
      </div>
    </section>
  )
}
