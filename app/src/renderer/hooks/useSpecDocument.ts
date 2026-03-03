import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { parseStructuredSpec } from '../components/right/spec-parser'
import {
  cycleTaskStatus,
  updateTaskLineInMarkdown
} from '../components/right/spec-task-markdown'
import type { LatestRunDraft, StructuredSpecDocument } from '../types/spec-document'

const STORAGE_KEY_PREFIX = 'kata.spec-panel.v1'

interface UseSpecDocumentParams {
  spaceId: string
  sessionId: string
}

type PersistedSpecDocument = {
  markdown: string
  appliedRunId?: string
}

function createStorageKey(spaceId: string, sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}:${spaceId}:${sessionId}`
}

function isPersistedSpecDocument(value: unknown): value is PersistedSpecDocument {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as {
    markdown?: unknown
    appliedRunId?: unknown
  }

  if (typeof candidate.markdown !== 'string') {
    return false
  }

  return (
    candidate.appliedRunId === undefined ||
    typeof candidate.appliedRunId === 'string'
  )
}

function readStoredDocument(storageKey: string): StructuredSpecDocument {
  const storedValue = window.localStorage.getItem(storageKey)

  if (!storedValue) {
    return parseStructuredSpec('')
  }

  try {
    const parsed = JSON.parse(storedValue) as unknown

    if (!isPersistedSpecDocument(parsed)) {
      return parseStructuredSpec('')
    }

    return buildDocument(parsed.markdown, parsed.appliedRunId)
  } catch (err) {
    console.warn('[useSpecDocument] Failed to parse stored document:', err)
    return parseStructuredSpec('')
  }
}

function buildDocument(markdown: string, appliedRunId?: string): StructuredSpecDocument {
  const parsed = parseStructuredSpec(markdown)

  if (!appliedRunId) {
    return parsed
  }

  return {
    ...parsed,
    appliedRunId
  }
}

export function useSpecDocument({ spaceId, sessionId }: UseSpecDocumentParams) {
  const storageKey = useMemo(
    () => createStorageKey(spaceId, sessionId),
    [sessionId, spaceId]
  )
  const [state, setState] = useState(() => ({
    storageKey,
    document: readStoredDocument(storageKey)
  }))
  const activeState =
    state.storageKey === storageKey
      ? state
      : {
          storageKey,
          document: readStoredDocument(storageKey)
        }
  const documentRef = useRef(activeState.document)
  documentRef.current = activeState.document

  useLayoutEffect(() => {
    if (state.storageKey !== storageKey) {
      setState({
        storageKey,
        document: readStoredDocument(storageKey)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state.storageKey is read but intentionally excluded to avoid re-running on every setState
  }, [storageKey])

  const persistDocument = useCallback(
    (nextDocument: StructuredSpecDocument) => {
      const payload: PersistedSpecDocument = {
        markdown: nextDocument.markdown,
        appliedRunId: nextDocument.appliedRunId
      }

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(payload))
      } catch (err) {
        console.error('[useSpecDocument] Failed to persist document:', err)
        return
      }

      documentRef.current = nextDocument
      setState({
        storageKey,
        document: nextDocument
      })
    },
    [storageKey]
  )

  const setMarkdown = useCallback(
    (markdown: string) => {
      persistDocument(buildDocument(markdown, documentRef.current.appliedRunId))
    },
    [persistDocument]
  )

  const applyDraft = useCallback(
    (draft: LatestRunDraft) => {
      persistDocument(buildDocument(draft.content, draft.runId))
    },
    [persistDocument]
  )

  const toggleTask = useCallback(
    (taskId: string) => {
      const currentDocument = documentRef.current
      const currentTask = currentDocument.tasks.find((task) => task.id === taskId)

      if (!currentTask) {
        return
      }

      const nextStatus = cycleTaskStatus(currentTask.status)
      const nextMarkdown = updateTaskLineInMarkdown(
        currentDocument.markdown,
        currentTask.markdownLineIndex,
        nextStatus
      )

      persistDocument(buildDocument(nextMarkdown, currentDocument.appliedRunId))
    },
    [persistDocument]
  )

  return useMemo(
    () => ({ document: activeState.document, setMarkdown, applyDraft, toggleTask }),
    [activeState.document, setMarkdown, applyDraft, toggleTask]
  )
}
