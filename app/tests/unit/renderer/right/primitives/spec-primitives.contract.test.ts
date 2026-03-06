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
    expect(statuses).toEqual(['not_started', 'in_progress', 'complete'])
  })
})
