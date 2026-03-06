import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { ConversationStream } from '../../../../../src/renderer/components/center/primitives/ConversationStream'

beforeAll(() => {
  if (typeof globalThis.CSS === 'undefined') {
    globalThis.CSS = { escape: (s: string) => s } as typeof CSS
  }
})

describe('ConversationStream', () => {
  it('registers scrollToMessage callback', () => {
    let registered: ((messageId: string) => boolean) | undefined
    const onRegisterScrollToMessage = vi.fn((fn) => {
      registered = fn
    })

    render(
      <ConversationStream onRegisterScrollToMessage={onRegisterScrollToMessage}>
        <div data-message-id="m-1">Message</div>
      </ConversationStream>
    )

    expect(onRegisterScrollToMessage).toHaveBeenCalledWith(expect.any(Function))
    expect(registered).toBeTruthy()
    expect(registered?.('m-1')).toBe(true)
    expect(registered?.('nonexistent')).toBe(false)
  })
})
