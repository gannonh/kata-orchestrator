import { useCallback, useEffect, useReducer, useRef } from 'react'

import {
  createInitialSessionConversationState,
  sessionConversationReducer
} from '../components/center/sessionConversationState'

const RUN_SUCCESS_DELAY_MS = 900
const DETERMINISTIC_ERROR_MESSAGE = 'Deterministic error state for shell testing.'
const RUN_SUCCESS_RESPONSE = 'Draft ready for review.'

export function useSessionConversation() {
  const [state, dispatch] = useReducer(
    sessionConversationReducer,
    undefined,
    createInitialSessionConversationState
  )
  const timeoutRef = useRef<number | null>(null)

  const clearPendingTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearPendingTimer()
    }
  }, [clearPendingTimer])

  const submitPrompt = useCallback(
    (prompt: string) => {
      const canStartRun = state.runState === 'empty' || state.runState === 'idle'

      dispatch({
        type: 'SUBMIT_PROMPT',
        prompt
      })

      if (!canStartRun) {
        return
      }

      clearPendingTimer()

      if (prompt.trim().startsWith('/error')) {
        dispatch({
          type: 'RUN_FAILED',
          error: DETERMINISTIC_ERROR_MESSAGE
        })
        return
      }

      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        dispatch({
          type: 'RUN_SUCCEEDED',
          response: RUN_SUCCESS_RESPONSE
        })
      }, RUN_SUCCESS_DELAY_MS)
    },
    [clearPendingTimer, state.runState]
  )

  const retry = useCallback(() => {
    dispatch({
      type: 'RETRY_FROM_ERROR'
    })
  }, [])

  return {
    state,
    submitPrompt,
    retry
  }
}
