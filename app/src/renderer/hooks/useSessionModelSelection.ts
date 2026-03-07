import { useEffect, useState } from 'react'

import type { SessionRecord } from '../../shared/types/space'
import type { ModelInfo } from '../components/center/ModelSelector'
import { FALLBACK_MODEL, resolveSelectedModel } from '../components/center/model-selection'

type SessionModelSelectionState = {
  models: ModelInfo[]
  session: SessionRecord | null
  currentModel: ModelInfo | null
  isHydrated: boolean
  setCurrentModel: (model: ModelInfo) => Promise<void>
}

export function useSessionModelSelection(
  sessionId: string | null
): SessionModelSelectionState {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [currentModel, setCurrentModelState] = useState<ModelInfo | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setModels([])
      setSession(null)
      setCurrentModelState(null)
      setIsHydrated(true)
      return
    }

    let cancelled = false
    setIsHydrated(false)

    void Promise.all([
      window.kata?.sessionGet?.(sessionId) ?? Promise.resolve(null),
      window.kata?.modelList?.() ?? Promise.resolve([])
    ])
      .then(async ([nextSession, nextModels]) => {
        if (cancelled) {
          return
        }

        setSession(nextSession)
        setModels(nextModels)

        const resolved = resolveSelectedModel(nextModels, nextSession?.activeModelId)
        setCurrentModelState(resolved)
        setIsHydrated(true)

        if (
          nextSession?.id &&
          nextSession.activeModelId !== resolved.modelId &&
          typeof window.kata?.sessionSetActiveModel === 'function'
        ) {
          await window.kata.sessionSetActiveModel({
            sessionId: nextSession.id,
            activeModelId: resolved.modelId
          })
        }
      })
      .catch((error: unknown) => {
        console.error('[useSessionModelSelection] Failed to load model selection:', error)
        if (cancelled) {
          return
        }

        setModels([])
        setSession(null)
        setCurrentModelState(FALLBACK_MODEL)
        setIsHydrated(true)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const setCurrentModel = async (model: ModelInfo) => {
    setCurrentModelState(model)

    if (sessionId && typeof window.kata?.sessionSetActiveModel === 'function') {
      await window.kata.sessionSetActiveModel({
        sessionId,
        activeModelId: model.modelId
      })
    }
  }

  return {
    models,
    session,
    currentModel,
    isHydrated,
    setCurrentModel
  }
}
