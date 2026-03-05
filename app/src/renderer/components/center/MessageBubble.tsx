import { type ChatMessage } from '../../types/chat'
import { type ConversationMessage } from '../../types/session-conversation'
import { MessageActionRow } from './MessageActionRow'
import { ConversationMessage as ConversationMessagePrimitive, toPrimitiveMessage } from './primitives'
import { stripDecisionActionLines, type DecisionState, type InlineDecisionActionId, type InlineDecisionCard } from './message-decision-parser'

type BubbleMessage = ChatMessage | ConversationMessage

type MessageBubbleProps = {
  message: BubbleMessage
  variant?: 'default' | 'collapsed'
  summary?: string
  decisionCard?: InlineDecisionCard
  decisionState?: DecisionState
  onDecisionAction?: (actionId: InlineDecisionActionId) => void
}

export function MessageBubble({
  message,
  variant = 'default',
  summary,
  decisionCard,
  decisionState = 'available',
  onDecisionAction
}: MessageBubbleProps) {
  const primitiveMessage = toPrimitiveMessage(message)
  const messageWithSummary = summary
    ? { ...primitiveMessage, summary }
    : primitiveMessage

  const shouldRenderDecisionCard = message.role === 'agent' && Boolean(decisionCard)
  const displayMessage = shouldRenderDecisionCard
    ? {
        ...messageWithSummary,
        content: stripDecisionActionLines(messageWithSummary.content),
        summary: messageWithSummary.summary
          ? stripDecisionActionLines(messageWithSummary.summary)
          : undefined
      }
    : messageWithSummary
  const isDecisionDisabled = decisionState === 'pending' || decisionState === 'resolved'

  return (
    <div className="flex flex-col gap-2">
      <ConversationMessagePrimitive
        message={displayMessage}
        variant={variant}
      />
      {shouldRenderDecisionCard && decisionCard ? (
        <div className="max-w-[85%] space-y-2 px-1">
          <p className="text-xs text-muted-foreground">{decisionCard.promptLabel}</p>
          <MessageActionRow
            actions={decisionCard.actions}
            disabled={isDecisionDisabled}
            onAction={(actionId) => {
              onDecisionAction?.(actionId)
            }}
          />
          {decisionState === 'pending' ? <p className="text-xs text-muted-foreground">Sending…</p> : null}
          {decisionState === 'resolved' ? <p className="text-xs text-muted-foreground">Decision sent</p> : null}
        </div>
      ) : null}
    </div>
  )
}
