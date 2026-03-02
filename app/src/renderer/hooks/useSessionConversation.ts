import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import {
  createInitialSessionConversationState,
  sessionConversationReducer
} from '../components/center/sessionConversationState'
import type { LatestRunDraft } from '../types/spec-document'
import type { ConversationRunState, SessionConversationState } from '../types/session-conversation'

const RUN_SUCCESS_DELAY_MS = 900
const DETERMINISTIC_ERROR_MESSAGE = 'Deterministic error state for shell testing.'
const RUN_SUCCESS_RESPONSE = 'Draft ready for review.'

export function useSessionConversation() {
  const [state, dispatch] = useReducer(
    sessionConversationReducer,
    undefined,
    createInitialSessionConversationState
  )
  const [latestDraft, setLatestDraft] = useState<LatestRunDraft | undefined>(
    undefined
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

  const scheduleSuccess = useCallback((draft: LatestRunDraft) => {
    clearPendingTimer()

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      runStateRef.current = 'idle'
      setLatestDraft(draft)
      dispatch({
        type: 'RUN_SUCCEEDED',
        response: RUN_SUCCESS_RESPONSE
      })
    }, RUN_SUCCESS_DELAY_MS)
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
      setLatestDraft(undefined)

      if (prompt.trim().startsWith('/error')) {
        runStateRef.current = 'error'
        dispatch({
          type: 'RUN_FAILED',
          error: DETERMINISTIC_ERROR_MESSAGE
        })
        return
      }

      scheduleSuccess(
        createLatestDraft({
          prompt,
          sequence: state.messages.length + 2
        })
      )
    },
    [scheduleSuccess, state.messages.length]
  )

  const retry = useCallback(() => {
    if (runStateRef.current !== 'error') {
      return
    }

    runStateRef.current = 'pending'

    dispatch({
      type: 'RETRY_FROM_ERROR'
    })

    scheduleSuccess(
      createLatestDraft({
        prompt: getMostRecentUserPrompt(state),
        sequence: state.messages.length + 1
      })
    )
  }, [scheduleSuccess, state])

  return {
    state: latestDraft ? { ...state, latestDraft } : state,
    submitPrompt,
    retry
  }
}

function createLatestDraft({
  prompt,
  sequence
}: {
  prompt: string
  sequence: number
}): LatestRunDraft {
  return {
    runId: `run-${sequence}`,
    generatedAt: new Date(sequence * 1000).toISOString(),
    content: [
      '## Goal',
      prompt,
      '',
      '## Acceptance Criteria',
      '1. Produce a deterministic draft for the current prompt',
      '2. Keep shell behavior deterministic',
      '',
      '## Non-goals',
      '- Do not call external services',
      '',
      '## Assumptions',
      '- The submitted prompt is the source of truth',
      '',
      '## Verification Plan',
      '1. Run the hook unit tests',
      '',
      '## Rollback Plan',
      '1. Clear the generated draft state',
      '',
      '## Tasks',
      '- [ ] Review the request',
      '- [/] Draft the structured sections',
      '- [x] Keep the success response stable'
    ].join('\n')
  }
}

function getMostRecentUserPrompt(state: SessionConversationState): string {
  return (
    [...state.messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content ?? ''
  )
}
