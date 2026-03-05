import type { PrimitiveRunState } from './types'

const STATUS_MAP = {
  empty: { label: 'Ready', dotClass: 'bg-muted-foreground' },
  pending: { label: 'Thinking', dotClass: 'bg-primary motion-safe:animate-pulse' },
  idle: { label: 'Stopped', dotClass: 'bg-muted-foreground' },
  error: { label: 'Error', dotClass: 'bg-destructive' }
} as const

type ConversationStatusBadgeProps = {
  runState: PrimitiveRunState
}

export function ConversationStatusBadge({ runState }: ConversationStatusBadgeProps) {
  const status = STATUS_MAP[runState]

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
