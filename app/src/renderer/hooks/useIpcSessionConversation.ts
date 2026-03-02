import { useCallback, useEffect, useReducer, useRef } from 'react'

import {
  createInitialSessionConversationState,
  sessionConversationReducer
} from '../components/center/sessionConversationState'
import type { SessionRuntimeEvent } from '../types/session-runtime-adapter'

const DEFAULT_RUN_MODEL = 'gpt-5.3-codex'
const DEFAULT_RUN_PROVIDER = 'openai-codex'

export function useIpcSessionConversation(sessionId: string | null) {
  const [state, dispatch] = useReducer(
    sessionConversationReducer,
    undefined,
    createInitialSessionConversationState
  )
  const lastPromptRef = useRef<string | null>(null)

  // Subscribe to run events from main process
  useEffect(() => {
    const kata = window.kata
    if (!kata?.onRunEvent) return

    const unsubscribe = kata.onRunEvent((event: SessionRuntimeEvent) => {
      if (event.type === 'run_state_changed') {
        if (event.runState === 'error') {
          dispatch({ type: 'RUN_FAILED', error: event.errorMessage })
        } else if (event.runState === 'idle') {
          dispatch({ type: 'RUN_COMPLETED' })
        }
        // Pending events are managed locally after submit/retry.
        return
      }

      if (event.type === 'message_appended') {
        dispatch({ type: 'RUN_SUCCEEDED', response: event.message.content })
      }
    })

    return unsubscribe
  }, [])

  // Replay persisted runs on mount
  useEffect(() => {
    if (!sessionId) return
    const kata = window.kata
    if (!kata?.runList) return

    kata
      .runList(sessionId)
      .then((runs) => {
        for (const run of runs) {
          for (const msg of run.messages) {
            if (msg.role === 'user') {
              dispatch({ type: 'SUBMIT_PROMPT', prompt: msg.content })
            } else {
              dispatch({ type: 'RUN_SUCCEEDED', response: msg.content })
            }
          }
        }
      })
      .catch(() => {
        // Silently ignore replay errors on mount
      })
  }, [sessionId])

  const submitPrompt = useCallback(
    (prompt: string) => {
      const kata = window.kata
      if (!kata?.runSubmit || !sessionId) return

      lastPromptRef.current = prompt
      dispatch({ type: 'SUBMIT_PROMPT', prompt })

      kata
        .runSubmit({
          sessionId,
          prompt,
          model: DEFAULT_RUN_MODEL,
          provider: DEFAULT_RUN_PROVIDER
        })
        .catch((error: Error) => {
          dispatch({ type: 'RUN_FAILED', error: error.message })
        })
    },
    [sessionId]
  )

  const retry = useCallback(() => {
    if (state.runState !== 'error' || !lastPromptRef.current) return

    const kata = window.kata
    if (!kata?.runSubmit || !sessionId) return

    const prompt = lastPromptRef.current
    dispatch({ type: 'RETRY_FROM_ERROR' })

    kata
      .runSubmit({
        sessionId,
        prompt,
        model: DEFAULT_RUN_MODEL,
        provider: DEFAULT_RUN_PROVIDER
      })
      .catch((error: Error) => {
        dispatch({ type: 'RUN_FAILED', error: error.message })
      })
  }, [state.runState, sessionId])

  return { state, submitPrompt, retry }
}
