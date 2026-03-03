import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { cn } from '../../lib/cn'
import { type ChatMessage } from '../../types/chat'
import { type ConversationMessage } from '../../types/session-conversation'
import { MessageActionRow } from './MessageActionRow'
import type { InlineDecisionActionId, InlineDecisionCard } from './message-decision-parser'

type BubbleMessage = ChatMessage | ConversationMessage
type DecisionState = 'available' | 'pending' | 'resolved'

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
  const isUser = message.role === 'user'
  const isCollapsed = variant === 'collapsed' && Boolean(summary?.trim())
  const displayContent = isCollapsed ? summary ?? '' : message.content
  const shouldRenderDecisionCard = message.role === 'agent' && Boolean(decisionCard)
  const isDecisionDisabled = decisionState === 'pending' || decisionState === 'resolved'

  return (
    <article className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {isUser ? 'You' : 'Kata'}
      </span>
      <div
        className={cn(
          'max-w-[85%] rounded-xl border px-4 py-3',
          isUser
            ? 'border-primary/20 bg-primary/10 text-foreground'
            : 'bg-card text-muted-foreground',
          isCollapsed ? 'border-dashed' : ''
        )}
      >
        {isUser ? (
          <p className="m-0 whitespace-pre-wrap text-sm leading-6">{displayContent}</p>
        ) : (
          <MarkdownRenderer content={displayContent} />
        )}
      </div>
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
          {decisionState === 'resolved' ? <p className="text-xs text-muted-foreground">Decision sent</p> : null}
        </div>
      ) : null}
    </article>
  )
}
