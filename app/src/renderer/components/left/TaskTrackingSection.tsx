import { AlertCircle, Check, ChevronRight } from 'lucide-react'

import type { TaskActivitySnapshot, TaskTrackingItem } from '@shared/types/task-tracking'
import { cn } from '../../lib/cn'

type TaskTrackingSectionProps = {
  snapshot: TaskActivitySnapshot
}

function TaskStatusIcon({ item }: { item: TaskTrackingItem }) {
  if (item.status === 'complete') {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-status-done text-background">
        <Check className="h-2.5 w-2.5" />
      </span>
    )
  }

  if (item.status === 'blocked') {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-status-blocked text-status-blocked">
        <AlertCircle className="h-2.5 w-2.5" />
      </span>
    )
  }

  if (item.status === 'in_progress') {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-status-in-progress text-status-in-progress">
        <span className="h-2 w-1 rounded-full bg-current" />
      </span>
    )
  }

  return <span className="inline-flex h-4 w-4 rounded-full border border-muted-foreground/70" />
}

function buildSummary(snapshot: TaskActivitySnapshot): string {
  const segments: string[] = []
  if (snapshot.counts.in_progress > 0) {
    segments.push(`${snapshot.counts.in_progress} in progress`)
  }

  if (snapshot.counts.complete > 0) {
    segments.push(`${snapshot.counts.complete} done`)
  }

  const waitingCount = snapshot.counts.not_started + snapshot.counts.blocked
  if (waitingCount > 0) {
    segments.push(`${waitingCount} waiting`)
  }

  return segments.join(' · ')
}

export function TaskTrackingSection({ snapshot }: TaskTrackingSectionProps) {
  if (snapshot.items.length === 0) {
    return null
  }

  return (
    <section
      aria-label="Task tracking"
      data-testid="task-tracking-section"
      className="mt-3 space-y-2"
    >
      <p className="text-xs text-muted-foreground">{buildSummary(snapshot)}</p>
      <div className="space-y-1.5">
        {snapshot.items.map((item) => {
          const isHighActivity = item.activityLevel === 'high' && Boolean(item.activityDetail)
          return (
            <article
              key={item.id}
              className="rounded-md border border-border/70 bg-muted/10"
            >
              <div className="flex items-center gap-2 px-2.5 py-2">
                <TaskStatusIcon item={item} />
                <p className="min-w-0 flex-1 truncate text-sm">{item.title}</p>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/80" />
              </div>
              {isHighActivity ? (
                <div className="flex items-center gap-2 border-t border-border/60 px-2.5 py-1.5">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{item.activityDetail}</p>
                  {item.activeAgentId ? (
                    <span
                      aria-label="Active specialist"
                      className={cn(
                        'inline-flex h-4 items-center rounded bg-status-in-progress/20 px-1.5 text-[10px] font-medium text-status-in-progress'
                      )}
                    >
                      {item.activeAgentId}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
