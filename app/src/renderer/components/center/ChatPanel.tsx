import { useEffect, useMemo } from 'react'

import { useIpcSessionConversation } from '../../hooks/useIpcSessionConversation'
import type { LatestRunDraft } from '../../types/spec-document'
import type { ConversationEntry } from '../left/conversation-entry-index'
import { buildConversationEntries } from '../left/conversation-entry-index'
import { ChatInput } from './ChatInput'
import { MessageBubble } from './MessageBubble'
import { type ScrollToMessage, MessageList } from './MessageList'
import { RunStatusBadge } from './RunStatusBadge'

type ChatPanelProps = {
  sessionId: string | null
  onLatestDraftChange?: (draft: LatestRunDraft | undefined) => void
  onConversationEntriesChange?: (entries: ConversationEntry[]) => void
  onRegisterScrollToMessage?: (scrollToMessage: ScrollToMessage) => void
}

export function ChatPanel({
  sessionId,
  onLatestDraftChange,
  onConversationEntriesChange,
  onRegisterScrollToMessage
}: ChatPanelProps) {
  const { state, submitPrompt, retry } = useIpcSessionConversation(sessionId)
  const conversationEntries = useMemo(() => buildConversationEntries(state.messages), [state.messages])

  useEffect(() => {
    onLatestDraftChange?.(state.latestDraft)
  }, [onLatestDraftChange, state.latestDraft])

  useEffect(() => {
    onConversationEntriesChange?.(conversationEntries)
  }, [conversationEntries, onConversationEntriesChange])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageList onRegisterScrollToMessage={onRegisterScrollToMessage}>
        {state.messages.map((message) => (
          <div
            key={message.id}
            id={`message-${message.id}`}
            data-message-id={message.id}
          >
            <MessageBubble message={message} />
          </div>
        ))}
      </MessageList>
      <div className="shrink-0 px-4 py-2">
        <RunStatusBadge runState={state.runState} />
      </div>
      <ChatInput
        onSend={submitPrompt}
        onRetry={retry}
        runState={state.runState}
      />
    </div>
  )
}
