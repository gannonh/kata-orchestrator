import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ConversationStatusBadge } from '../../../../../src/renderer/components/center/primitives/ConversationStatusBadge'

describe('ConversationStatusBadge', () => {
  it.each([
    ['ready', 'Ready'],
    ['thinking', 'Thinking'],
    ['running', 'Running'],
    ['stopped', 'Stopped'],
    ['error', 'Error']
  ] as const)('renders %s -> %s', (state, label) => {
    render(<ConversationStatusBadge state={state} />)
    expect(screen.getByRole('status', { name: label })).toBeTruthy()
  })
})
