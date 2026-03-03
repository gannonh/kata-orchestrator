import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import type { AgentSummary } from '../../types/agent'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { AgentCard } from './AgentCard'
import { LeftSection } from './LeftSection'
import { statusDotClassName } from './agentStatus'

type AgentsTabProps = {
  agents: AgentSummary[]
  isLoading?: boolean
  error?: string | null
}

export function AgentsTab({ agents, isLoading = false, error = null }: AgentsTabProps) {
  const [backgroundExpanded, setBackgroundExpanded] = useState(false)

  const { primaryAgents, backgroundAgents } = useMemo(() => {
    const delegatedTopLevel = agents.filter((agent) => Boolean(agent.delegatedBy))
    const legacyChildren = agents.flatMap((agent) => agent.children ?? [])
    const legacyChildIds = new Set(legacyChildren.map((agent) => agent.id))

    const primary = agents.filter((agent) => !agent.delegatedBy && !legacyChildIds.has(agent.id))
    const backgroundSource = legacyChildren.length ? [...legacyChildren, ...delegatedTopLevel] : delegatedTopLevel

    const seenBackgroundIds = new Set<string>()
    const background = backgroundSource.filter((agent) => {
      if (seenBackgroundIds.has(agent.id)) {
        return false
      }
      seenBackgroundIds.add(agent.id)
      return true
    })

    return {
      primaryAgents: primary,
      backgroundAgents: background
    }
  }, [agents])
  const runningCount = backgroundAgents.filter((agent) => agent.status === 'running').length

  return (
    <LeftSection
      title="Agents"
      description="Agents write code, maintain notes, and coordinate tasks."
      addActionLabel="Create new agent"
    >
      <div className="space-y-3 pr-0">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading agents…</p>
        ) : error ? (
          <p className="text-xs text-muted-foreground">Unable to refresh agents right now.</p>
        ) : agents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No agents in this space yet.</p>
        ) : null}

        {primaryAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
          />
        ))}

        {backgroundAgents.length ? (
          <Collapsible
            open={backgroundExpanded}
            onOpenChange={setBackgroundExpanded}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between overflow-hidden rounded-md border border-border/70 bg-muted/20 pl-2.5 pr-0 py-2 text-left"
                aria-label={`${runningCount} / ${backgroundAgents.length} background agents running`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex shrink-0 items-center gap-1">
                    {backgroundAgents.map((agent) => (
                      <span
                        key={agent.id}
                        className={[
                          'inline-flex h-2.5 w-2.5 rounded-[2px]',
                          statusDotClassName[agent.status]
                        ].join(' ')}
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                  <span className="max-w-[20ch] truncate text-xs font-medium text-muted-foreground">
                    {runningCount} / {backgroundAgents.length} background agents running
                  </span>
                </div>
                <ChevronDown
                  aria-hidden="true"
                  className={[
                    'h-4 w-4 text-muted-foreground transition-transform duration-150',
                    backgroundExpanded ? 'rotate-180' : ''
                  ].join(' ')}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 grid gap-2 pl-3">
                {backgroundAgents.map((agent) => (
                  <li key={agent.id}>
                    <AgentCard agent={agent} />
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </LeftSection>
  )
}
