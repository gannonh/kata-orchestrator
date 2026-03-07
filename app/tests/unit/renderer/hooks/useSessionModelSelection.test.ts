import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useSessionModelSelection', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    delete (window as typeof window & { kata?: unknown }).kata
  })

  it('loads model list plus session activeModelId and exposes the resolved model', async () => {
    ;(window as typeof window & { kata?: unknown }).kata = {
      sessionGet: vi.fn().mockResolvedValue({
        id: 'session-1',
        spaceId: 'space-1',
        label: 'Chat',
        createdAt: '2026-03-06T00:00:00.000Z',
        activeModelId: 'claude-sonnet-4-6-20250514'
      }),
      modelList: vi.fn().mockResolvedValue([
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
      ]),
      sessionSetActiveModel: vi.fn().mockResolvedValue({})
    }

    const { useSessionModelSelection } = await import(
      '../../../../src/renderer/hooks/useSessionModelSelection'
    )
    const { result } = renderHook(() => useSessionModelSelection('session-1'))

    await waitFor(() => {
      expect(result.current.currentModel?.modelId).toBe('claude-sonnet-4-6-20250514')
    })
  })

  it('persists reconciled fallback when persisted model is unavailable', async () => {
    const sessionSetActiveModel = vi.fn().mockResolvedValue({})
    ;(window as typeof window & { kata?: unknown }).kata = {
      sessionGet: vi.fn().mockResolvedValue({
        id: 'session-1',
        spaceId: 'space-1',
        label: 'Chat',
        createdAt: '2026-03-06T00:00:00.000Z',
        activeModelId: 'missing-model'
      }),
      modelList: vi.fn().mockResolvedValue([
        {
          provider: 'openai-codex',
          modelId: 'gpt-5.3-codex',
          name: 'GPT-5.3 Codex',
          authStatus: 'oauth'
        }
      ]),
      sessionSetActiveModel
    }

    const { useSessionModelSelection } = await import(
      '../../../../src/renderer/hooks/useSessionModelSelection'
    )
    renderHook(() => useSessionModelSelection('session-1'))

    await waitFor(() => {
      expect(sessionSetActiveModel).toHaveBeenCalledWith({
        sessionId: 'session-1',
        activeModelId: 'gpt-5.3-codex'
      })
    })
  })

  it('does not repersist the activeModelId when persisted selection is already valid', async () => {
    const sessionGet = vi.fn().mockResolvedValue({
      id: 'session-1',
      spaceId: 'space-1',
      label: 'Chat',
      createdAt: '2026-03-06T00:00:00.000Z',
      activeModelId: 'gpt-5.3-codex'
    })
    const sessionSetActiveModel = vi.fn().mockResolvedValue({})
    ;(window as typeof window & { kata?: unknown }).kata = {
      sessionGet,
      modelList: vi.fn().mockResolvedValue([
        {
          provider: 'openai-codex',
          modelId: 'gpt-5.3-codex',
          name: 'GPT-5.3 Codex',
          authStatus: 'oauth'
        }
      ]),
      sessionSetActiveModel
    }

    const { useSessionModelSelection } = await import(
      '../../../../src/renderer/hooks/useSessionModelSelection'
    )
    renderHook(() => useSessionModelSelection('session-1'))

    await waitFor(() => {
      expect(sessionGet).toHaveBeenCalledWith('session-1')
    })

    expect(sessionSetActiveModel).not.toHaveBeenCalled()
  })
})
