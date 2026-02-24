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

  it('defaults to initial view state when no markers are present', () => {
    const result = deriveMockChatPresentation({
      messages: [{ id: 'u3', role: 'user', content: 'Quick follow up' }],
      isStreaming: true
    })

    expect(result.viewState).toBe('initial')
  })
})
