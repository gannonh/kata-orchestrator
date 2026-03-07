import { useEffect, useState } from 'react'

import type { ModelInfo } from '../components/center/ModelSelector'
import { FALLBACK_MODEL, resolveSelectedModel } from '../components/center/model-selection'

type SessionModelSelectionState = {
  models: ModelInfo[]
  currentModel: ModelInfo | null
  isHydrated: boolean
  setCurrentModel: (model: ModelInfo) => Promise<void>
}

export function useSessionModelSelection(
  sessionId: string | null
): SessionModelSelectionState {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [currentModel, setCurrentModelState] = useState<ModelInfo | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setModels([])
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

        setModels(nextModels)

        const resolved = resolveSelectedModel(nextModels, nextSession?.activeModelId)
        setCurrentModelState(resolved)
        setIsHydrated(true)

        if (
          nextSession?.id &&
          nextSession.activeModelId !== undefined &&
          nextSession.activeModelId !== resolved.modelId &&
          typeof window.kata?.sessionSetActiveModel === 'function'
        ) {
          try {
            await window.kata.sessionSetActiveModel({
              sessionId: nextSession.id,
              activeModelId: resolved.modelId
            })
          } catch (reconcileError) {
            console.error(
              '[useSessionModelSelection] Failed to persist reconciled model selection:',
              reconcileError
            )
          }
        }
      })
      .catch((error: unknown) => {
        console.error('[useSessionModelSelection] Failed to load model selection:', error)
        if (cancelled) {
          return
        }

        setModels([])
        setCurrentModelState(FALLBACK_MODEL)
        setIsHydrated(true)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const setCurrentModel = async (model: ModelInfo) => {
    const previousModel = currentModel
    setCurrentModelState(model)

    if (sessionId && typeof window.kata?.sessionSetActiveModel === 'function') {
      try {
        await window.kata.sessionSetActiveModel({
          sessionId,
          activeModelId: model.modelId
        })
      } catch (error) {
        setCurrentModelState(previousModel)
        throw error
      }
    }
  }

  return {
    models,
    currentModel,
    isHydrated,
    setCurrentModel
  }
}
