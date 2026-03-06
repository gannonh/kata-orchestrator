import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../src/renderer/components/center/primitives/ConversationMessage', () => ({
  ConversationMessage: ({
    message,
    variant,
    agentLabel
  }: {
    message: { content: string; summary?: string }
    variant?: 'default' | 'collapsed'
    agentLabel?: string
  }) => (
    <div>
      <span>{agentLabel ?? 'Kata'}</span>
      <span>{variant === 'collapsed' && message.summary ? message.summary : message.content}</span>
    </div>
  )
}))

import { ConversationMessageCard } from '../../../../../src/renderer/components/center/primitives/ConversationMessageCard'

describe('ConversationMessageCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders timestamp, body, and footer content', () => {
    render(
      <ConversationMessageCard
        message={{ id: 'u1', role: 'user', content: 'Ship coordinator UI' }}
        timestampLabel="Just now"
        footer={<span>Pasted 205 lines</span>}
      />
    )

    expect(screen.getByText('Just now')).toBeTruthy()
    expect(screen.getByText('Ship coordinator UI')).toBeTruthy()
    expect(screen.getByText('Pasted 205 lines')).toBeTruthy()
  })

  it('renders user messages inside the visible outer card container', () => {
    render(
      <ConversationMessageCard
        message={{ id: 'u1', role: 'user', content: 'Ship coordinator UI' }}
      />
    )

    const article = screen.getByText('Ship coordinator UI').closest('article') as HTMLElement
    expect(article.className).toContain('rounded-xl')
    expect(article.className).toContain('border')
    expect(article.className).toContain('bg-card/70')
  })

  it('renders agent messages without a visible outer card container', () => {
    render(
      <ConversationMessageCard
        message={{ id: 'a1', role: 'agent', content: 'Ship coordinator UI' }}
      />
    )

    const article = screen.getByText('Ship coordinator UI').closest('article') as HTMLElement
    expect(article.className).not.toContain('rounded-xl')
    expect(article.className).toContain('border-0')
    expect(article.className).not.toContain('bg-card/70')
  })

  it('renders dismiss button when onDismiss is supplied', () => {
    const onDismiss = vi.fn()
    render(
      <ConversationMessageCard
        message={{ id: 'u1', role: 'user', content: 'Dismiss me' }}
        onDismiss={onDismiss}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders collapsed summary instead of full content', () => {
    render(
      <ConversationMessageCard
        message={{
          id: 'u2',
          role: 'user',
          content: 'Long content',
          summary: 'Short summary'
        }}
        variant="collapsed"
        metadata={<span>2 notes context text</span>}
      />
    )

    expect(screen.getByText('Short summary')).toBeTruthy()
    expect(screen.queryByText('Long content')).toBeNull()
    expect(screen.getByText('2 notes context text')).toBeTruthy()
  })
})
