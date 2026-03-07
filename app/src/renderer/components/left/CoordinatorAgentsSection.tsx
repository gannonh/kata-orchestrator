import type { CoordinatorAgentListItem as CoordinatorAgentItem } from '../../features/coordinator-session/domain'
import { LeftSection } from './LeftSection'
import { CoordinatorAgentListItem } from './CoordinatorAgentListItem'

type CoordinatorAgentsSectionProps = {
  agentItems: CoordinatorAgentItem[]
  promptPreview: string | null
  isLoading: boolean
  error: string | null
}

function getAgentSubtitle(agent: CoordinatorAgentItem, promptPreview: string | null): string {
  if (agent.kind === 'coordinator') {
    return promptPreview ?? agent.currentTask ?? agent.role
  }

  return agent.currentTask ?? agent.role
}

export function CoordinatorAgentsSection({
  agentItems,
  promptPreview,
  isLoading,
  error
}: CoordinatorAgentsSectionProps) {
  return (
    <LeftSection
      title="Agents"
      description="Agents write code, maintain notes, and coordinate tasks."
      addActionLabel="Create new agent"
      actionVariant="inline"
    >
      <div className="space-y-3">
        {isLoading ? <p className="text-xs text-muted-foreground">Loading agents…</p> : null}
        {!isLoading && error ? <p className="text-xs text-muted-foreground">Unable to refresh agents right now.</p> : null}
        {!isLoading && !error && agentItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">No agents in this session yet.</p>
        ) : null}
        {!isLoading && !error
          ? agentItems.map((agent) => (
              <CoordinatorAgentListItem
                key={agent.id}
                name={agent.name}
                status={agent.status}
                subtitle={getAgentSubtitle(agent, promptPreview)}
              />
            ))
          : null}
      </div>
    </LeftSection>
  )
}
