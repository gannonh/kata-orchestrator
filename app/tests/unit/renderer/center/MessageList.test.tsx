import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MessageList } from '../../../../src/renderer/components/center/MessageList'

function mockScrollHeight(height: number): () => void {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')

  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => height
  })

  return () => {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', original)
      return
    }

    delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight
  }
}

describe('MessageList', () => {
  let restoreScrollHeight: (() => void) | undefined
  let restoreScrollIntoView: (() => void) | undefined

  afterEach(() => {
    restoreScrollHeight?.()
    restoreScrollIntoView?.()
    restoreScrollHeight = undefined
    restoreScrollIntoView = undefined
  })

  it('auto-scrolls to the bottom when messages change', () => {
    restoreScrollHeight = mockScrollHeight(640)

    const { getByTestId, rerender } = render(
      <MessageList>
        <div>Message 1</div>
      </MessageList>
    )

    const messageList = getByTestId('message-list')
    const viewport = messageList.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null
    const listInner = viewport?.querySelector('div > .space-y-5') as HTMLDivElement | null
    expect(viewport?.scrollTop).toBe(640)
    expect(listInner).toBeTruthy()
    expect(messageList.className).toContain('px-0')

    rerender(
      <MessageList>
        <div>Message 1</div>
        <div>Message 2</div>
      </MessageList>
    )

    expect(viewport?.scrollTop).toBe(640)
  })

  it('registers a scrollToMessage helper that finds anchored rows', () => {
    const onRegisterScrollToMessage = vi.fn()
    const scrollIntoView = vi.fn()
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    })

    restoreScrollIntoView = () => {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original)
        return
      }
      delete (HTMLElement.prototype as { scrollIntoView?: () => void }).scrollIntoView
    }

    render(
      <MessageList onRegisterScrollToMessage={onRegisterScrollToMessage}>
        <div data-message-id="m-1">Message 1</div>
      </MessageList>
    )

    expect(onRegisterScrollToMessage).toHaveBeenCalledWith(expect.any(Function))
    const scrollToMessage = onRegisterScrollToMessage.mock.calls[0]?.[0] as (messageId: string) => boolean

    expect(scrollToMessage('m-1')).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(scrollToMessage('missing')).toBe(false)
  })
})
