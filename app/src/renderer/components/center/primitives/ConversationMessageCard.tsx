import type { ReactNode } from 'react'
import { X } from 'lucide-react'

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
  const isUser = message.role === 'user'

  return (
    <article
      className={
        isUser
          ? 'w-full rounded-xl border border-border/70 bg-card/70 px-4 py-3'
          : 'w-full border-0 bg-transparent px-0 py-1'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-2">
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
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
    </article>
  )
}
