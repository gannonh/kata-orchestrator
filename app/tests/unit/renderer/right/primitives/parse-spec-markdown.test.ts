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

  it('keeps a flush-left fenced block attached to the preceding canonical list item', () => {
    const markdown = [
      '## Acceptance Criteria',
      '- Tasks include exactly one unchecked, one in-progress, and one completed item.',
      '',
      '```ts',
      "type TaskState = '[ ]' | '[/]' | '[x]'",
      '```'
    ].join('\n')

    const parsed = parseSpecMarkdown(markdown)

    expect(parsed.sections.acceptanceCriteria).toEqual([
      [
        'Tasks include exactly one unchecked, one in-progress, and one completed item.',
        '',
        '```ts',
        "type TaskState = '[ ]' | '[/]' | '[x]'",
        '```'
      ].join('\n')
    ])
  })

  it('closing fence requires same char and at least same length as opener', () => {
    const markdown = [
      '## Acceptance Criteria',
      '- Item with nested fences:',
      '  ````ts',
      '  ```js',
      '  const x = 1',
      '  ```',
      '  ````'
    ].join('\n')

    const parsed = parseSpecMarkdown(markdown)

    expect(parsed.sections.acceptanceCriteria).toHaveLength(1)
    expect(parsed.sections.acceptanceCriteria[0]).toContain('```js')
    expect(parsed.sections.acceptanceCriteria[0]).toContain('````')
  })

  it('closing fence must not have an info string', () => {
    const markdown = [
      '## Acceptance Criteria',
      '- Two consecutive code blocks:',
      '  ```ts',
      '  const a = 1',
      '  ```',
      '  ```js',
      '  const b = 2',
      '  ```'
    ].join('\n')

    const parsed = parseSpecMarkdown(markdown)

    // Both code blocks should remain in a single list item
    expect(parsed.sections.acceptanceCriteria).toHaveLength(1)
    const item = parsed.sections.acceptanceCriteria[0]
    expect(item).toContain('```ts')
    expect(item).toContain('```js')
  })

  it('does not split sections on headings inside fenced code blocks', () => {
    const markdown = [
      '## Goal',
      'Build a parser.',
      '',
      '```markdown',
      '## Acceptance Criteria',
      '- This is example markdown',
      '```',
      '',
      'Still in Goal section.',
      '',
      '## Acceptance Criteria',
      '- Real criteria'
    ].join('\n')

    const parsed = parseSpecMarkdown(markdown)

    expect(parsed.sections.goal).toContain('## Acceptance Criteria')
    expect(parsed.sections.goal).toContain('Still in Goal section.')
    expect(parsed.sections.acceptanceCriteria).toEqual(['Real criteria'])
  })
})
