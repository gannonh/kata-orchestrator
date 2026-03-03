import type { ConversationEntry } from './conversation-entry-index'
import { LEFT_PANEL_TYPOGRAPHY } from './left-typography'
import { cn } from '../../lib/cn'

type ConversationEntryIndexSectionProps = {
  entries: ConversationEntry[]
  onJumpToMessage: (messageId: string) => void
}

export function ConversationEntryIndexSection({ entries, onJumpToMessage }: ConversationEntryIndexSectionProps) {
  return (
    <section className="mt-6 border-t border-border/70 pt-4">
      <h3 className={LEFT_PANEL_TYPOGRAPHY.sectionTitle}>Conversation Entries</h3>
      <div className="mt-3">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No conversation entries yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-2 py-1.5 text-left',
                    'hover:border-border/70 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                  aria-label={`Jump to message: ${entry.label} at ${entry.timestamp}`}
                  onClick={() => {
                    onJumpToMessage(entry.messageId)
                  }}
                >
                  <span className="min-w-0 truncate text-xs text-foreground/95">{entry.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{entry.timestamp}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
