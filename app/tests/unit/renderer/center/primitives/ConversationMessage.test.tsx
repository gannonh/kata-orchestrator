import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ConversationMessage } from '../../../../../src/renderer/components/center/primitives/ConversationMessage'

describe('ConversationMessage', () => {
  it('renders user role as plain text with left-aligned full-width layout', () => {
    render(
      <ConversationMessage
        message={{ id: 'u1', role: 'user', content: 'Ship slice A' }}
      />
    )

    expect(screen.getByText('You')).toBeTruthy()
    const root = screen.getByText('You').parentElement as HTMLDivElement
    const content = screen.getByText('Ship slice A').parentElement as HTMLParagraphElement
    expect(screen.getByText('Ship slice A').closest('article')).toBeNull()
    expect(root.className).toContain('items-start')
    expect(root.className).not.toContain('items-end')
    expect(content.className).not.toContain('rounded-lg')
    expect(content.className).not.toContain('bg-primary/10')
  })

  it('renders agent role via markdown without a visible bubble wrapper', () => {
    render(
      <ConversationMessage
        message={{ id: 'a1', role: 'agent', content: '## Summary' }}
      />
    )

    expect(screen.getByText('Kata')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Summary', level: 2 })).toBeTruthy()
    const markdownWrapper = screen.getByRole('heading', { name: 'Summary', level: 2 }).closest('div') as HTMLDivElement
    expect(markdownWrapper.className).not.toContain('rounded-lg')
    expect(markdownWrapper.className).not.toContain('bg-muted/30')
  })

  it('renders custom agentLabel when provided', () => {
    render(
      <ConversationMessage
        message={{ id: 'a2', role: 'agent', content: 'Custom label test' }}
        agentLabel="Assistant"
      />
    )

    expect(screen.getByText('Assistant')).toBeTruthy()
    expect(screen.getByText('Custom label test')).toBeTruthy()
  })

  it('renders collapsed variant summary when provided', () => {
    render(
      <ConversationMessage
        message={{
          id: 'u2',
          role: 'user',
          content: 'Long content',
          summary: 'Short summary'
        }}
        variant="collapsed"
      />
    )

    expect(screen.getByText('Short summary')).toBeTruthy()
    expect(screen.queryByText('Long content')).toBeNull()
  })
})
