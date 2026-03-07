import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useSessionModelSelection', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    delete (window as typeof window & { kata?: unknown }).kata
  })

  function createDeferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((innerResolve, innerReject) => {
      resolve = innerResolve
      reject = innerReject
    })

    return { promise, resolve, reject }
  }

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

  it('persists a user-selected model through setCurrentModel', async () => {
    const sessionSetActiveModel = vi.fn().mockResolvedValue({})
    ;(window as typeof window & { kata?: unknown }).kata = {
      sessionGet: vi.fn().mockResolvedValue({
        id: 'session-1',
        spaceId: 'space-1',
        label: 'Chat',
        createdAt: '2026-03-06T00:00:00.000Z',
        activeModelId: 'gpt-5.3-codex'
      }),
      modelList: vi.fn().mockResolvedValue([
        {
          provider: 'openai-codex',
          modelId: 'gpt-5.3-codex',
          name: 'GPT-5.3 Codex',
          authStatus: 'oauth'
        },
        {
          provider: 'openai',
          modelId: 'gpt-4.1-2025-04-14',
          name: 'GPT-4.1',
          authStatus: 'oauth'
        }
      ]),
      sessionSetActiveModel
    }

    const { useSessionModelSelection } = await import(
      '../../../../src/renderer/hooks/useSessionModelSelection'
    )
    const { result } = renderHook(() => useSessionModelSelection('session-1'))

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    await act(async () => {
      await result.current.setCurrentModel({
        provider: 'openai',
        modelId: 'gpt-4.1-2025-04-14',
        name: 'GPT-4.1',
        authStatus: 'oauth'
      })
    })

    expect(result.current.currentModel?.modelId).toBe('gpt-4.1-2025-04-14')
    expect(sessionSetActiveModel).toHaveBeenCalledWith({
      sessionId: 'session-1',
      activeModelId: 'gpt-4.1-2025-04-14'
    })
  })

  it('falls back to the emergency model and hydrates when loading fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(window as typeof window & { kata?: unknown }).kata = {
      sessionGet: vi.fn().mockRejectedValue(new Error('load failed')),
      modelList: vi.fn().mockResolvedValue([]),
      sessionSetActiveModel: vi.fn()
    }

    const { useSessionModelSelection } = await import(
      '../../../../src/renderer/hooks/useSessionModelSelection'
    )
    const { result } = renderHook(() => useSessionModelSelection('session-1'))

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(result.current.currentModel?.modelId).toBe('gpt-5.3-codex')
    expect(result.current.models).toEqual([])
    expect(result.current.session).toBeNull()
    expect(consoleError).toHaveBeenCalledWith(
      '[useSessionModelSelection] Failed to load model selection:',
      expect.any(Error)
    )

    consoleError.mockRestore()
  })

  it('does not update state after unmount when an in-flight load resolves', async () => {
    const sessionDeferred = createDeferred<{
      id: string
      spaceId: string
      label: string
      createdAt: string
      activeModelId: string
    }>()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sessionSetActiveModel = vi.fn().mockResolvedValue({})
    ;(window as typeof window & { kata?: unknown }).kata = {
      sessionGet: vi.fn().mockReturnValue(sessionDeferred.promise),
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
    const { result, unmount } = renderHook(() => useSessionModelSelection('session-1'))

    unmount()

    await act(async () => {
      sessionDeferred.resolve({
        id: 'session-1',
        spaceId: 'space-1',
        label: 'Chat',
        createdAt: '2026-03-06T00:00:00.000Z',
        activeModelId: 'gpt-5.3-codex'
      })
      await Promise.resolve()
    })

    expect(result.current.currentModel).toBeNull()
    expect(sessionSetActiveModel).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()

    consoleError.mockRestore()
  })

  it('does not update state after unmount when an in-flight load rejects', async () => {
    const sessionDeferred = createDeferred<never>()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(window as typeof window & { kata?: unknown }).kata = {
      sessionGet: vi.fn().mockReturnValue(sessionDeferred.promise),
      modelList: vi.fn().mockResolvedValue([]),
      sessionSetActiveModel: vi.fn()
    }

    const { useSessionModelSelection } = await import(
      '../../../../src/renderer/hooks/useSessionModelSelection'
    )
    const { result, unmount } = renderHook(() => useSessionModelSelection('session-1'))

    unmount()

    await act(async () => {
      sessionDeferred.reject(new Error('cancelled load'))
      await Promise.resolve()
    })

    expect(result.current.currentModel).toBeNull()
    expect(consoleError).toHaveBeenCalledWith(
      '[useSessionModelSelection] Failed to load model selection:',
      expect.any(Error)
    )

    consoleError.mockRestore()
  })
})
