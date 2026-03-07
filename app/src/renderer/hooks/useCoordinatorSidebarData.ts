import { useEffect, useState } from 'react'

import {
  selectCoordinatorAgentList,
  selectCoordinatorContextItems,
  selectCoordinatorPromptPreview,
  type CoordinatorAgentListItem,
  type CoordinatorContextListItem,
  type CoordinatorContractState
} from '../features/coordinator-session/domain'
import type { RunRecord } from '../../shared/types/run'
import type { SessionAgentRecord, SessionContextResourceRecord } from '../../shared/types/space'

type CoordinatorSidebarDataState = {
  agentItems: CoordinatorAgentListItem[]
  contextItems: CoordinatorContextListItem[]
  promptPreview: string | null
  isLoading: boolean
  error: string | null
}

const EMPTY_STATE: CoordinatorSidebarDataState = {
  agentItems: [],
  contextItems: [],
  promptPreview: null,
  isLoading: false,
  error: null
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]))
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to load coordinator sidebar data.'
}

function createContractState(
  agentRoster: SessionAgentRecord[],
  contextResources: SessionContextResourceRecord[],
  runs: RunRecord[]
): CoordinatorContractState {
  return {
    agentRoster: indexById(agentRoster),
    contextResources: indexById(contextResources),
    runs: indexById(runs)
  }
}

export function useCoordinatorSidebarData(sessionId: string | null): CoordinatorSidebarDataState {
  const [state, setState] = useState<CoordinatorSidebarDataState>(EMPTY_STATE)

  useEffect(() => {
    const kata = window.kata

    if (!sessionId || !kata?.sessionAgentRosterList || !kata?.sessionContextResourcesList || !kata?.runList) {
      if (sessionId && (!kata?.sessionAgentRosterList || !kata?.sessionContextResourcesList || !kata?.runList)) {
        console.warn('[useCoordinatorSidebarData] IPC bridge methods missing. Preload may be misconfigured.')
      }
      setState(EMPTY_STATE)
      return
    }

    let disposed = false
    setState({
      agentItems: [],
      contextItems: [],
      promptPreview: null,
      isLoading: true,
      error: null
    })

    void Promise.all([
      kata.sessionAgentRosterList({ sessionId }),
      kata.sessionContextResourcesList({ sessionId }),
      kata.runList(sessionId)
    ])
      .then(([agentRoster, contextResources, runs]) => {
        if (disposed) return

        const contractState = createContractState(agentRoster, contextResources, runs)

        setState({
          agentItems: selectCoordinatorAgentList(contractState, sessionId),
          contextItems: selectCoordinatorContextItems(contractState, sessionId),
          promptPreview: selectCoordinatorPromptPreview(contractState, sessionId),
          isLoading: false,
          error: null
        })
      })
      .catch((error: unknown) => {
        if (disposed) return

        console.error('[useCoordinatorSidebarData] Failed to load coordinator sidebar data:', error)
        setState({
          agentItems: [],
          contextItems: [],
          promptPreview: null,
          isLoading: false,
          error: toErrorMessage(error)
        })
      })

    return () => {
      disposed = true
    }
  }, [sessionId])

  return state
}
