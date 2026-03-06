import { describe, expect, it } from 'vitest'

import '../../../../../src/renderer/components/right/primitives/spec-markdown-types'
import type {
  ParsedSpecMarkdownDocument,
  ParsedSpecSections,
  ParsedSpecTaskItem,
  ParsedSpecTaskStatus
} from '../../../../../src/renderer/components/right/primitives/spec-markdown-types'

describe('spec primitive type contracts', () => {
  it('requires canonical section keys and three-state task statuses', () => {
    const sections: ParsedSpecSections = {
      goal: 'Ship structured spec primitives.',
      acceptanceCriteria: ['Contract test exists'],
      nonGoals: ['No parser behavior changes'],
      assumptions: ['Type-level contracts are shared'],
      verificationPlan: ['Run contract tests'],
      rollbackPlan: ['Remove primitive module']
    }

    const task: ParsedSpecTaskItem = {
      id: 'task-1',
      title: 'Define primitive contracts',
      status: 'not_started',
      markdownLineIndex: 12
    }

    const doc: ParsedSpecMarkdownDocument = {
      markdown: '# Spec',
      sections,
      tasks: [task],
      updatedAt: '2026-03-05T00:00:00.000Z'
    }

    const statuses: ParsedSpecTaskStatus[] = ['not_started', 'in_progress', 'complete']

    expect(doc.tasks).toHaveLength(1)
    expect(Object.keys(sections)).toEqual([
      'goal',
      'acceptanceCriteria',
      'nonGoals',
      'assumptions',
      'verificationPlan',
      'rollbackPlan'
    ])
    expect(statuses).toEqual(['not_started', 'in_progress', 'complete'])
  })

  it('represents the design-doc parser contract shape in code', () => {
    const sections: ParsedSpecSections = {
      goal: 'Ship `inline code` support.\n\n```ts\nconst stable = true\n```',
      acceptanceCriteria: [
        ['Support renderer-ready markdown:', '```ts', 'const stable = true', '```'].join('\n')
      ],
      nonGoals: [],
      assumptions: ['Task ids are deterministic by source order'],
      verificationPlan: ['Run parser contract tests'],
      rollbackPlan: ['Revert parser-only changes']
    }

    const tasks: ParsedSpecTaskItem[] = [
      {
        id: 'task-review-draft',
        title: 'Review draft',
        status: 'not_started',
        markdownLineIndex: 8
      },
      {
        id: 'task-review-draft-2',
        title: 'Review draft',
        status: 'in_progress',
        markdownLineIndex: 9
      },
      {
        id: 'task-review-draft-3',
        title: 'Review draft',
        status: 'complete',
        markdownLineIndex: 10
      }
    ]

    const doc: ParsedSpecMarkdownDocument = {
      markdown: '# canonical example',
      sections,
      tasks,
      updatedAt: '2026-03-06T00:00:00.000Z'
    }

    expect(doc.sections.acceptanceCriteria[0]).toContain('```ts')
    expect(doc.tasks.map((task) => task.status)).toEqual([
      'not_started',
      'in_progress',
      'complete'
    ])
    expect(doc.tasks.map((task) => task.id)).toEqual([
      'task-review-draft',
      'task-review-draft-2',
      'task-review-draft-3'
    ])
  })
})
