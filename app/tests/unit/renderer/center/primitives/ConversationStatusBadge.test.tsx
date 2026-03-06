import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ConversationStatusBadge } from '../../../../../src/renderer/components/center/primitives/ConversationStatusBadge'

describe('ConversationStatusBadge', () => {
  it.each([
    ['empty', 'Ready'],
    ['pending', 'Thinking'],
    ['idle', 'Stopped'],
    ['error', 'Error']
  ] as const)('renders %s -> %s', (runState, label) => {
    render(<ConversationStatusBadge runState={runState} />)
    expect(screen.getByRole('status', { name: label })).toBeTruthy()
  })
})
