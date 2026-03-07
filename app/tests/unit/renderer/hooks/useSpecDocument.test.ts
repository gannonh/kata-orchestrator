import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersistedSpecDocument } from '../../../../src/shared/types/spec-document'

const mockSpecGet = vi.fn()
const mockSpecSave = vi.fn()
const mockSpecApplyDraft = vi.fn()
let onRunEventCallback: ((event: unknown) => void) | null = null
const mockOnRunEvent = vi.fn((cb: (event: unknown) => void) => {
  onRunEventCallback = cb
  return () => {
    onRunEventCallback = null
  }
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

async function loadHook() {
  const mod = await import('../../../../src/renderer/hooks/useSpecDocument')
  return mod.useSpecDocument
}

function buildPersistedSpecDocument(
  markdown: string,
  overrides: Partial<PersistedSpecDocument> = {}
): PersistedSpecDocument {
  const updatedAt = overrides.updatedAt ?? '2026-03-03T00:00:00.000Z'
  const baseSourceRunId = overrides.frontmatter?.sourceRunId ?? overrides.appliedRunId
  const frontmatter = {
    status: 'drafting' as const,
    updatedAt,
    ...(baseSourceRunId !== undefined && { sourceRunId: baseSourceRunId }),
    ...overrides.frontmatter
  }

  return {
    sourcePath: '/tmp/repo/.kata/sessions/session-1/notes/spec.md',
    raw:
      overrides.raw ??
      [
        '---',
        `status: ${frontmatter.status}`,
        `updatedAt: ${frontmatter.updatedAt}`,
        ...(frontmatter.sourceRunId ? [`sourceRunId: ${frontmatter.sourceRunId}`] : []),
        '---',
        '',
        markdown
      ].join('\n'),
    markdown,
    frontmatter,
    diagnostics: overrides.diagnostics ?? [],
    updatedAt,
    ...(frontmatter.sourceRunId !== undefined && { appliedRunId: frontmatter.sourceRunId }),
    ...overrides
  }
}

describe('useSpecDocument', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mockSpecGet.mockResolvedValue(null)
    mockSpecSave.mockImplementation(
      async (input: {
        markdown: string
        status?: 'drafting' | 'ready'
        sourceRunId?: string
      }) =>
        buildPersistedSpecDocument(input.markdown, {
          updatedAt: '2026-03-03T00:00:00.000Z',
          frontmatter: {
            status: input.status ?? 'drafting',
            updatedAt: '2026-03-03T00:00:00.000Z',
            ...(input.sourceRunId !== undefined && { sourceRunId: input.sourceRunId })
          }
        })
    )
    mockSpecApplyDraft.mockResolvedValue(buildPersistedSpecDocument('# unused'))
    onRunEventCallback = null

    ;(window as any).kata = {
      specGet: mockSpecGet,
      specSave: mockSpecSave,
      specApplyDraft: mockSpecApplyDraft,
      onRunEvent: mockOnRunEvent
    }
  })

  afterEach(() => {
    delete (window as any).kata
  })

  it('loads an existing document via specGet and preserves markdown-first fields', async () => {
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument(
        ['# Live spec', '', '## Goal', 'Load from IPC'].join('\n'),
        {
          updatedAt: '2026-03-03T00:00:00.000Z',
          frontmatter: {
            status: 'ready',
            updatedAt: '2026-03-03T00:00:00.000Z',
            sourceRunId: 'run-123'
          }
        }
      )
    )

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    await waitFor(() => {
      expect(mockSpecGet).toHaveBeenCalledWith({ spaceId: 'space-1', sessionId: 'session-1' })
      expect(result.current.document).toMatchObject({
        sourcePath: '/tmp/repo/.kata/sessions/session-1/notes/spec.md',
        markdown: ['# Live spec', '', '## Goal', 'Load from IPC'].join('\n'),
        status: 'ready',
        sourceRunId: 'run-123',
        appliedRunId: 'run-123'
      })
      expect((result.current.document as any).visibleMarkdown).toBe(
        ['# Live spec', '', '## Goal', 'Load from IPC'].join('\n')
      )
    })
  })

  it('uses lastGoodMarkdown as the visible document when frontmatter is invalid', async () => {
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument('## Goal\nBroken replacement', {
        diagnostics: [
          {
            code: 'invalid_frontmatter_yaml',
            message: 'Frontmatter must contain only key: value entries.'
          }
        ],
        lastGoodMarkdown: ['# Live spec', '', '## Goal', 'Last good visible markdown'].join('\n')
      })
    )

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    await waitFor(() => {
      expect(result.current.document.markdown).toBe('## Goal\nBroken replacement')
      expect((result.current.document as any).visibleMarkdown).toBe(
        ['# Live spec', '', '## Goal', 'Last good visible markdown'].join('\n')
      )
      expect(result.current.document.diagnostics[0]?.code).toBe('invalid_frontmatter_yaml')
    })
  })

  it('persists markdown through specSave and keeps the visible document aligned', async () => {
    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )
    const markdown = ['# Live spec', '', '## Goal', 'Ship panel parity.'].join('\n')

    act(() => {
      result.current.setMarkdown(markdown)
    })

    expect(result.current.document.markdown).toBe(markdown)
    expect((result.current.document as any).visibleMarkdown).toBe(markdown)
    expect(mockSpecSave).toHaveBeenCalledWith({
      spaceId: 'space-1',
      sessionId: 'session-1',
      markdown,
      status: 'drafting'
    })
  })

  it('keeps documents isolated by session key in local fallback cache', async () => {
    mockSpecGet.mockResolvedValue(null)

    const useSpecDocument = await loadHook()
    const first = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    act(() => {
      first.result.current.setMarkdown('# Session one only')
    })

    const second = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-2' })
    )
    const firstReloaded = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    expect(second.result.current.document.markdown).toBe('')
    expect(firstReloaded.result.current.document.markdown).toBe('# Session one only')
  })

  it('falls back to an empty document when specGet payload is malformed', async () => {
    mockSpecGet.mockResolvedValueOnce({ markdown: 42, appliedRunId: 'run-1' })

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    await waitFor(() => {
      expect(result.current.document.markdown).toBe('')
      expect((result.current.document as any).visibleMarkdown).toBe('')
    })
  })

  it('keeps local state when specSave rejects', async () => {
    mockSpecSave.mockRejectedValueOnce(new Error('ipc unavailable'))

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    act(() => {
      result.current.setMarkdown('# Persist locally')
    })

    expect(result.current.document.markdown).toBe('# Persist locally')
    expect((result.current.document as any).visibleMarkdown).toBe('# Persist locally')
    expect(mockSpecSave).toHaveBeenCalledTimes(1)
  })

  it('ignores stale specGet results after switching sessions', async () => {
    const first = createDeferred<PersistedSpecDocument | null>()
    mockSpecGet
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(
        buildPersistedSpecDocument('# Session 2 persisted', {
          updatedAt: '2026-03-03T00:00:00.000Z'
        })
      )

    const useSpecDocument = await loadHook()
    const { result, rerender } = renderHook(
      ({ spaceId, sessionId }: { spaceId: string; sessionId: string }) =>
        useSpecDocument({ spaceId, sessionId }),
      { initialProps: { spaceId: 'space-1', sessionId: 'session-1' } }
    )

    rerender({ spaceId: 'space-1', sessionId: 'session-2' })
    first.resolve(
      buildPersistedSpecDocument('# Stale session 1 value', {
        updatedAt: '2026-03-03T00:00:00.000Z'
      })
    )

    await waitFor(() => {
      expect(result.current.document.markdown).toBe('# Session 2 persisted')
    })
  })

  it('ignores stale specSave results after switching sessions', async () => {
    const saveDeferred = createDeferred<PersistedSpecDocument>()
    mockSpecSave.mockImplementationOnce(() => saveDeferred.promise)
    mockSpecGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        buildPersistedSpecDocument('# Session 2 canonical', {
          updatedAt: '2026-03-03T00:00:00.000Z'
        })
      )

    const useSpecDocument = await loadHook()
    const { result, rerender } = renderHook(
      ({ spaceId, sessionId }: { spaceId: string; sessionId: string }) =>
        useSpecDocument({ spaceId, sessionId }),
      { initialProps: { spaceId: 'space-1', sessionId: 'session-1' } }
    )

    act(() => {
      result.current.setMarkdown('# Session 1 local write')
    })

    rerender({ spaceId: 'space-1', sessionId: 'session-2' })
    saveDeferred.resolve(
      buildPersistedSpecDocument('# Session 1 stale save response', {
        updatedAt: '2026-03-03T00:00:00.000Z'
      })
    )

    await waitFor(() => {
      expect(result.current.document.markdown).toBe('# Session 2 canonical')
    })
  })

  it('refreshes from specGet when an agent message is appended after a run writes the artifact', async () => {
    mockSpecGet
      .mockResolvedValueOnce(buildPersistedSpecDocument('## Goal\nScaffold'))
      .mockResolvedValueOnce(
        buildPersistedSpecDocument(
          ['## Goal', 'Generated from the orchestrator run.', '', '## Tasks', '- [ ] Ship it'].join('\n'),
          {
            updatedAt: '2026-03-03T00:05:00.000Z',
            frontmatter: {
              status: 'drafting',
              updatedAt: '2026-03-03T00:05:00.000Z',
              sourceRunId: 'run-spec-1'
            }
          }
        )
      )

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    await waitFor(() => {
      expect(result.current.document.markdown).toBe('## Goal\nScaffold')
    })

    await act(async () => {
      onRunEventCallback?.({
        type: 'message_appended',
        runId: 'run-spec-1',
        message: {
          id: 'agent-status-1',
          role: 'agent',
          content: "I've created an initial draft of the project spec.",
          createdAt: '2026-03-03T00:05:01.000Z'
        }
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(mockSpecGet).toHaveBeenCalledTimes(2)
      expect(result.current.document.markdown).toContain('Generated from the orchestrator run.')
      expect(result.current.document.sourceRunId).toBe('run-spec-1')
      expect(result.current.generationPhase).toBeNull()
    })
  })

  it('tracks generation phases from run events before the spec artifact appears', async () => {
    mockSpecGet.mockResolvedValue(buildPersistedSpecDocument(''))

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    expect(result.current.generationPhase).toBeNull()

    await act(async () => {
      onRunEventCallback?.({
        type: 'run_state_changed',
        runState: 'pending'
      })
      await Promise.resolve()
    })

    expect(result.current.generationPhase).toBe('thinking')

    await act(async () => {
      onRunEventCallback?.({
        type: 'message_updated',
        runId: 'run-spec-1',
        message: {
          id: 'agent-spec-1',
          role: 'agent',
          content: 'Drafting',
          createdAt: '2026-03-03T00:05:01.000Z'
        }
      })
      await Promise.resolve()
    })

    expect(result.current.generationPhase).toBe('drafting')
  })

  it('clears the generation phase when a run error event arrives', async () => {
    mockSpecGet.mockResolvedValue(buildPersistedSpecDocument(''))

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    await act(async () => {
      onRunEventCallback?.({
        type: 'run_state_changed',
        runState: 'pending'
      })
      await Promise.resolve()
    })

    expect(result.current.generationPhase).toBe('thinking')

    await act(async () => {
      onRunEventCallback?.({
        type: 'run_state_changed',
        runState: 'error',
        errorMessage: 'agent failed'
      })
      await Promise.resolve()
    })

    expect(result.current.generationPhase).toBeNull()
  })

  it('keeps local markdown when specSave is unavailable', async () => {
    ;(window as any).kata = {
      ...window.kata,
      specGet: mockSpecGet,
      onRunEvent: mockOnRunEvent
    }

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    act(() => {
      result.current.setMarkdown('# Local only')
    })

    expect(result.current.document.markdown).toBe('# Local only')
  })

  it('includes sourceRunId when persisting a document that carries trace metadata', async () => {
    mockSpecGet.mockResolvedValueOnce(
      buildPersistedSpecDocument('# Trace this', {
        frontmatter: {
          status: 'drafting',
          updatedAt: '2026-03-03T00:00:00.000Z',
          sourceRunId: 'run-trace-1'
        }
      })
    )

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    await waitFor(() => {
      expect(result.current.document.sourceRunId).toBe('run-trace-1')
    })

    act(() => {
      result.current.setMarkdown('# Trace this forward')
    })

    expect(mockSpecSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sourceRunId: 'run-trace-1'
      })
    )
  })
})
