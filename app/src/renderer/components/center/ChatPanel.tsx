import { useEffect, useMemo } from 'react'

import { useIpcSessionConversation } from '../../hooks/useIpcSessionConversation'
import type { LatestRunDraft } from '../../types/spec-document'
import type { ConversationEntry } from '../left/conversation-entry-index'
import { buildConversationEntries } from '../left/conversation-entry-index'
import { ChatInput } from './ChatInput'
import { MessageBubble } from './MessageBubble'
import { type DecisionState, extractInlineDecisionCard, type InlineDecisionCard, isDecisionResolved } from './message-decision-parser'
import { type ScrollToMessage, MessageList } from './MessageList'
import { toPrimitiveRunState } from './primitives/adapters'
import { ConversationStatusBadge } from './primitives/ConversationStatusBadge'
import type { TaskActivitySnapshot } from '@shared/types/task-tracking'

type ChatPanelProps = {
  sessionId: string | null
  spaceId?: string | null
  onLatestDraftChange?: (draft: LatestRunDraft | undefined) => void
  onTaskActivitySnapshotChange?: (snapshot: TaskActivitySnapshot | undefined) => void
  onConversationEntriesChange?: (entries: ConversationEntry[]) => void
  onRegisterScrollToMessage?: (scrollToMessage: ScrollToMessage) => void
}

export function ChatPanel({
  sessionId,
  spaceId,
  onLatestDraftChange,
  onTaskActivitySnapshotChange,
  onConversationEntriesChange,
  onRegisterScrollToMessage
}: ChatPanelProps) {
  const { state, submitPrompt, retry } = useIpcSessionConversation(sessionId, spaceId ?? null)
  const primitiveRunState = toPrimitiveRunState(state.runState)
  const conversationEntries = useMemo(() => buildConversationEntries(state.messages), [state.messages])

  useEffect(() => {
    onLatestDraftChange?.(state.latestDraft)
  }, [onLatestDraftChange, state.latestDraft])

  useEffect(() => {
    onConversationEntriesChange?.(conversationEntries)
  }, [conversationEntries, onConversationEntriesChange])

  useEffect(() => {
    onTaskActivitySnapshotChange?.(state.taskActivitySnapshot)
  }, [onTaskActivitySnapshotChange, state.taskActivitySnapshot])

  const decisionCardMap = useMemo(
    () => {
      const map = new Map<string, { card: InlineDecisionCard | undefined; resolved: boolean }>()
      for (const message of state.messages) {
        const card = extractInlineDecisionCard(message)
        const resolved = card ? isDecisionResolved(state.messages, card) : false
        map.set(message.id, { card, resolved })
      }
      return map
    },
    [state.messages]
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageList onRegisterScrollToMessage={onRegisterScrollToMessage}>
        {state.messages.map((message) => {
          const { card: decisionCard, resolved } = decisionCardMap.get(message.id) ?? { card: undefined, resolved: false }
          const decisionState: DecisionState = resolved
            ? 'resolved'
            : primitiveRunState === 'pending'
              ? 'pending'
              : 'available'

          return (
            <div
              key={message.id}
              id={`message-${message.id}`}
              data-message-id={message.id}
            >
              <MessageBubble
                message={message}
                decisionCard={decisionCard}
                decisionState={decisionState}
                onDecisionAction={(actionId) => {
                  const selectedAction =
                    decisionState === 'available'
                      ? decisionCard?.actions.find((action) => action.id === actionId)
                      : undefined

                  if (selectedAction) {
                    submitPrompt(selectedAction.followUpPrompt)
                  }
                }}
              />
            </div>
          )
        })}
      </MessageList>
      <div className="shrink-0 px-4 py-2">
        <ConversationStatusBadge runState={primitiveRunState} />
      </div>
      <ChatInput
        onSend={submitPrompt}
        onRetry={retry}
        runState={state.runState}
        disabled={!sessionId}
      />
    </div>
  )
}
