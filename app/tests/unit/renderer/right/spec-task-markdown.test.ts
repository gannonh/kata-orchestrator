import { describe, expect, it } from 'vitest'

import {
  cycleTaskStatus,
  markerForStatus,
  updateTaskLineInMarkdown
} from '../../../../src/renderer/components/right/spec-task-markdown'

describe('spec-task-markdown', () => {
  it('cycles task status through the full three-state loop', () => {
    expect(cycleTaskStatus('not_started')).toBe('in_progress')
    expect(cycleTaskStatus('in_progress')).toBe('complete')
    expect(cycleTaskStatus('complete')).toBe('not_started')
  })

  it('returns the correct checkbox marker for each task status', () => {
    expect(markerForStatus('not_started')).toBe('[ ]')
    expect(markerForStatus('in_progress')).toBe('[/]')
    expect(markerForStatus('complete')).toBe('[x]')
  })

  it('replaces only the marker token on the targeted line', () => {
    const markdown = ['## Tasks', '- [ ] Task A', '- [x] Task B'].join('\n')

    const updated = updateTaskLineInMarkdown(markdown, 1, 'in_progress')

    expect(updated).toBe(['## Tasks', '- [/] Task A', '- [x] Task B'].join('\n'))
  })

  it('preserves CRLF line endings when updating a task line', () => {
    const markdown = ['## Tasks', '1. [ ] Task A', '2. [x] Task B'].join('\r\n')

    const updated = updateTaskLineInMarkdown(markdown, 1, 'in_progress')

    expect(updated).toBe(['## Tasks', '1. [/] Task A', '2. [x] Task B'].join('\r\n'))
    expect(updated).toContain('\r\n')
  })

  it('returns original markdown when the target line does not exist', () => {
    const markdown = ['## Tasks', '- [ ] Task A'].join('\n')

    const updated = updateTaskLineInMarkdown(markdown, 10, 'complete')

    expect(updated).toBe(markdown)
  })
})
