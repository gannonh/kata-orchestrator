import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'

import {
  createInitialSessionConversationState,
  sessionConversationReducer
} from '../components/center/sessionConversationState'
import type { LatestRunDraft } from '../types/spec-document'
import type { SessionRuntimeEvent } from '../types/session-runtime-adapter'

const DEFAULT_RUN_MODEL = 'gpt-5.3-codex'
const DEFAULT_RUN_PROVIDER = 'openai-codex'

export function useIpcSessionConversation(sessionId: string | null) {
  const [state, dispatch] = useReducer(
    sessionConversationReducer,
    undefined,
    createInitialSessionConversationState
  )
  const [latestDraft, setLatestDraft] = useState<LatestRunDraft | undefined>(undefined)
  const lastPromptRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    lastPromptRef.current = null
    setLatestDraft(undefined)
    dispatch({ type: 'RESET_CONVERSATION' })
  }, [sessionId])

  // Subscribe to run events from main process
  useEffect(() => {
    const kata = window.kata
    if (!kata?.onRunEvent) return

    const unsubscribe = kata.onRunEvent((event: SessionRuntimeEvent) => {
      if (event.type === 'run_state_changed') {
        if (event.runState === 'error') {
          setLatestDraft(undefined)
          dispatch({ type: 'RUN_FAILED', error: event.errorMessage })
        } else if (event.runState === 'idle') {
          dispatch({ type: 'RUN_COMPLETED' })
        }
        // Pending events are managed locally after submit/retry.
        return
      }

      if (event.type === 'message_appended') {
        dispatch({ type: 'APPEND_MESSAGE', message: event.message })
        setLatestDraft(
          buildLatestDraft({
            prompt: lastPromptRef.current ?? '',
            runId: event.runId ?? `run-${event.message.id}`,
            generatedAt: event.message.createdAt
          })
        )
        dispatch({ type: 'RUN_COMPLETED' })
        return
      }

      if (event.type === 'message_updated') {
        dispatch({ type: 'APPEND_MESSAGE', message: event.message })
      }
    })

    return unsubscribe
  }, [])

  // Replay persisted runs when sessionId changes
  useEffect(() => {
    if (!sessionId) return
    const kata = window.kata
    if (!kata?.runList) return
    let isCurrentSession = true

    kata
      .runList(sessionId)
      .then((runs) => {
        if (!isCurrentSession) {
          return
        }

        for (const run of runs) {
          lastPromptRef.current = run.prompt
          for (const msg of run.messages) {
            dispatch({
              type: 'APPEND_MESSAGE',
              message: {
                id: msg.id,
                role: msg.role,
                content: msg.content,
                createdAt: msg.createdAt
              }
            })
            if (msg.role === 'agent') {
              setLatestDraft(
                buildLatestDraft({
                  prompt: run.prompt,
                  runId: run.id,
                  generatedAt: msg.createdAt
                })
              )
            }
          }
        }
      })
      .catch((err: unknown) => {
        if (!isCurrentSession) {
          return
        }

        const message = err instanceof Error ? err.message : 'Failed to load conversation history'
        console.error('[useIpcSessionConversation] Failed to replay run history:', err)
        dispatch({ type: 'RUN_FAILED', error: message })
      })

    return () => {
      isCurrentSession = false
    }
  }, [sessionId])

  const submitPrompt = useCallback(
    (prompt: string) => {
      const kata = window.kata
      if (!kata?.runSubmit || !sessionId) return

      lastPromptRef.current = prompt
      setLatestDraft(undefined)
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
    setLatestDraft(undefined)
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

  return {
    state: latestDraft ? { ...state, latestDraft } : state,
    submitPrompt,
    retry
  }
}

// TODO: replace with spec extraction pipeline output once connected.
// Scaffolding: produces a fixed template from the latest prompt until the
// spec generation pipeline is wired in.
function buildLatestDraft({
  prompt,
  runId,
  generatedAt
}: {
  prompt: string
  runId: string
  generatedAt: string
}): LatestRunDraft {
  return {
    runId,
    generatedAt,
    content: [
      '## Goal',
      prompt,
      '',
      '## Acceptance Criteria',
      '1. Produce a structured spec draft from the latest run',
      '2. Keep the shell behavior deterministic for renderer tests',
      '',
      '## Non-goals',
      '- Do not call external services from the right panel',
      '',
      '## Assumptions',
      '- The latest prompt is the source of truth for the draft',
      '',
      '## Verification Plan',
      '1. Run the renderer unit tests',
      '',
      '## Rollback Plan',
      '1. Clear the generated draft state',
      '',
      '## Tasks',
      '- [ ] Review the latest prompt',
      '- [/] Apply the structured draft',
      '- [x] Keep the runtime wiring stable'
    ].join('\n')
  }
}
