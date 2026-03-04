import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'

import {
  createInitialSessionConversationState,
  sessionConversationReducer
} from '../components/center/sessionConversationState'
import type { LatestRunDraft } from '../types/spec-document'
import type { SessionRuntimeEvent } from '../types/session-runtime-adapter'
import { INTERRUPTED_RUN_ERROR_MESSAGE } from '../../shared/types/run'
import { isPersistedSpecDocument } from '../../shared/types/spec-document'
import { toStableTaskId } from '@shared/task-id'
import type { TaskActivitySnapshot, TaskTrackingItem } from '@shared/types/task-tracking'

const DEFAULT_RUN_MODEL = 'gpt-5.3-codex'
const DEFAULT_RUN_PROVIDER = 'openai-codex'

export function useIpcSessionConversation(sessionId: string | null, spaceId: string | null = null) {
  const [state, dispatch] = useReducer(
    sessionConversationReducer,
    undefined,
    createInitialSessionConversationState
  )
  const [latestDraft, setLatestDraft] = useState<LatestRunDraft | undefined>(undefined)
  const lastPromptRef = useRef<string | null>(null)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const liveSnapshotReceivedRef = useRef(false)

  useLayoutEffect(() => {
    lastPromptRef.current = null
    liveSnapshotReceivedRef.current = false
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
            if (msg.role === 'agent') {
              setLatestDraft(
                run.draft ??
                  buildLatestDraft({
                    prompt: run.prompt,
                    runId: run.id,
                    generatedAt: msg.createdAt
                  })
              )
            }
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

function buildTaskActivitySnapshotFromPersistedSpecDocument(
  sessionId: string,
  persistedDocument: unknown
): TaskActivitySnapshot | undefined {
  if (!persistedDocument || !isPersistedSpecDocument(persistedDocument)) {
    return undefined
  }

  const tasks = parseTaskItemsFromMarkdown(persistedDocument.markdown)
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
    runId: persistedDocument.appliedRunId ?? `spec-${sessionId}`,
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

function buildTaskCounts(items: TaskTrackingItem[]): TaskActivitySnapshot['counts'] {
  const counts: TaskActivitySnapshot['counts'] = {
    not_started: 0,
    in_progress: 0,
    blocked: 0,
    complete: 0
  }

  for (const item of items) {
    counts[item.status] += 1
  }

  return counts
}

function isReconciledInterruptedRunFallback(
  status: string,
  errorMessage: string | undefined
): errorMessage is string {
  return status === 'failed' && errorMessage === INTERRUPTED_RUN_ERROR_MESSAGE
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
