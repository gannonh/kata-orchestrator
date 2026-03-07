import type { ModelInfo } from './ModelSelector'

export const FALLBACK_MODEL: ModelInfo = {
  provider: 'openai-codex',
  modelId: 'gpt-5.3-codex',
  name: 'GPT-5.3 Codex',
  authStatus: 'none'
}

export function resolveSelectedModel(
  models: ModelInfo[],
  activeModelId?: string
): ModelInfo {
  const persisted = activeModelId
    ? models.find(
        (model) => model.modelId === activeModelId && model.authStatus !== 'none'
      )
    : undefined

  if (persisted) {
    return persisted
  }

  const firstAuthenticated = models.find((model) => model.authStatus !== 'none')
  if (firstAuthenticated) {
    return firstAuthenticated
  }

  return models[0] ?? FALLBACK_MODEL
}
