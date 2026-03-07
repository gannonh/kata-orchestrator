import type { CoordinatorAgentListItem as CoordinatorAgentItem } from '../../features/coordinator-session/domain'
import { agentStatusLabel, statusDotClassName } from './agentStatus'

type CoordinatorAgentListItemProps = {
  name: string
  status: CoordinatorAgentItem['status']
  subtitle: string
}

export function CoordinatorAgentListItem({ name, status, subtitle }: CoordinatorAgentListItemProps) {
  return (
    <article className="w-full overflow-hidden rounded-md border border-border/70 bg-card/40 px-3 py-2">
      <div className="flex items-start gap-2">
        <span
          className={[
            'mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full',
            statusDotClassName[status]
          ].join(' ')}
        >
          <span className="sr-only">{agentStatusLabel[status]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="max-w-[18ch] truncate text-sm font-medium text-foreground">{name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </article>
  )
}
