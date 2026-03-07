import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react'

import {
  createInitialSessionConversationState,
  sessionConversationReducer
} from '../components/center/sessionConversationState'
import type { ModelInfo } from '../components/center/ModelSelector'
import { FALLBACK_MODEL } from '../components/center/model-selection'
import type { SessionRuntimeEvent } from '../types/session-runtime-adapter'
import { INTERRUPTED_RUN_ERROR_MESSAGE } from '../../shared/types/run'
import { isPersistedSpecDocument } from '../../shared/types/spec-document'
import { toStableTaskId } from '@shared/task-id'
import { buildTaskCounts, type TaskActivitySnapshot, type TaskTrackingItem } from '@shared/types/task-tracking'

const SPEC_AUTHORING_COMPLETION_MESSAGE = "I've created an initial draft of the project spec."

function toConversationActivityPhase(content: string): 'thinking' | 'drafting' | undefined {
  const normalized = content.trim().toLowerCase()
  if (normalized === 'thinking') {
    return 'thinking'
  }

  if (normalized === 'drafting') {
    return 'drafting'
  }

  return undefined
}

function toRunSelection(model?: ModelInfo): { model: string; provider: string } {
  return {
    model: model?.modelId ?? FALLBACK_MODEL.modelId,
    provider: model?.provider ?? FALLBACK_MODEL.provider
  }
}

export function useIpcSessionConversation(sessionId: string | null, spaceId: string | null = null) {
  const [state, dispatch] = useReducer(
    sessionConversationReducer,
    undefined,
    createInitialSessionConversationState
  )
  const lastPromptRef = useRef<string | null>(null)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const liveSnapshotReceivedRef = useRef(false)

  useLayoutEffect(() => {
    lastPromptRef.current = null
    liveSnapshotReceivedRef.current = false
    dispatch({ type: 'RESET_CONVERSATION' })
  }, [sessionId])

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
        dispatch({ type: 'APPEND_MESSAGE', message: event.message })
        const phase = toConversationActivityPhase(event.message.content)
        if (phase) {
          dispatch({ type: 'SET_ACTIVITY_PHASE', phase })
          return
        }

        if (event.message.content.trim() === SPEC_AUTHORING_COMPLETION_MESSAGE) {
          dispatch({ type: 'CLEAR_ACTIVITY_PHASE' })
          dispatch({ type: 'RUN_COMPLETED' })
          return
        }

        dispatch({ type: 'RUN_COMPLETED' })
        return
      }

      if (event.type === 'message_updated') {
        dispatch({ type: 'APPEND_MESSAGE', message: event.message })
        return
      }

      if (event.type === 'task_activity_snapshot') {
        if (event.snapshot.sessionId === sessionIdRef.current) {
          liveSnapshotReceivedRef.current = true
          dispatch({ type: 'TASK_ACTIVITY_SNAPSHOT_RECEIVED', snapshot: event.snapshot })
        }
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

    if (spaceId && typeof kata.specGet === 'function') {
      kata
        .specGet({ spaceId, sessionId })
        .then((persistedDocument) => {
          if (!isCurrentSession) {
            return
          }

          const snapshot = buildTaskActivitySnapshotFromPersistedSpecDocument(sessionId, persistedDocument)
          if (snapshot && !liveSnapshotReceivedRef.current) {
            dispatch({ type: 'TASK_ACTIVITY_SNAPSHOT_RECEIVED', snapshot })
          }
        })
        .catch((err: unknown) => {
          console.error('[useIpcSessionConversation] Failed to restore persisted task tracking:', err)
        })
    }

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
          }

          if (isReconciledInterruptedRunFallback(run.status, run.errorMessage)) {
            dispatch({ type: 'RUN_FAILED', error: run.errorMessage })
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
  }, [sessionId, spaceId])

  const submitPrompt = useCallback(
    (prompt: string, selectedModel?: ModelInfo) => {
      const kata = window.kata
      if (!kata?.runSubmit || !sessionId) return

      const selection = toRunSelection(selectedModel)
      lastPromptRef.current = prompt
      dispatch({ type: 'SUBMIT_PROMPT', prompt })

      kata
        .runSubmit({
          sessionId,
          prompt,
          model: selection.model,
          provider: selection.provider
        })
        .catch((error: Error) => {
          dispatch({ type: 'RUN_FAILED', error: error.message })
        })
    },
    [sessionId]
  )

  const retry = useCallback((selectedModel?: ModelInfo) => {
    if (state.runState !== 'error' || !lastPromptRef.current) return

    const kata = window.kata
    if (!kata?.runSubmit || !sessionId) return

    const prompt = lastPromptRef.current
    const selection = toRunSelection(selectedModel)
    dispatch({ type: 'RETRY_FROM_ERROR' })

    kata
      .runSubmit({
        sessionId,
        prompt,
        model: selection.model,
        provider: selection.provider
      })
      .catch((error: Error) => {
        dispatch({ type: 'RUN_FAILED', error: error.message })
      })
  }, [state.runState, sessionId])

  return {
    state,
    submitPrompt,
    retry
  }
}

