import { describe, expect, it } from 'vitest'

import { deriveMockChatPresentation } from '../../../../src/renderer/components/center/mockChatPresentation'

describe('deriveMockChatPresentation', () => {
  it('maps to contextReading when content includes context markers and streaming is active', () => {
    const result = deriveMockChatPresentation({
      messages: [{ id: 'm1', role: 'user', content: 'Read ## Context now for # Kata Cloud (Kata V2)' }],
      isStreaming: true
    })

    expect(result.viewState).toBe('contextReading')
    expect(result.blocks.some((block) => block.type === 'contextChipRow')).toBe(true)
    expect(result.blocks.some((block) => block.type === 'statusBadge' && block.variant === 'thinking')).toBe(true)
  })

  it('maps to pastedContext and stopped when paste markers are present and streaming is false', () => {
    const result = deriveMockChatPresentation({
      messages: [{ id: 'u1', role: 'user', content: 'Pasted 205 lines\n\nspec text' }],
      isStreaming: false
    })

    expect(result.viewState).toBe('pastedContext')
    expect(result.blocks.some((block) => block.type === 'statusBadge' && block.variant === 'stopped')).toBe(true)
  })

  it('maps to analyzing and emits a collapsed summary block when forced', () => {
    const result = deriveMockChatPresentation({
      messages: [{ id: 'u2', role: 'user', content: 'I would like to build the following product for my team.' }],
      isStreaming: true,
      forceAnalyzing: true
    })

    expect(result.viewState).toBe('analyzing')
    expect(result.blocks.some((block) => block.type === 'collapsedSummary')).toBe(true)
    expect(result.blocks.some((block) => block.type === 'statusBadge' && block.variant === 'thinking')).toBe(true)
  })

  it('infers analyzing from user content while streaming and truncates collapsed summaries', () => {
    const longOverviewRequest = [
      'Please give me an overview of this rollout and analyze tradeoffs.',
      'I also need risks, constraints, and a complete proposal covering implementation details end to end.'
    ].join(' ')
    const result = deriveMockChatPresentation({
      messages: [{ id: 'u4', role: 'user', content: longOverviewRequest }],
      isStreaming: true
    })

    expect(result.viewState).toBe('analyzing')
    const collapsedSummary = result.blocks.find((block) => block.type === 'collapsedSummary')
    expect(collapsedSummary?.type).toBe('collapsedSummary')
    if (collapsedSummary?.type === 'collapsedSummary') {
      expect(collapsedSummary.summary.endsWith('...')).toBe(true)
      expect(collapsedSummary.summary.length).toBeLessThan(longOverviewRequest.length)
    }
  })

  it('collapses the latest user message that matches analyzing triggers', () => {
    const analyzingRequest =
      'Please provide an overview of this migration and analyze implementation risks, dependencies, and rollout strategy.'
    const followUpMessage = 'Thanks. Also include a timeline later.'
    const result = deriveMockChatPresentation({
      messages: [
        { id: 'u-analyze', role: 'user', content: analyzingRequest },
        { id: 'a-1', role: 'assistant', content: 'Working on it now.' },
        { id: 'u-followup', role: 'user', content: followUpMessage }
      ],
      isStreaming: true
    })

    const collapsedSummary = result.blocks.find((block) => block.type === 'collapsedSummary')
    expect(collapsedSummary?.type).toBe('collapsedSummary')
    if (collapsedSummary?.type === 'collapsedSummary') {
      expect(collapsedSummary.summary).toContain('overview of this migration')
      expect(collapsedSummary.summary).not.toContain('timeline later')
    }

    expect(result.blocks.some((block) => block.type === 'message' && block.message.id === 'u-followup')).toBe(true)
  })

  it('defaults to initial view state when no markers are present', () => {
    const result = deriveMockChatPresentation({
      messages: [{ id: 'u3', role: 'user', content: 'Quick follow up' }],
      isStreaming: true
    })

    expect(result.viewState).toBe('initial')
  })
})
