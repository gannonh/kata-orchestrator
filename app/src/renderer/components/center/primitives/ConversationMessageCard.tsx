import type { ReactNode } from 'react'

import { ConversationMessage } from './ConversationMessage'
import type { PrimitiveMessage, PrimitiveMessageVariant } from './types'

type ConversationMessageCardProps = {
  message: PrimitiveMessage
  variant?: PrimitiveMessageVariant
  timestampLabel?: string
  agentLabel?: string
  onDismiss?: () => void
  metadata?: ReactNode
  footer?: ReactNode
}

export function ConversationMessageCard({
  message,
  variant = 'default',
  timestampLabel,
  agentLabel,
  onDismiss,
  metadata,
  footer
}: ConversationMessageCardProps) {
  return (
    <article className="rounded-xl border border-border/70 bg-card/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-2">
          {timestampLabel ? (
            <p className="text-xs text-muted-foreground">{timestampLabel}</p>
          ) : null}
          <ConversationMessage
            message={message}
            variant={variant}
            agentLabel={agentLabel}
          />
          {metadata ? (
            <div className="text-xs text-muted-foreground">{metadata}</div>
          ) : null}
          {footer ? <div className="pt-1">{footer}</div> : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={onDismiss}
          >
            x
          </button>
        ) : null}
      </div>
    </article>
  )
}
