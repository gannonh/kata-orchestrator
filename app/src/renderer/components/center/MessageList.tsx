import { type ReactNode } from 'react'

import { ConversationStream, type ScrollToMessage } from './primitives/ConversationStream'

type MessageListProps = {
  children: ReactNode
  onRegisterScrollToMessage?: (scrollToMessage: ScrollToMessage) => void
}

export function MessageList({ children, onRegisterScrollToMessage }: MessageListProps) {
  return (
    <ConversationStream
      onRegisterScrollToMessage={onRegisterScrollToMessage}
    >
      {children}
    </ConversationStream>
  )
}
