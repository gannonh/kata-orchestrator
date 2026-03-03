import { describe, expect, it } from 'vitest'

import {
  extractInlineDecisionCard,
  isDecisionResolved
} from '../../../../src/renderer/components/center/message-decision-parser'
import type { ConversationMessage } from '../../../../src/renderer/types/session-conversation'

const proposal = [
  '## Why',
  '- Electron + TypeScript keeps desktop iteration stable',
  '',
  '## How to keep Tech stable later',
  '- Keep provider adapter boundaries explicit',
  '',
  'Approve this plan with 1 check? Clarifications',
  '- Approve the plan...',
  '- Keep the last switch...'
].join('\n')

const nearShapeProposal = [
  '## WHY:',
  '- Electron + TypeScript keeps desktop iteration stable',
  '',
  '## How to keep tech stable later ?',
  '- Keep provider adapter boundaries explicit',
  '',
  'Approve this plan with 1 check :   clarifications',
  '* Approve the plan...',
  '* Keep the last switch...'
].join('\n')

const driftedIntentProposal = [
  '## Why',
  '- Electron + TypeScript keeps desktop iteration stable',
  '',
  '## How to keep Tech stable later',
  '- Keep provider adapter boundaries explicit',
  '',
  'Approve this plan with 1 check? Clarifications',
  '- Approve the plan, but remove TypeScript.',
  '- Keep the last switch, but skip router alignment.'
].join('\n')

const expectedActions = [
  {
    id: 'approve_tech_stack_plan',
    label: 'Approve the plan...',
    followUpPrompt: 'Approve the plan and continue with this tech stack.',
    variant: 'default'
  },
  {
    id: 'keep_last_stack_switch',
    label: 'Keep the last switch...',
    followUpPrompt: 'Keep the last switch and apply the revised views.',
    variant: 'secondary'
  },
  {
    id: 'ask_for_clarification',
    label: 'Clarifications',
    followUpPrompt: 'I need clarifications before approving this plan.',
    variant: 'outline'
  }
] as const

describe('message-decision-parser', () => {
  it('extracts an inline decision card from mock-12/13 shaped agent content', () => {
    const card = extractInlineDecisionCard({
      id: 'agent-1',
      role: 'agent',
      content: proposal,
      createdAt: '2026-03-03T00:00:01.000Z'
    })

    expect(card).toEqual({
      sourceMessageId: 'agent-1',
      promptLabel: 'Approve this plan with 1 check? Clarifications',
      actions: expectedActions
    })
  })

  it('extracts from near-shape formatting variation while keeping same semantics', () => {
    const card = extractInlineDecisionCard({
      id: 'agent-variation',
      role: 'agent',
      content: nearShapeProposal,
      createdAt: '2026-03-03T00:00:01.000Z'
    })

    expect(card).toEqual({
      sourceMessageId: 'agent-variation',
      promptLabel: 'Approve this plan with 1 check? Clarifications',
      actions: expectedActions
    })
  })

  it('returns undefined for non-decision messages', () => {
    const card = extractInlineDecisionCard({
      id: 'agent-2',
      role: 'agent',
      content: 'General planning update with no approval prompt.',
      createdAt: '2026-03-03T00:00:01.000Z'
    })

    expect(card).toBeUndefined()
  })

  it('returns undefined when action lines drift from the expected decisions', () => {
    const card = extractInlineDecisionCard({
      id: 'agent-drifted',
      role: 'agent',
      content: driftedIntentProposal,
      createdAt: '2026-03-03T00:00:01.000Z'
    })

    expect(card).toBeUndefined()
  })

  it('derives resolved state when a later user message matches action follow-up prompt', () => {
    const messages: ConversationMessage[] = [
      {
        id: 'agent-1',
        role: 'agent',
        content: proposal,
        createdAt: '2026-03-03T00:00:01.000Z'
      },
      {
        id: 'user-1',
        role: 'user',
        content: 'Approve the plan and continue with this tech stack.',
        createdAt: '2026-03-03T00:00:02.000Z'
      }
    ]

    const card = extractInlineDecisionCard(messages[0]!)
    expect(card).toBeTruthy()
    expect(isDecisionResolved(messages, card!)).toBe(true)
  })

  it('matches follow-up prompts deterministically with whitespace/case normalization', () => {
    const messages: ConversationMessage[] = [
      {
        id: 'agent-1',
        role: 'agent',
        content: proposal,
        createdAt: '2026-03-03T00:00:01.000Z'
      },
      {
        id: 'user-1',
        role: 'user',
        content: '  approve THE plan and continue with this tech stack.  ',
        createdAt: '2026-03-03T00:00:02.000Z'
      }
    ]

    const card = extractInlineDecisionCard(messages[0]!)
    expect(card).toBeTruthy()
    expect(isDecisionResolved(messages, card!)).toBe(true)
  })
})
