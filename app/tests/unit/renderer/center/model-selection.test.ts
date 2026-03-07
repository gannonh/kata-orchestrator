import { describe, expect, it } from 'vitest'

import {
  FALLBACK_MODEL,
  resolveSelectedModel
} from '../../../../src/renderer/components/center/model-selection'
import type { ModelInfo } from '../../../../src/renderer/components/center/ModelSelector'

const models: ModelInfo[] = [
  {
    provider: 'openai-codex',
    modelId: 'gpt-5.3-codex',
    name: 'GPT-5.3 Codex',
    authStatus: 'oauth'
  },
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6-20250514',
    name: 'Claude Sonnet 4.6',
    authStatus: 'api_key'
  }
]

describe('resolveSelectedModel', () => {
  it('keeps a valid authenticated persisted model', () => {
    expect(resolveSelectedModel(models, 'claude-sonnet-4-6-20250514')).toMatchObject({
      modelId: 'claude-sonnet-4-6-20250514'
    })
  })

  it('falls back to the first authenticated model when persisted id is unknown', () => {
    expect(resolveSelectedModel(models, 'unknown')).toMatchObject({
      modelId: 'gpt-5.3-codex'
    })
  })

  it('prefers the first authenticated model when the persisted model is unauthenticated', () => {
    expect(
      resolveSelectedModel(
        [
          {
            provider: 'openai-codex',
            modelId: 'gpt-5.3-codex',
            name: 'GPT-5.3 Codex',
            authStatus: 'none'
          },
          {
            provider: 'anthropic',
            modelId: 'claude-sonnet-4-6-20250514',
            name: 'Claude Sonnet 4.6',
            authStatus: 'api_key'
          }
        ],
        'gpt-5.3-codex'
      )
    ).toMatchObject({
      modelId: 'claude-sonnet-4-6-20250514'
    })
  })

  it('falls back to the constant emergency model when list is empty', () => {
    expect(resolveSelectedModel([], undefined)).toEqual(FALLBACK_MODEL)
  })
})
