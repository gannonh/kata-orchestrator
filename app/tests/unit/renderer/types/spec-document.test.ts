import { describe, expect, it } from 'vitest'

import type {
  LatestRunDraft,
  SpecTaskItem,
  SpecTaskStatus,
  StructuredSpecDocument,
  StructuredSpecSections
} from '../../../../src/renderer/types/spec-document'
import type { SessionConversationState } from '../../../../src/renderer/types/session-conversation'

describe('structured spec domain types', () => {
  it('requires the canonical structured section keys', () => {
    const sections: StructuredSpecSections = {
      goal: 'Ship structured specs',
      acceptanceCriteria: ['renders sections'],
      nonGoals: ['do not parse markdown'],
      assumptions: ['upstream data is valid'],
      verificationPlan: ['run unit tests'],
      rollbackPlan: ['hide behind flag']
    }

    expect(Object.keys(sections)).toEqual([
      'goal',
      'acceptanceCriteria',
      'nonGoals',
      'assumptions',
      'verificationPlan',
      'rollbackPlan'
    ])
  })

  it('supports the full three-state task lifecycle', () => {
    const statuses: SpecTaskStatus[] = ['not_started', 'in_progress', 'complete']
    const tasks: SpecTaskItem[] = statuses.map((status, index) => ({
      id: `task-${index + 1}`,
      title: `Task ${index + 1}`,
      status,
      markdownLineIndex: index
    }))

    expect(tasks.map((task) => task.status)).toEqual(statuses)
  })

  it('tracks optional applied run metadata on specs and session state drafts', () => {
    const latestDraft: LatestRunDraft = {
      runId: 'run-123',
      generatedAt: '2026-03-02T12:00:00.000Z',
      content: '# Draft'
    }

    const conversationState: SessionConversationState = {
      runState: 'idle',
      messages: [],
      latestDraft
    }

    const specDocument: StructuredSpecDocument = {
      markdown: latestDraft.content,
      sections: {
        goal: 'Ship structured specs',
        acceptanceCriteria: ['render sections'],
        nonGoals: ['parse tasks from markdown'],
        assumptions: ['run drafts are persisted'],
        verificationPlan: ['cover type contracts'],
        rollbackPlan: ['clear the draft state']
      },
      tasks: [
        {
          id: 'task-1',
          title: 'Define domain types',
          status: 'complete',
          markdownLineIndex: 8
        }
      ],
      updatedAt: '2026-03-02T12:05:00.000Z',
      appliedRunId: latestDraft.runId
    }

    expect(specDocument.appliedRunId).toBe(conversationState.latestDraft?.runId)
  })
})
