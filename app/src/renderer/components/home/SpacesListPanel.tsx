import type { MockSpace } from '../../mock/spaces'

type SpaceGroup = {
  repo: string
  spaces: MockSpace[]
}

type SpacesListPanelProps = {
  groups: SpaceGroup[]
  selectedSpaceId: string | null
  searchQuery: string
  groupByRepo: boolean
  showArchived: boolean
  onSearchChange: (value: string) => void
  onToggleGroupByRepo: () => void
  onToggleShowArchived: () => void
  onSelectSpace: (spaceId: string) => void
}

// Invariant: archived: true always implies status: 'archived'. A space with
// archived: true and a non-archived status value is a data inconsistency.
// Note: archived spaces are filtered out by showArchived before reaching this
// function under default settings, so the 'archived' branch is only reachable
// when showArchived is true.
function statusDotClassName(status: MockSpace['status']): string {
  if (status === 'active') {
    return 'bg-blue-500'
  }

  if (status === 'archived') {
    return 'bg-amber-500'
  }

  return 'bg-zinc-500'
}

export function SpacesListPanel({
  groups,
  selectedSpaceId,
  searchQuery,
  groupByRepo,
  showArchived,
  onSearchChange,
  onToggleGroupByRepo,
  onToggleShowArchived,
  onSelectSpace
}: SpacesListPanelProps) {
  // groups.every returns true for an empty array (vacuous truth), which correctly
  // treats the zero-groups case as "no results". Do not change this to
  // `groups.length === 0 || groups.every(...)` — that would break the case where
  // groups exist but all have been filtered to zero spaces.
  const noResults = groups.every((group) => group.spaces.length === 0)

  return (
    <section className="rounded-2xl border border-border/80 bg-card/60 p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label="Group spaces by repository"
          aria-pressed={groupByRepo}
          className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground"
          onClick={onToggleGroupByRepo}
        >
          GROUPED BY REPO
        </button>
        <button
          type="button"
          aria-label="Show archived spaces"
          aria-pressed={showArchived}
          className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground"
          onClick={onToggleShowArchived}
        >
          SHOW ARCHIVED
        </button>
        <label className="sr-only" htmlFor="spaces-search">
          Search spaces
        </label>
        <input
          id="spaces-search"
          type="search"
          aria-label="Search spaces"
          value={searchQuery}
          onChange={(event) => {
            onSearchChange(event.target.value)
          }}
          placeholder="Search spaces"
          className="ml-auto h-8 rounded-md border border-border bg-background/70 px-2 text-xs outline-none focus:border-ring"
        />
      </div>

      {noResults ? (
        <div className="rounded-xl border border-dashed border-border/80 px-3 py-4 text-sm text-muted-foreground">
          No spaces match your filters.
        </div>
      ) : null}

      <div className="space-y-4">
        {groups.map((group) => {
          if (group.spaces.length === 0) {
            return null
          }

          return (
            <div key={group.repo}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.repo}</p>
              </div>
              <ul className="space-y-1.5">
                {group.spaces.map((space) => (
                  <li key={space.id}>
                    <button
                      type="button"
                      aria-label={`Select space ${space.name}`}
                      aria-pressed={selectedSpaceId === space.id}
                      onClick={() => {
                        onSelectSpace(space.id)
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 aria-pressed:border-foreground aria-pressed:bg-muted/35"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${statusDotClassName(space.status)}`} />
                        <span className="truncate text-foreground">{space.name}</span>
                      </span>
                      <span className="ml-3 shrink-0 text-xs text-muted-foreground">{space.elapsed}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
