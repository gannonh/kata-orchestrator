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

  it('preserves deterministic ids for duplicate task titles in source order', () => {
    const markdown = [
      '## Tasks',
      '- [ ] Review draft',
      '- [/] Review draft',
      '- [x] Review draft'
    ].join('\n')

    const parsed = parseSpecMarkdown(markdown)

    expect(parsed.tasks.map((task) => task.id)).toEqual([
      'task-review-draft',
      'task-review-draft-2',
      'task-review-draft-3'
    ])
  })

  it('returns stable empty defaults for missing sections and malformed headings', () => {
    const parsed = parseSpecMarkdown(['# Not canonical', 'random body'].join('\n'))

    expect(parsed.sections).toEqual({
      goal: '',
      acceptanceCriteria: [],
      nonGoals: [],
      assumptions: [],
      verificationPlan: [],
      rollbackPlan: []
    })
    expect(parsed.tasks).toEqual([])
  })

  it('preserves multiline section content needed by markdown rendering', () => {
    const markdown = [
      '## Goal',
      'Ship `inline code` support.',
      '',
      '```ts',
      'const stable = true',
      '```'
    ].join('\n')

    const parsed = parseSpecMarkdown(markdown)

    expect(parsed.sections.goal).toContain('```ts')
    expect(parsed.sections.goal).toContain('`inline code`')
  })

  it('preserves multiline markdown inside canonical list items', () => {
    const markdown = [
      '## Acceptance Criteria',
      '- Support renderer-ready markdown:',
      '  ```ts',
      '  const stable = true',
      '  ```',
      '  with trailing explanation.'
    ].join('\n')

    const parsed = parseSpecMarkdown(markdown)

    expect(parsed.sections.acceptanceCriteria).toEqual([
      ['Support renderer-ready markdown:', '```ts', 'const stable = true', '```', 'with trailing explanation.'].join('\n')
    ])
  })
})
