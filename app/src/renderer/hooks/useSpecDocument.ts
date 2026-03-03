import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { parseStructuredSpec } from '../components/right/spec-parser'
import {
  cycleTaskStatus,
  updateTaskLineInMarkdown
} from '../components/right/spec-task-markdown'
import type { LatestRunDraft, StructuredSpecDocument } from '../types/spec-document'
import { isPersistedSpecDocument } from '../../shared/types/spec-document'
import type { PersistedSpecDocument } from '../../shared/types/spec-document'

interface UseSpecDocumentParams {
  spaceId: string
  sessionId: string
}

const fallbackDocumentCache = new Map<string, PersistedSpecDocument>()

function buildCacheKey(spaceId: string, sessionId: string): string {
  return `${spaceId}:${sessionId}`
}

function readFallbackDocument(storageKey: string): StructuredSpecDocument {
  const cached = fallbackDocumentCache.get(storageKey)
  if (!cached) {
    return parseStructuredSpec('')
  }

  return buildDocument(cached.markdown, cached.appliedRunId, cached.updatedAt)
}

function cacheDocument(storageKey: string, document: StructuredSpecDocument) {
  const cached: PersistedSpecDocument = {
    markdown: document.markdown,
    updatedAt: document.updatedAt
  }

  if (document.appliedRunId !== undefined) {
    cached.appliedRunId = document.appliedRunId
  }

  fallbackDocumentCache.set(storageKey, cached)
}

function buildDocument(
  markdown: string,
  appliedRunId?: string,
  updatedAt?: string
): StructuredSpecDocument {
  const parsed = parseStructuredSpec(markdown)

  const document: StructuredSpecDocument = {
    ...parsed
  }

  if (appliedRunId) {
    document.appliedRunId = appliedRunId
  }

  if (updatedAt) {
    document.updatedAt = updatedAt
  }

  return document
}

export function useSpecDocument({ spaceId, sessionId }: UseSpecDocumentParams) {
  const storageKey = useMemo(
    () => buildCacheKey(spaceId, sessionId),
    [sessionId, spaceId]
  )
  const [state, setState] = useState(() => ({
    storageKey,
    document: readFallbackDocument(storageKey)
  }))
  const activeState =
    state.storageKey === storageKey
      ? state
      : {
          storageKey,
          document: readFallbackDocument(storageKey)
        }
  const documentRef = useRef(activeState.document)
  documentRef.current = activeState.document
  const activeStorageKeyRef = useRef(storageKey)
  activeStorageKeyRef.current = storageKey
  const mutationVersionRef = useRef(0)

  useLayoutEffect(() => {
    if (state.storageKey !== storageKey) {
      setState({
        storageKey,
        document: readFallbackDocument(storageKey)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state.storageKey is read but intentionally excluded to avoid re-running on every setState
  }, [storageKey])

  const setDocumentState = useCallback(
    (nextDocument: StructuredSpecDocument) => {
      documentRef.current = nextDocument
      setState({
        storageKey,
        document: nextDocument
      })
    },
    [storageKey]
  )

  const applyPersistedDocument = useCallback(
    (
      persistedDocument: PersistedSpecDocument | null,
      expectedStorageKey: string,
      expectedMutationVersion: number
    ) => {
      if (activeStorageKeyRef.current !== expectedStorageKey) {
        return
      }

      if (mutationVersionRef.current !== expectedMutationVersion) {
        return
      }

      if (!persistedDocument || !isPersistedSpecDocument(persistedDocument)) {
        setDocumentState(readFallbackDocument(expectedStorageKey))
        return
      }

      fallbackDocumentCache.set(expectedStorageKey, persistedDocument)
      setDocumentState(
        buildDocument(
          persistedDocument.markdown,
          persistedDocument.appliedRunId,
          persistedDocument.updatedAt
        )
      )
    },
    [setDocumentState]
  )

  useEffect(() => {
    const specGet = window.kata?.specGet
    if (typeof specGet !== 'function') {
      return
    }

    const expectedMutationVersion = mutationVersionRef.current
    let isCancelled = false

    void specGet({ spaceId, sessionId })
      .then((persistedDocument) => {
        if (isCancelled) {
          return
        }

        if (persistedDocument !== null && !isPersistedSpecDocument(persistedDocument)) {
          applyPersistedDocument(null, storageKey, expectedMutationVersion)
          return
        }

        applyPersistedDocument(persistedDocument, storageKey, expectedMutationVersion)
      })
      .catch(() => {
        // Keep the fallback document if IPC is unavailable.
      })

    return () => {
      isCancelled = true
    }
  }, [applyPersistedDocument, sessionId, spaceId, storageKey])

  const persistDocument = useCallback(
    (nextDocument: StructuredSpecDocument) => {
      mutationVersionRef.current += 1
      const currentMutationVersion = mutationVersionRef.current

      cacheDocument(storageKey, nextDocument)
      setDocumentState(nextDocument)

      const specSave = window.kata?.specSave
      if (typeof specSave !== 'function') {
        return
      }

      const input: {
        spaceId: string
        sessionId: string
        markdown: string
        appliedRunId?: string
      } = {
        spaceId,
        sessionId,
        markdown: nextDocument.markdown
      }
      if (nextDocument.appliedRunId !== undefined) {
        input.appliedRunId = nextDocument.appliedRunId
      }

      void specSave(input)
        .then((persistedDocument) => {
          applyPersistedDocument(persistedDocument, storageKey, currentMutationVersion)
        })
        .catch(() => {
          // Keep local state when save fails.
        })
    },
    [applyPersistedDocument, sessionId, setDocumentState, spaceId, storageKey]
  )

  const setMarkdown = useCallback(
    (markdown: string) => {
      persistDocument(buildDocument(markdown, documentRef.current.appliedRunId))
    },
    [persistDocument]
  )

  const applyDraft = useCallback(
    (draft: LatestRunDraft) => {
      mutationVersionRef.current += 1
      const currentMutationVersion = mutationVersionRef.current

      const nextDocument = buildDocument(draft.content, draft.runId)
      cacheDocument(storageKey, nextDocument)
      setDocumentState(nextDocument)

      const specApplyDraft = window.kata?.specApplyDraft
      if (typeof specApplyDraft !== 'function') {
        return
      }

      void specApplyDraft({ spaceId, sessionId, draft })
        .then((persistedDocument) => {
          applyPersistedDocument(persistedDocument, storageKey, currentMutationVersion)
        })
        .catch(() => {
          // Keep local state when applyDraft IPC is unavailable.
        })
    },
    [applyPersistedDocument, sessionId, setDocumentState, spaceId, storageKey]
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
