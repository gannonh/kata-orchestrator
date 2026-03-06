import { type ChatMessage } from '../../types/chat'
import { type ConversationMessage } from '../../types/session-conversation'
import { formatRelativeTime } from './format-relative-time'
import { MessageActionRow } from './MessageActionRow'
import { stripDecisionActionLines, type DecisionState, type InlineDecisionActionId, type InlineDecisionCard } from './message-decision-parser'
import { getPastedContentFooter } from './pasted-content-utils'
import { ConversationMessageCard, toPrimitiveMessage } from './primitives'

type BubbleMessage = ChatMessage | ConversationMessage

type MessageBubbleProps = {
  message: BubbleMessage
  variant?: 'default' | 'collapsed'
  summary?: string
  decisionCard?: InlineDecisionCard
  decisionState?: DecisionState
  onDecisionAction?: (actionId: InlineDecisionActionId) => void
  onDismiss?: (messageId: string) => void
}

export function MessageBubble({
  message,
  variant = 'default',
  summary,
  decisionCard,
  decisionState = 'available',
  onDecisionAction,
  onDismiss
}: MessageBubbleProps) {
  const primitiveMessage = toPrimitiveMessage(message)
  const messageWithSummary = summary
    ? { ...primitiveMessage, summary }
    : primitiveMessage

  const shouldRenderDecisionCard = primitiveMessage.role === 'agent' && Boolean(decisionCard)
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
  const timestampLabel =
    'createdAt' in message && typeof message.createdAt === 'string'
      ? formatRelativeTime(message.createdAt)
      : undefined
  const footerLabel =
    primitiveMessage.role === 'user'
      ? getPastedContentFooter(displayMessage.content)
      : undefined

  return (
    <div className="flex flex-col gap-2">
      <ConversationMessageCard
        message={displayMessage}
        variant={variant}
        timestampLabel={timestampLabel}
        footer={footerLabel ? <span>{footerLabel}</span> : undefined}
        onDismiss={footerLabel ? () => onDismiss?.(primitiveMessage.id) : undefined}
      />
      {shouldRenderDecisionCard && decisionCard ? (
        <div className="w-full space-y-2 px-1">
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
