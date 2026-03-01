import { useCallback, useEffect, useReducer, useRef } from 'react'

import {
  createInitialSessionConversationState,
  sessionConversationReducer
} from '../components/center/sessionConversationState'
import type { ConversationRunState } from '../types/session-conversation'

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
  const runStateRef = useRef<ConversationRunState>('empty')

  const clearPendingTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    runStateRef.current = state.runState
  }, [state.runState])

  useEffect(() => {
    return () => {
      clearPendingTimer()
    }
  }, [clearPendingTimer])

  const submitPrompt = useCallback(
    (prompt: string) => {
      const canStartRun =
        runStateRef.current === 'empty' || runStateRef.current === 'idle'

      dispatch({
        type: 'SUBMIT_PROMPT',
        prompt
      })

      if (!canStartRun) {
        return
      }

      runStateRef.current = 'pending'
      clearPendingTimer()

      if (prompt.trim().startsWith('/error')) {
        runStateRef.current = 'error'
        dispatch({
          type: 'RUN_FAILED',
          error: DETERMINISTIC_ERROR_MESSAGE
        })
        return
      }

      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        runStateRef.current = 'idle'
        dispatch({
          type: 'RUN_SUCCEEDED',
          response: RUN_SUCCESS_RESPONSE
        })
      }, RUN_SUCCESS_DELAY_MS)
    },
    [clearPendingTimer]
  )

  const retry = useCallback(() => {
    if (runStateRef.current === 'error') {
      runStateRef.current = 'pending'
    }

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
