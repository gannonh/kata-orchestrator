import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConversationMessageActions } from '../../../../../src/renderer/components/center/primitives/ConversationMessageActions'

describe('ConversationMessageActions', () => {
  it('renders actions and calls onAction', () => {
    const onAction = vi.fn()

    render(
      <ConversationMessageActions
        actions={[{ id: 'approve', label: 'Approve', variant: 'default' }]}
        onAction={onAction}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onAction).toHaveBeenCalledWith('approve')
  })
})
