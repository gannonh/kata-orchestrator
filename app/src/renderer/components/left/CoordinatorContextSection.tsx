import type { CoordinatorContextListItem } from '../../features/coordinator-session/domain'
import { LeftSection } from './LeftSection'
import { LEFT_PANEL_TYPOGRAPHY } from './left-typography'

type CoordinatorContextSectionProps = {
  contextItems: CoordinatorContextListItem[]
  isLoading: boolean
  error: string | null
}

export function CoordinatorContextSection({
  contextItems,
  isLoading,
  error
}: CoordinatorContextSectionProps) {
  return (
    <LeftSection
      title="Context"
      description="Context about the task, shared with all agents on demand."
      addActionLabel="Add context"
      actionVariant="inline"
    >
      <div className="space-y-2">
        {isLoading ? <p className="text-xs text-muted-foreground">Loading context…</p> : null}
        {!isLoading && error ? <p className="text-xs text-muted-foreground">Unable to refresh context right now.</p> : null}
        {!isLoading && !error && contextItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">No shared context in this session yet.</p>
        ) : null}
        {!isLoading && !error
          ? contextItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`flex w-full items-center gap-2 text-left ${LEFT_PANEL_TYPOGRAPHY.listItem}`}
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70"
                />
                <span>{item.label}</span>
              </button>
            ))
          : null}
      </div>
    </LeftSection>
  )
}
