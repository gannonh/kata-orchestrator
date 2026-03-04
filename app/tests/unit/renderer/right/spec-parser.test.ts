import { describe, expect, it } from 'vitest'

import { parseStructuredSpec } from '../../../../src/renderer/components/right/spec-parser'

describe('parseStructuredSpec', () => {
  it('extracts required sections, normalizes lists, and maps task markers', () => {
    const markdown = [
      '## Goal',
      'Ship desktop parity.',
      '',
      '## Acceptance Criteria',
      '1. Works',
      '2. Handles repeat runs',
      '',
      '## Non-goals',
      '- Do not ship comments',
      '* Do not redesign the panel',
      '',
      '## Assumptions',
      '- Repo is clean',
      '',
      '## Verification Plan',
      '1. Run unit tests',
      '2. Validate rendered output',
      '',
      '## Rollback Plan',
      '1. Revert the latest changes',
      '',
      '## Tasks',
      '- [ ] Build parser',
      '- [/] Wire UI',
      '- [x] Add tests'
    ].join('\n')

    const parsed = parseStructuredSpec(markdown)

    expect(parsed.markdown).toBe(markdown)
    expect(parsed.sections.goal).toBe('Ship desktop parity.')
    expect(parsed.sections.acceptanceCriteria).toEqual(['Works', 'Handles repeat runs'])
    expect(parsed.sections.nonGoals).toEqual(['Do not ship comments', 'Do not redesign the panel'])
    expect(parsed.sections.assumptions).toEqual(['Repo is clean'])
    expect(parsed.sections.verificationPlan).toEqual(['Run unit tests', 'Validate rendered output'])
    expect(parsed.sections.rollbackPlan).toEqual(['Revert the latest changes'])
    expect(parsed.tasks).toEqual([
      {
        id: 'task-build-parser',
        title: 'Build parser',
        status: 'not_started',
        markdownLineIndex: 22
      },
      {
        id: 'task-wire-ui',
        title: 'Wire UI',
        status: 'in_progress',
        markdownLineIndex: 23
      },
      {
        id: 'task-add-tests',
        title: 'Add tests',
        status: 'complete',
        markdownLineIndex: 24
      }
    ])
    expect(parsed.updatedAt).toBeTypeOf('string')
  })

  it('returns safe defaults when sections or tasks are missing', () => {
    const parsed = parseStructuredSpec('## Goal\nShip the minimal parser')

    expect(parsed.sections).toEqual({
      goal: 'Ship the minimal parser',
      acceptanceCriteria: [],
      nonGoals: [],
      assumptions: [],
      verificationPlan: [],
      rollbackPlan: []
    })
    expect(parsed.tasks).toEqual([])
  })

  it('trims leading blank goal lines while preserving intentional paragraph breaks', () => {
    const markdown = ['## Goal', '', 'Ship parser parity.', '', 'Keep paragraph spacing.'].join('\n')

    const parsed = parseStructuredSpec(markdown)

    expect(parsed.sections.goal).toBe(['Ship parser parity.', '', 'Keep paragraph spacing.'].join('\n'))
  })

  it('appends indented wrapped lines to the previous list item', () => {
    const markdown = [
      '## Acceptance Criteria',
      '1. First requirement',
      '   with continued detail',
      '2. Second requirement',
      '  and more detail'
    ].join('\n')

    const parsed = parseStructuredSpec(markdown)

    expect(parsed.sections.acceptanceCriteria).toEqual([
      'First requirement with continued detail',
      'Second requirement and more detail'
    ])
  })

  it('parses task checkboxes that use ordered list prefixes', () => {
    const markdown = [
      '## Tasks',
      '1. [ ] Draft parser',
      '2) [x] Add tests'
    ].join('\n')

    const parsed = parseStructuredSpec(markdown)

    expect(parsed.tasks).toEqual([
      {
        id: 'task-draft-parser',
        title: 'Draft parser',
        status: 'not_started',
        markdownLineIndex: 1
      },
      {
        id: 'task-add-tests',
        title: 'Add tests',
        status: 'complete',
        markdownLineIndex: 2
      }
    ])
  })

  it('assigns deterministic task ids derived from title text and disambiguates duplicates', () => {
    const markdown = [
      '## Tasks',
      '- [ ] Build spec panel',
      '- [ ] Build spec panel',
      '- [x] Build spec panel'
    ].join('\n')

    const parsed = parseStructuredSpec(markdown)

    expect(parsed.tasks.map((task) => task.id)).toEqual([
      'task-build-spec-panel',
      'task-build-spec-panel-2',
      'task-build-spec-panel-3'
    ])
  })

  it('preserves blank lines between goal paragraphs', () => {
    const markdown = ['## Goal', 'Ship parser parity.', '', 'Keep paragraph spacing.'].join('\n')

    const parsed = parseStructuredSpec(markdown)

    expect(parsed.sections.goal).toBe(['Ship parser parity.', '', 'Keep paragraph spacing.'].join('\n'))
  })

  it('ignores nested list items instead of flattening them into top-level items', () => {
    const markdown = [
      '## Non-goals',
      '- Do not redesign the shell',
      '  - Nested detail that should be ignored',
      '- Do not ship comments'
    ].join('\n')

    const parsed = parseStructuredSpec(markdown)

    expect(parsed.sections.nonGoals).toEqual([
      'Do not redesign the shell',
      'Do not ship comments'
    ])
  })

  it('treats plain text lines in list sections as standalone items', () => {
    const markdown = [
      '## Assumptions',
      'Repository exists locally',
      'No network calls are needed'
    ].join('\n')

    const parsed = parseStructuredSpec(markdown)

    expect(parsed.sections.assumptions).toEqual([
      'Repository exists locally',
      'No network calls are needed'
    ])
  })

  it('ignores unrecognized section headings without crashing', () => {
    const markdown = [
      '## Goal',
      'Ship the parser',
      '',
      '## Unknown Section',
      'This content should be ignored',
      '',
      '## Tasks',
      '- [ ] Build parser'
    ].join('\n')

    const parsed = parseStructuredSpec(markdown)

    expect(parsed.sections.goal).toBe('Ship the parser')
    expect(parsed.tasks).toHaveLength(1)
  })

  it('skips non-checkbox lines in tasks sections', () => {
    const markdown = [
      '## Tasks',
      'Implementation details:',
      '- [ ] Build parser'
    ].join('\n')

    const parsed = parseStructuredSpec(markdown)

    expect(parsed.tasks).toEqual([
      {
        id: 'task-build-parser',
        title: 'Build parser',
        status: 'not_started',
        markdownLineIndex: 2
      }
    ])
  })
})
