import type { CoordinatorStatusBadgeState } from './types'

const STATUS_MAP = {
  ready: { label: 'Ready', dotClass: 'bg-muted-foreground' },
  thinking: { label: 'Thinking', dotClass: 'bg-primary motion-safe:animate-pulse' },
  running: { label: 'Running', dotClass: 'bg-primary' },
  stopped: { label: 'Stopped', dotClass: 'bg-muted-foreground' },
  error: { label: 'Error', dotClass: 'bg-destructive' }
} as const

type ConversationStatusBadgeProps = {
  state: CoordinatorStatusBadgeState
}

export function ConversationStatusBadge({ state }: ConversationStatusBadgeProps) {
  const status = STATUS_MAP[state]

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={status.label}
      className="inline-flex w-fit items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-2 w-2 rounded-full ${status.dotClass}`}
      />
      <span>{status.label}</span>
    </div>
  )
}
