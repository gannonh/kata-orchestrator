import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConversationStream } from '../../../../../src/renderer/components/center/primitives/ConversationStream'

describe('ConversationStream', () => {
  it('registers scrollToMessage callback', () => {
    const onRegisterScrollToMessage = vi.fn()

    render(
      <ConversationStream onRegisterScrollToMessage={onRegisterScrollToMessage}>
        <div data-message-id="m-1">Message</div>
      </ConversationStream>
    )

    expect(onRegisterScrollToMessage).toHaveBeenCalledWith(expect.any(Function))
  })
})
