import { useEffect, useState } from 'react'

import { mapSessionAgentRecordToSummary } from '../components/left/mapSessionAgentRecordToSummary'
import type { AgentSummary } from '../types/agent'

type SessionAgentRosterState = {
  agents: AgentSummary[]
  isLoading: boolean
  error: string | null
}

const EMPTY_STATE: SessionAgentRosterState = {
  agents: [],
  isLoading: false,
  error: null
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to load session agent roster.'
}

export function useSessionAgentRoster(activeSpaceId: string | null): SessionAgentRosterState {
  const [state, setState] = useState<SessionAgentRosterState>(EMPTY_STATE)

  useEffect(() => {
    let isDisposed = false
    const setStateIfMounted = (nextState: SessionAgentRosterState): void => {
      if (!isDisposed) {
        setState(nextState)
      }
    }

    if (!activeSpaceId) {
      setState(EMPTY_STATE)
      return () => {
        isDisposed = true
      }
    }

    const kata = window.kata
    if (!kata?.sessionListBySpace || !kata?.sessionAgentRosterList) {
      setState(EMPTY_STATE)
      return () => {
        isDisposed = true
      }
    }

    setState({
      agents: [],
      isLoading: true,
      error: null
    })

    void (async () => {
      try {
        const sessions = await kata.sessionListBySpace({ spaceId: activeSpaceId })
        const newestSession = sessions[0]

        if (!newestSession) {
          setStateIfMounted(EMPTY_STATE)
          return
        }

        const roster = await kata.sessionAgentRosterList({ sessionId: newestSession.id })
        setStateIfMounted({
          agents: roster.map(mapSessionAgentRecordToSummary),
          isLoading: false,
          error: null
        })
      } catch (error) {
        setStateIfMounted({
          agents: [],
          isLoading: false,
          error: toErrorMessage(error)
        })
      }
    })()

    return () => {
      isDisposed = true
    }
  }, [activeSpaceId])

  return state
}
