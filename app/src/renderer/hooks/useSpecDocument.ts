import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { StructuredSpecDocument } from '../types/spec-document'
import type { SpecArtifactStatus } from '../../shared/types/spec-document'
import { isPersistedSpecDocument } from '../../shared/types/spec-document'
import type { PersistedSpecDocument } from '../../shared/types/spec-document'

interface UseSpecDocumentParams {
  spaceId: string
  sessionId: string
  enabled?: boolean
}

const fallbackDocumentCache = new Map<string, StructuredSpecDocument>()

function buildCacheKey(spaceId: string, sessionId: string): string {
  return `${spaceId}:${sessionId}`
}

function readFallbackDocument(storageKey: string): StructuredSpecDocument {
  const cached = fallbackDocumentCache.get(storageKey)
  if (!cached) {
    return buildDocument({
      markdown: ''
    })
  }

  return cached
}

function cacheDocument(storageKey: string, document: StructuredSpecDocument) {
  fallbackDocumentCache.set(storageKey, document)
}

function buildDocument(input: {
  markdown: string
  visibleMarkdown?: string
  sourcePath?: string
  raw?: string
  status?: SpecArtifactStatus
  diagnostics?: PersistedSpecDocument['diagnostics']
  updatedAt?: string
  sourceRunId?: string
}): StructuredSpecDocument {
  const document: StructuredSpecDocument = {
    sourcePath: input.sourcePath ?? '',
    raw: input.raw ?? input.markdown,
    status: input.status ?? 'drafting',
    visibleMarkdown: input.visibleMarkdown ?? input.markdown,
    markdown: input.markdown,
    diagnostics: input.diagnostics ?? [],
    updatedAt: input.updatedAt ?? ''
  }

  if (input.sourceRunId) {
    document.sourceRunId = input.sourceRunId
    document.appliedRunId = input.sourceRunId
  }

  return document
}

function buildDocumentFromPersisted(persistedDocument: PersistedSpecDocument): StructuredSpecDocument {
  const hasFrontmatterDiagnostics = persistedDocument.diagnostics.some(
    (diagnostic) =>
      diagnostic.code === 'invalid_frontmatter_yaml' ||
      diagnostic.code === 'invalid_frontmatter_shape'
  )

  return buildDocument({
    sourcePath: persistedDocument.sourcePath,
    raw: persistedDocument.raw,
    markdown: persistedDocument.markdown,
    visibleMarkdown:
      hasFrontmatterDiagnostics && persistedDocument.lastGoodMarkdown
        ? persistedDocument.lastGoodMarkdown
        : persistedDocument.markdown,
    status: persistedDocument.frontmatter.status,
    diagnostics: persistedDocument.diagnostics,
    updatedAt: persistedDocument.updatedAt,
    sourceRunId: persistedDocument.frontmatter.sourceRunId
  })
}

export function useSpecDocument({ spaceId, sessionId, enabled = true }: UseSpecDocumentParams) {
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
  const [generationPhase, setGenerationPhase] = useState<'thinking' | 'drafting' | null>(null)

  useLayoutEffect(() => {
    if (state.storageKey !== storageKey) {
      setState({
        storageKey,
        document: readFallbackDocument(storageKey)
      })
    }
    setGenerationPhase(null)
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

      const nextDocument = buildDocumentFromPersisted(persistedDocument)
      fallbackDocumentCache.set(expectedStorageKey, nextDocument)
      setDocumentState(nextDocument)
      if (nextDocument.visibleMarkdown.trim().length > 0) {
        setGenerationPhase(null)
      }
    },
    [setDocumentState]
  )

  const refreshFromSource = useCallback(
    (expectedStorageKey: string, expectedMutationVersion: number) => {
      const specGet = window.kata?.specGet
      if (typeof specGet !== 'function') {
        return Promise.resolve()
      }

      return specGet({ spaceId, sessionId })
        .then((persistedDocument) => {
          if (persistedDocument !== null && !isPersistedSpecDocument(persistedDocument)) {
            applyPersistedDocument(null, expectedStorageKey, expectedMutationVersion)
            return
          }

          applyPersistedDocument(persistedDocument, expectedStorageKey, expectedMutationVersion)
        })
        .catch(() => {
          // Keep the fallback document if IPC is unavailable.
        })
    },
    [applyPersistedDocument, sessionId, spaceId]
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    const expectedMutationVersion = mutationVersionRef.current
    let isCancelled = false

    void refreshFromSource(storageKey, expectedMutationVersion).then(() => {
      if (isCancelled) {
        return
      }
    })

    return () => {
      isCancelled = true
    }
  }, [enabled, refreshFromSource, storageKey])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const onRunEvent = window.kata?.onRunEvent
    if (typeof onRunEvent !== 'function') {
      return
    }

    return onRunEvent((event) => {
      if (event.type === 'run_state_changed') {
        if (event.runState === 'pending') {
          setGenerationPhase('thinking')
        } else if (event.runState === 'error') {
          setGenerationPhase(null)
        }
        return
      }

      if (
        (event.type === 'message_updated' || event.type === 'message_appended') &&
        event.message.role === 'agent'
      ) {
        setGenerationPhase('drafting')

        if (event.type === 'message_appended') {
          void refreshFromSource(activeStorageKeyRef.current, mutationVersionRef.current)
        }
      }
    })
  }, [enabled, refreshFromSource])

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
        status?: SpecArtifactStatus
        sourceRunId?: string
      } = {
        spaceId,
        sessionId,
        markdown: nextDocument.markdown
      }
      if (nextDocument.status !== undefined) {
        input.status = nextDocument.status
      }
      if (nextDocument.sourceRunId !== undefined) {
        input.sourceRunId = nextDocument.sourceRunId
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
      persistDocument(
        buildDocument({
          markdown,
          visibleMarkdown: markdown,
          sourcePath: documentRef.current.sourcePath,
          status: documentRef.current.status,
          diagnostics: documentRef.current.diagnostics,
          updatedAt: documentRef.current.updatedAt,
          sourceRunId: documentRef.current.sourceRunId
        })
      )
    },
    [persistDocument]
  )

  return useMemo(
    () => ({ document: activeState.document, setMarkdown, generationPhase }),
    [activeState.document, generationPhase, setMarkdown]
  )
}
