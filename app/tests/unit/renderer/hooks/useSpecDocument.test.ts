import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSpecGet = vi.fn()
const mockSpecSave = vi.fn()
const mockSpecApplyDraft = vi.fn()

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

describe('useSpecDocument', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mockSpecGet.mockResolvedValue(null)
    mockSpecSave.mockImplementation(async (input: { markdown: string; appliedRunId?: string }) => ({
      markdown: input.markdown,
      updatedAt: '2026-03-03T00:00:00.000Z',
      appliedRunId: input.appliedRunId
    }))
    mockSpecApplyDraft.mockImplementation(async (input: {
      draft: { runId: string; content: string }
    }) => ({
      markdown: input.draft.content,
      updatedAt: '2026-03-03T00:01:00.000Z',
      appliedRunId: input.draft.runId,
      appliedAt: '2026-03-03T00:01:00.000Z'
    }))

    ;(window as any).kata = {
      specGet: mockSpecGet,
      specSave: mockSpecSave,
      specApplyDraft: mockSpecApplyDraft
    }
  })

  afterEach(() => {
    delete (window as any).kata
  })

  it('loads an existing document via specGet', async () => {
    mockSpecGet.mockResolvedValueOnce({
      markdown: ['## Goal', 'Load from IPC', '', '## Tasks', '- [x] Restore saved specs'].join('\n'),
      updatedAt: '2026-03-03T00:00:00.000Z',
      appliedRunId: 'run-123'
    })

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    await waitFor(() => {
      expect(mockSpecGet).toHaveBeenCalledWith({ spaceId: 'space-1', sessionId: 'session-1' })
      expect(result.current.document).toMatchObject({
        markdown: ['## Goal', 'Load from IPC', '', '## Tasks', '- [x] Restore saved specs'].join('\n'),
        appliedRunId: 'run-123',
        sections: {
          goal: 'Load from IPC'
        },
        tasks: [
          {
            id: 'task-1',
            title: 'Restore saved specs',
            status: 'complete'
          }
        ]
      })
    })
  })

  it('parses markdown and persists through specSave', async () => {
    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )
    const markdown = [
      '## Goal',
      'Ship panel parity.',
      '',
      '## Acceptance Criteria',
      '1. Persist parsed output',
      '',
      '## Tasks',
      '- [ ] Draft the hook'
    ].join('\n')

    act(() => {
      result.current.setMarkdown(markdown)
    })

    expect(result.current.document.markdown).toBe(markdown)
    expect(result.current.document.sections.goal).toBe('Ship panel parity.')
    expect(result.current.document.sections.acceptanceCriteria).toEqual([
      'Persist parsed output'
    ])
    expect(result.current.document.tasks).toEqual([
      {
        id: 'task-1',
        title: 'Draft the hook',
        status: 'not_started',
        markdownLineIndex: 7
      }
    ])
    expect(mockSpecSave).toHaveBeenCalledWith({
      spaceId: 'space-1',
      sessionId: 'session-1',
      markdown
    })
  })

  it('applies draft via specApplyDraft and persists task toggles through specSave', async () => {
    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )
    const draft = {
      runId: 'run-456',
      generatedAt: '2026-03-02T12:05:00.000Z',
      content: [
        '## Goal',
        'Apply the incoming draft.',
        '',
        '## Tasks',
        '- [ ] Review the draft'
      ].join('\n')
    }

    act(() => {
      result.current.applyDraft(draft)
    })

    expect(mockSpecApplyDraft).toHaveBeenCalledWith({
      spaceId: 'space-1',
      sessionId: 'session-1',
      draft
    })
    expect(mockSpecSave).not.toHaveBeenCalledWith(
      expect.objectContaining({ markdown: draft.content })
    )
    expect(result.current.document.appliedRunId).toBe('run-456')
    expect(result.current.document.tasks[0]?.status).toBe('not_started')

    act(() => {
      result.current.toggleTask('task-1')
    })

    expect(result.current.document.tasks[0]?.status).toBe('in_progress')
    expect(result.current.document.markdown).toBe(
      ['## Goal', 'Apply the incoming draft.', '', '## Tasks', '- [/] Review the draft'].join(
        '\n'
      )
    )
    expect(mockSpecSave).toHaveBeenLastCalledWith({
      spaceId: 'space-1',
      sessionId: 'session-1',
      markdown: ['## Goal', 'Apply the incoming draft.', '', '## Tasks', '- [/] Review the draft'].join('\n'),
      appliedRunId: 'run-456'
    })
  })

  it('keeps documents isolated by session key in local fallback cache', async () => {
    mockSpecGet.mockResolvedValue(null)

    const useSpecDocument = await loadHook()
    const first = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    act(() => {
      first.result.current.setMarkdown('## Goal\nSession one only')
    })

    const second = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-2' })
    )
    const firstReloaded = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    expect(second.result.current.document.sections.goal).toBe('')
    expect(firstReloaded.result.current.document.sections.goal).toBe('Session one only')
  })

  it('falls back to an empty parsed document when specGet payload is malformed', async () => {
    mockSpecGet.mockResolvedValueOnce({ markdown: 42, appliedRunId: 'run-1' })

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    await waitFor(() => {
      expect(result.current.document).toMatchObject({
        markdown: '',
        sections: {
          goal: ''
        },
        tasks: []
      })
    })
  })

  it('falls back to an empty parsed document when specGet returns a non-object payload', async () => {
    mockSpecGet.mockResolvedValueOnce(42 as any)

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    await waitFor(() => {
      expect(result.current.document).toMatchObject({
        markdown: '',
        sections: {
          goal: ''
        },
        tasks: []
      })
    })
  })

  it('keeps local state when specSave rejects', async () => {
    mockSpecSave.mockRejectedValueOnce(new Error('ipc unavailable'))

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    act(() => {
      result.current.setMarkdown('## Goal\nPersist locally')
    })

    expect(result.current.document.sections.goal).toBe('Persist locally')
    expect(mockSpecSave).toHaveBeenCalledTimes(1)
  })

  it('keeps fallback state when specGet rejects', async () => {
    mockSpecGet.mockRejectedValueOnce(new Error('ipc unavailable'))

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    await waitFor(() => {
      expect(result.current.document).toMatchObject({
        markdown: '',
        sections: {
          goal: ''
        },
        tasks: []
      })
    })
  })

  it('keeps local state when specApplyDraft rejects', async () => {
    mockSpecApplyDraft.mockRejectedValueOnce(new Error('ipc unavailable'))

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    act(() => {
      result.current.applyDraft({
        runId: 'run-77',
        generatedAt: '2026-03-02T12:05:00.000Z',
        content: ['## Goal', 'Persist local apply-draft fallback', '', '## Tasks', '- [ ] Keep local'].join('\n')
      })
    })

    await waitFor(() => {
      expect(result.current.document.appliedRunId).toBe('run-77')
      expect(result.current.document.sections.goal).toBe('Persist local apply-draft fallback')
    })
  })

  it('works when spec IPC methods are unavailable', async () => {
    ;(window as any).kata = {}

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    act(() => {
      result.current.applyDraft({
        runId: 'run-99',
        generatedAt: '2026-03-02T12:05:00.000Z',
        content: ['## Goal', 'Keep existing state', '', '## Tasks', '- [ ] Existing task'].join('\n')
      })
    })

    act(() => {
      result.current.toggleTask('task-1')
    })

    expect(result.current.document.appliedRunId).toBe('run-99')
    expect(result.current.document.tasks[0]?.status).toBe('in_progress')
  })

  it('ignores stale specGet results after switching sessions', async () => {
    const first = createDeferred<{ markdown: string } | null>()
    mockSpecGet
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ markdown: '## Goal\nSession 2 persisted' })

    const useSpecDocument = await loadHook()
    const { result, rerender } = renderHook(
      ({ spaceId, sessionId }: { spaceId: string; sessionId: string }) =>
        useSpecDocument({ spaceId, sessionId }),
      { initialProps: { spaceId: 'space-1', sessionId: 'session-1' } }
    )

    rerender({ spaceId: 'space-1', sessionId: 'session-2' })
    first.resolve({ markdown: '## Goal\nStale session 1 value' })

    await waitFor(() => {
      expect(result.current.document.sections.goal).toBe('Session 2 persisted')
    })
  })

  it('ignores stale specSave results after switching sessions', async () => {
    const saveDeferred = createDeferred<{ markdown: string }>()
    mockSpecSave.mockImplementationOnce(() => saveDeferred.promise)
    mockSpecGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ markdown: '## Goal\nSession 2 canonical' })

    const useSpecDocument = await loadHook()
    const { result, rerender } = renderHook(
      ({ spaceId, sessionId }: { spaceId: string; sessionId: string }) =>
        useSpecDocument({ spaceId, sessionId }),
      { initialProps: { spaceId: 'space-1', sessionId: 'session-1' } }
    )

    act(() => {
      result.current.setMarkdown('## Goal\nSession 1 local write')
    })

    rerender({ spaceId: 'space-1', sessionId: 'session-2' })
    saveDeferred.resolve({ markdown: '## Goal\nSession 1 stale save response' })

    await waitFor(() => {
      expect(result.current.document.sections.goal).toBe('Session 2 canonical')
    })
  })

  it('falls back to local cached state when specSave returns malformed payload', async () => {
    mockSpecSave.mockResolvedValueOnce({ markdown: 42 } as any)

    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    act(() => {
      result.current.setMarkdown('## Goal\nKeep local cache')
    })

    await waitFor(() => {
      expect(result.current.document.sections.goal).toBe('Keep local cache')
    })
  })

  it('ignores specGet resolution after unmount', async () => {
    const deferred = createDeferred<{ markdown: string } | null>()
    mockSpecGet.mockImplementationOnce(() => deferred.promise)

    const useSpecDocument = await loadHook()
    const { unmount } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    unmount()
    deferred.resolve({ markdown: '## Goal\nShould be ignored' })

    await act(async () => {
      await deferred.promise
    })
  })

  it('ignores unknown task ids when toggling', async () => {
    const useSpecDocument = await loadHook()
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    act(() => {
      result.current.applyDraft({
        runId: 'run-99',
        generatedAt: '2026-03-02T12:05:00.000Z',
        content: ['## Goal', 'Keep existing state', '', '## Tasks', '- [ ] Existing task'].join('\n')
      })
    })

    const beforeMarkdown = result.current.document.markdown

    act(() => {
      result.current.toggleTask('missing-task-id')
    })

    expect(result.current.document.markdown).toBe(beforeMarkdown)
  })
})
