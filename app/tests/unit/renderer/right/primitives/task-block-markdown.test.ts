import { describe, expect, it } from 'vitest'

import {
  cycleTaskBlockStatus,
  markerForTaskBlockStatus,
  updateTaskBlockLineInMarkdown
} from '../../../../../src/renderer/components/right/primitives/task-block-markdown'

describe('task-block-markdown primitives', () => {
  it('cycles not_started -> in_progress -> complete -> not_started', () => {
    expect(cycleTaskBlockStatus('not_started')).toBe('in_progress')
    expect(cycleTaskBlockStatus('in_progress')).toBe('complete')
    expect(cycleTaskBlockStatus('complete')).toBe('not_started')
  })

  it('maps markers and rewrites only target task line', () => {
    const markdown = ['## Tasks', '- [ ] A', '- [x] B'].join('\n')
    const updated = updateTaskBlockLineInMarkdown(markdown, 1, 'in_progress')

    expect(markerForTaskBlockStatus('in_progress')).toBe('[/]')
    expect(updated).toContain('- [/] A')
    expect(updated).toContain('- [x] B')
  })
})
