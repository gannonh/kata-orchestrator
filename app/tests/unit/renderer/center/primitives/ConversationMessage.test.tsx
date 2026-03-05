import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ConversationMessage } from '../../../../../src/renderer/components/center/primitives/ConversationMessage'

describe('ConversationMessage', () => {
  it('renders user role as plain text with You label', () => {
    render(
      <ConversationMessage
        message={{ id: 'u1', role: 'user', content: 'Ship slice A' }}
      />
    )

    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('Ship slice A')).toBeTruthy()
  })

  it('renders agent role via markdown with Kata label', () => {
    render(
      <ConversationMessage
        message={{ id: 'a1', role: 'agent', content: '## Summary' }}
      />
    )

    expect(screen.getByText('Kata')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Summary', level: 2 })).toBeTruthy()
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