function buildTaskActivitySnapshotFromPersistedSpecDocument(
  sessionId: string,
  persistedDocument: unknown
): TaskActivitySnapshot | undefined {
  if (!persistedDocument || !isPersistedSpecDocument(persistedDocument)) {
    return undefined
  }

  const hasInvalidFrontmatter = persistedDocument.diagnostics.some(
    (diagnostic) =>
      diagnostic.code === 'invalid_frontmatter_yaml' ||
      diagnostic.code === 'invalid_frontmatter_shape'
  )
  const markdown =
    hasInvalidFrontmatter && persistedDocument.lastGoodMarkdown
      ? persistedDocument.lastGoodMarkdown
      : persistedDocument.markdown
  const tasks = parseTaskItemsFromMarkdown(markdown)
  if (tasks.length === 0) {
    return undefined
  }

  const updatedAt = persistedDocument.updatedAt
  const items: TaskTrackingItem[] = tasks.map((task) => ({
    ...task,
    activityLevel: 'none',
    updatedAt
  }))

  return {
    sessionId,
    runId: persistedDocument.frontmatter.sourceRunId ?? persistedDocument.appliedRunId ?? `spec-${sessionId}`,
    items,
    counts: buildTaskCounts(items)
  }
}

function parseTaskItemsFromMarkdown(markdown: string): Array<{
  id: string
  title: string
  status: TaskTrackingItem['status']
}> {
  const lines = markdown.split(/\r?\n/)
  const taskLines: string[] = []
  let isTasksSection = false

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/)
    if (headingMatch) {
      const normalizedHeading = headingMatch[1].trim().replace(/\s+/g, ' ').toLowerCase()
      isTasksSection = normalizedHeading === 'tasks'
      if (isTasksSection) {
        taskLines.length = 0
      }
      continue
    }

    if (isTasksSection) {
      taskLines.push(line)
    }
  }

  const tasks: Array<{ id: string; title: string; status: TaskTrackingItem['status'] }> = []
  const seenIds = new Map<string, number>()

  for (const line of taskLines) {
    const taskMatch = line.match(/^\s*(?:(?:[-*+]\s+|\d+[.)]\s+))?\[( |\/|x|X)\]\s+(.*?)\s*$/)
    if (!taskMatch) {
      continue
    }

    const marker = taskMatch[1]
    const title = taskMatch[2]

    tasks.push({
      id: toStableTaskId(title, seenIds),
      title,
      status: marker === '/' ? 'in_progress' : marker.toLowerCase() === 'x' ? 'complete' : 'not_started'
    })
  }

  return tasks
}


function isReconciledInterruptedRunFallback(
  status: string,
  errorMessage: string | undefined
): errorMessage is string {
  return status === 'failed' && errorMessage === INTERRUPTED_RUN_ERROR_MESSAGE
}
