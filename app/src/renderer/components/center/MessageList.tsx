import { type ReactNode, useEffect, useRef } from 'react'

import { ScrollArea } from '../ui/scroll-area'

export type ScrollToMessage = (messageId: string) => boolean

type MessageListProps = {
  children: ReactNode
  onRegisterScrollToMessage?: (scrollToMessage: ScrollToMessage) => void
}

function findScrollRoot(container: HTMLDivElement): HTMLDivElement {
  return (container.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null) ?? container
}

export function MessageList({ children, onRegisterScrollToMessage }: MessageListProps) {
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) {
      return
    }

    const scrollTarget = findScrollRoot(list)
    scrollTarget.scrollTop = scrollTarget.scrollHeight
  }, [children])

  useEffect(() => {
    if (!onRegisterScrollToMessage) {
      return
    }

    const scrollToMessage: ScrollToMessage = (messageId) => {
      const list = listRef.current
      if (!list) {
        return false
      }

      const scrollTarget = findScrollRoot(list)
      const target = scrollTarget.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`)
      if (!target) {
        return false
      }

      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }

      return true
    }

    onRegisterScrollToMessage(scrollToMessage)
  }, [onRegisterScrollToMessage])

  return (
    <ScrollArea
      ref={listRef}
      data-testid="message-list"
      className="min-h-0 flex-1 px-0 py-4"
    >
      <div className="space-y-5">{children}</div>
    </ScrollArea>
  )
}
