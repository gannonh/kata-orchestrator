import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MessageBubble } from '../../../../src/renderer/components/center/MessageBubble'

describe('MessageBubble', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders user messages as plain text bubbles', () => {
    render(
      <MessageBubble
        message={{
          id: 'user-1',
          role: 'user',
          content: 'Please summarize the current plan.'
        }}
      />
    )

    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('Please summarize the current plan.')).toBeTruthy()
  })

  it('renders assistant messages using markdown formatting', () => {
    render(
      <MessageBubble
        message={{
          id: 'assistant-1',
          role: 'assistant',
          content: ['## Summary', '', '- Added tests', '- Added mock fixtures'].join('\n')
        }}
      />
    )

    expect(screen.getByText('Kata')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Summary', level: 2 })).toBeTruthy()
    expect(screen.getByText('Added tests')).toBeTruthy()
  })

  it('renders conversation agent messages as Kata markdown bubbles', () => {
    render(
      <MessageBubble
        message={{
          id: 'agent-1',
          role: 'agent',
          content: ['## Agent Update', '', '- Deterministic status pipeline wired'].join('\n'),
          createdAt: '1970-01-01T00:00:01.000Z'
        }}
      />
    )

    expect(screen.getByText('Kata')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Agent Update', level: 2 })).toBeTruthy()
    expect(screen.getByText('Deterministic status pipeline wired')).toBeTruthy()
  })

  it('renders collapsed summary variant for analyzing mode', () => {
    render(
      <MessageBubble
        message={{
          id: 'user-2',
          role: 'user',
          content: 'Long content that should not be shown when collapsed.'
        }}
        variant="collapsed"
        summary="I would like to build the following product..."
      />
    )

    expect(screen.getByText('I would like to build the following product...')).toBeTruthy()
    expect(screen.queryByText('Long content that should not be shown when collapsed.')).toBeNull()
  })
})
