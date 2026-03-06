import { describe, expect, it } from 'vitest'

import { parseSpecMarkdown } from '../../../../../src/renderer/components/right/primitives/parse-spec-markdown'

describe('parseSpecMarkdown', () => {
  it('extracts normalized sections and task markers deterministically', () => {
    const markdown = [
      '## Goal',
      'Ship reusable parser primitives.',
      '',
      '## Acceptance Criteria',
      '- Parser works',
      '',
      '## Tasks',
      '- [ ] Task A',
      '- [/] Task B',
      '- [x] Task C'
    ].join('\n')

    const parsed = parseSpecMarkdown(markdown)

    expect(parsed.sections.goal).toContain('reusable parser')
    expect(parsed.sections.acceptanceCriteria).toEqual(['Parser works'])
    expect(parsed.tasks.map((task) => task.status)).toEqual([
      'not_started',
      'in_progress',
      'complete'
    ])
  })
})
