import { describe, expect, it } from 'vitest'

import { buildConversationEntries } from '../../../../src/renderer/components/left/conversation-entry-index'

describe('buildConversationEntries', () => {
  it('uses the first markdown heading as the label', () => {
    const entries = buildConversationEntries([
      {
        id: 'm-1',
        role: 'agent',
        content: '## Spec Updated\n\n- Added architecture notes',
        createdAt: '2026-03-03T10:00:00.000Z'
      }
    ])

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      id: 'entry-m-1',
      messageId: 'm-1',
      label: 'Spec Updated',
      role: 'agent'
    })
    expect(entries[0]?.timestamp).toContain(':')
  })

  it('falls back to the first non-empty line when no heading exists', () => {
    const entries = buildConversationEntries([
      {
        id: 'm-2',
        role: 'user',
        content: '\n\nI updated the task list and acceptance criteria.',
        createdAt: '2026-03-03T10:01:00.000Z'
      }
    ])

    expect(entries[0]?.label).toBe('I updated the task list and acceptance criteria.')
  })

  it('uses "Message" as fallback label for empty content', () => {
    const entries = buildConversationEntries([
      {
        id: 'm-3',
        role: 'agent',
        content: '   \n  ',
        createdAt: '2026-03-03T10:02:00.000Z'
      }
    ])

    expect(entries[0]?.label).toBe('Message')
  })

  it('uses --:-- when createdAt is invalid', () => {
    const entries = buildConversationEntries([
      {
        id: 'm-4',
        role: 'agent',
        content: 'Spec Updated',
        createdAt: 'invalid-date'
      }
    ])

    expect(entries[0]?.timestamp).toBe('--:--')
  })
})
