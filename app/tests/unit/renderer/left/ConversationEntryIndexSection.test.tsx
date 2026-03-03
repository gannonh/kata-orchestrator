import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConversationEntryIndexSection } from '../../../../src/renderer/components/left/ConversationEntryIndexSection'

describe('ConversationEntryIndexSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders entry rows and emits jump callback on click', () => {
    const onJumpToMessage = vi.fn()

    render(
      <ConversationEntryIndexSection
        entries={[
          {
            id: 'entry-m-1',
            messageId: 'm-1',
            label: 'Spec Updated',
            timestamp: '10:00 AM',
            role: 'agent'
          },
          {
            id: 'entry-m-2',
            messageId: 'm-2',
            label: 'Architecture proposed',
            timestamp: '10:02 AM',
            role: 'agent'
          }
        ]}
        onJumpToMessage={onJumpToMessage}
      />
    )

    expect(screen.getByRole('heading', { name: 'Conversation Entries' })).toBeTruthy()
    const target = screen.getByRole('button', { name: 'Jump to message: Spec Updated at 10:00 AM' })
    fireEvent.click(target)

    expect(onJumpToMessage).toHaveBeenCalledWith('m-1')
    expect(screen.getByText('Architecture proposed')).toBeTruthy()
  })

  it('shows an empty-state message when no entries exist', () => {
    render(
      <ConversationEntryIndexSection
        entries={[]}
        onJumpToMessage={() => {}}
      />
    )

    expect(screen.getByText('No conversation entries yet.')).toBeTruthy()
  })
})
