import { LoaderCircle } from 'lucide-react'

import { type ChatMessage } from '../../types/chat'
import { type ConversationActivityPhase, type ConversationMessage, type ConversationRunState } from '../../types/session-conversation'
import { cn } from '../../lib/cn'
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
  activityPhase?: ConversationActivityPhase
  conversationRunState?: ConversationRunState
  decisionCard?: InlineDecisionCard
  decisionState?: DecisionState
  onDecisionAction?: (actionId: InlineDecisionActionId) => void
  onDismiss?: (messageId: string) => void
}

function toAgentActivityPhase(content: string): 'thinking' | 'drafting' | null {
  const normalized = content.trim().toLowerCase()
  if (normalized === 'thinking') {
    return 'thinking'
  }

  if (normalized === 'drafting') {
    return 'drafting'
  }

  return null
}

export function MessageBubble({
  message,
  variant = 'default',
  summary,
  activityPhase,
  conversationRunState,
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
  const messageActivityPhase =
    primitiveMessage.role === 'agent'
      ? toAgentActivityPhase(displayMessage.content)
      : null

  if (messageActivityPhase) {
    const statusLabel = messageActivityPhase === 'thinking' ? 'Thinking' : 'Drafting'
    const timestampLabel =
      'createdAt' in message && typeof message.createdAt === 'string'
        ? formatRelativeTime(message.createdAt)
        : undefined
    const isActive = activityPhase === messageActivityPhase
    const isCompleted = !isActive && conversationRunState !== 'error'

    return (
      <article
        className={cn(
          'w-full rounded-xl border px-4 py-3 transition-colors',
          isActive ? 'border-border/60 bg-card/40' : 'border-border/40 bg-card/20'
        )}
      >
        <div
          role="status"
          aria-live="polite"
          aria-label={statusLabel}
          className="flex items-start gap-3"
        >
          <span
            className={cn(
              'mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border',
              isActive
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-muted-foreground/30 bg-muted/30 text-muted-foreground'
            )}
          >
            {isActive ? (
              <LoaderCircle
                data-testid="agent-activity-spinner"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-current" />
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Kata</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{statusLabel}</p>
                  {isCompleted ? (
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Completed</span>
                  ) : null}
                </div>
              </div>
              {timestampLabel ? <p className="text-xs text-muted-foreground">{timestampLabel}</p> : null}
            </div>
            {isActive ? (
              <div
                data-testid="agent-activity-pulse"
                className={cn(
                  'h-2 w-full overflow-hidden rounded-full bg-muted/80',
                  'after:block after:h-full after:w-2/5 after:rounded-full after:bg-primary/60 after:content-[\"\"] motion-safe:animate-pulse'
                )}
              />
            ) : (
              <div className="h-2 w-full rounded-full bg-muted/60">
                <div className="h-full w-full rounded-full bg-primary/40" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {isActive
                ? messageActivityPhase === 'thinking'
                  ? 'Working through the request and shaping the spec.'
                  : 'Writing the markdown artifact now.'
                : messageActivityPhase === 'thinking'
                  ? 'Thought process captured.'
                  : 'Draft written to the spec artifact.'}
            </p>
          </div>
        </div>
      </article>
    )
  }

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
