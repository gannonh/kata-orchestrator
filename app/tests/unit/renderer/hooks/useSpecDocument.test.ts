import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSpecDocument } from '../../../../src/renderer/hooks/useSpecDocument'

describe('useSpecDocument', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('loads an existing document from session-scoped storage', () => {
    window.localStorage.setItem(
      'kata.spec-panel.v1:space-1:session-1',
      JSON.stringify({
        markdown: ['## Goal', 'Load from storage', '', '## Tasks', '- [x] Restore saved specs'].join('\n'),
        appliedRunId: 'run-123'
      })
    )

    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    expect(result.current.document).toMatchObject({
      markdown: ['## Goal', 'Load from storage', '', '## Tasks', '- [x] Restore saved specs'].join('\n'),
      appliedRunId: 'run-123',
      sections: {
        goal: 'Load from storage'
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

  it('parses markdown and persists the parsed document for the active session', () => {
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
    const persisted = JSON.parse(
      window.localStorage.getItem('kata.spec-panel.v1:space-1:session-1') ?? 'null'
    )
    expect(persisted).toEqual({ markdown })
    expect(persisted).not.toHaveProperty('sections')
    expect(persisted).not.toHaveProperty('tasks')
  })

  it('applies a draft, records the run id, and persists toggled task changes', () => {
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
    const persisted = JSON.parse(
      window.localStorage.getItem('kata.spec-panel.v1:space-1:session-1') ?? 'null'
    )
    expect(persisted).toEqual({
      appliedRunId: 'run-456',
      markdown: [
        '## Goal',
        'Apply the incoming draft.',
        '',
        '## Tasks',
        '- [/] Review the draft'
      ].join('\n')
    })
    expect(persisted).not.toHaveProperty('sections')
    expect(persisted).not.toHaveProperty('tasks')
  })

  it('keeps documents isolated by session key', () => {
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
    expect(window.localStorage.getItem('kata.spec-panel.v1:space-1:session-1')).not.toBeNull()
    expect(window.localStorage.getItem('kata.spec-panel.v1:space-1:session-2')).toBeNull()
  })

  it('falls back to an empty parsed document when storage is malformed', () => {
    window.localStorage.setItem('kata.spec-panel.v1:space-1:session-1', JSON.stringify(null))

    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    expect(result.current.document).toMatchObject({
      markdown: '',
      sections: {
        goal: ''
      },
      tasks: []
    })
  })

  it('falls back to an empty parsed document when storage JSON is invalid', () => {
    window.localStorage.setItem('kata.spec-panel.v1:space-1:session-1', '{')

    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    expect(result.current.document).toMatchObject({
      markdown: '',
      sections: {
        goal: ''
      },
      tasks: []
    })
  })

  it('falls back when persisted markdown is not a string', () => {
    window.localStorage.setItem(
      'kata.spec-panel.v1:space-1:session-1',
      JSON.stringify({ markdown: 42, appliedRunId: 'run-1' })
    )

    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    expect(result.current.document).toMatchObject({
      markdown: '',
      sections: {
        goal: ''
      },
      tasks: []
    })
  })

  it('does not update state when localStorage.setItem throws', () => {
    const { result } = renderHook(() =>
      useSpecDocument({ spaceId: 'space-1', sessionId: 'session-1' })
    )

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    act(() => {
      result.current.setMarkdown('## Goal\nShould not persist')
    })

    expect(result.current.document.markdown).toBe('')
    setItemSpy.mockRestore()
  })

  it('ignores unknown task ids when toggling', () => {
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
    const beforeStorage = window.localStorage.getItem('kata.spec-panel.v1:space-1:session-1')

    act(() => {
      result.current.toggleTask('missing-task-id')
    })

    expect(result.current.document.markdown).toBe(beforeMarkdown)
    expect(window.localStorage.getItem('kata.spec-panel.v1:space-1:session-1')).toBe(beforeStorage)
  })
})
