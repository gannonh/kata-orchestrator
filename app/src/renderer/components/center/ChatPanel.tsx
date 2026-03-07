import { useEffect, useMemo, useState } from 'react'

import { useIpcSessionConversation } from '../../hooks/useIpcSessionConversation'
import { useSessionModelSelection } from '../../hooks/useSessionModelSelection'
import type { LatestRunDraft } from '../../types/spec-document'
import type { ConversationEntry } from '../left/conversation-entry-index'
import { buildConversationEntries } from '../left/conversation-entry-index'
import { ChatInput } from './ChatInput'
import { MessageBubble } from './MessageBubble'
import { ModelSelector } from './ModelSelector'
import { type DecisionState, extractInlineDecisionCard, type InlineDecisionCard, isDecisionResolved } from './message-decision-parser'
import { type ScrollToMessage, MessageList } from './MessageList'
import { toCoordinatorStatusBadgeState, toPrimitiveRunState } from './primitives/adapters'
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
  const { currentModel, models, setCurrentModel, isHydrated } = useSessionModelSelection(sessionId)
  const [dismissedMessageIds, setDismissedMessageIds] = useState<Set<string>>(() => new Set())
  const primitiveRunState = toPrimitiveRunState(state.runState)
  const isModelSelectionReady = !sessionId || (isHydrated && currentModel !== null)
  const coordinatorStatusBadgeState = toCoordinatorStatusBadgeState({
    conversationRunState: state.runState,
    activityPhase: state.activityPhase
  })
  const visibleMessages = useMemo(
    () => state.messages.filter((message) => !dismissedMessageIds.has(message.id)),
    [dismissedMessageIds, state.messages]
  )
  const streamingMessageId = useMemo(() => {
    if (state.runState !== 'pending') {
      return null
    }

    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      if (visibleMessages[i]?.role === 'agent') {
        return visibleMessages[i].id
      }
    }

    return null
  }, [state.runState, visibleMessages])
  const conversationEntries = useMemo(() => buildConversationEntries(visibleMessages), [visibleMessages])

  useEffect(() => {
    setDismissedMessageIds(new Set())
  }, [sessionId])

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
      for (const message of visibleMessages) {
        const card = extractInlineDecisionCard(message)
        const resolved = card ? isDecisionResolved(state.messages, card) : false
        map.set(message.id, { card, resolved })
      }
      return map
    },
    [state.messages, visibleMessages]
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageList onRegisterScrollToMessage={onRegisterScrollToMessage}>
        {visibleMessages.map((message) => {
          const { card: decisionCard, resolved } = decisionCardMap.get(message.id)!
          const decisionState: DecisionState = resolved
            ? 'resolved'
            : primitiveRunState === 'pending' || !isModelSelectionReady
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
                activityPhase={state.activityPhase}
                conversationRunState={state.runState}
                renderMode={message.role === 'agent' && message.id === streamingMessageId ? 'streaming' : 'settled'}
                decisionCard={decisionCard}
                decisionState={decisionState}
                onDecisionAction={(actionId) => {
                  const selectedAction =
                    decisionState === 'available'
                      ? decisionCard?.actions.find((action) => action.id === actionId)
                      : undefined

                  if (selectedAction) {
                    submitPrompt(selectedAction.followUpPrompt, currentModel ?? undefined)
                  }
                }}
                onDismiss={(messageId) => {
                  setDismissedMessageIds((current) => {
                    const next = new Set(current)
                    next.add(messageId)
                    return next
                  })
                }}
              />
            </div>
          )
        })}
      </MessageList>
      <div className="shrink-0 px-4 py-2">
        <ConversationStatusBadge state={coordinatorStatusBadgeState} />
      </div>
      <ChatInput
        onSend={(prompt) => {
          submitPrompt(prompt, currentModel ?? undefined)
        }}
        onRetry={() => {
          retry(currentModel ?? undefined)
        }}
        runState={state.runState}
        disabled={!sessionId || !isModelSelectionReady}
        modelSlot={
          currentModel && isModelSelectionReady ? (
            <ModelSelector
              currentModel={currentModel}
              models={models}
              onModelChange={setCurrentModel}
              disabled={!sessionId}
            />
          ) : null
        }
      />
    </div>
  )
}
