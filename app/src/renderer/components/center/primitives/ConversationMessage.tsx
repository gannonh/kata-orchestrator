import { cn } from '../../../lib/cn'
import { MarkdownRenderer } from '../../shared/MarkdownRenderer'
import type { PrimitiveMessage, PrimitiveMessageVariant } from './types'

type ConversationMessageProps = {
  message: PrimitiveMessage
  variant?: PrimitiveMessageVariant
  agentLabel?: string
}

export function ConversationMessage({
  message,
  variant = 'default',
  agentLabel = 'Kata'
}: ConversationMessageProps) {
  const isUser = message.role === 'user'
  const isCollapsed = variant === 'collapsed' && Boolean(message.summary?.trim())
  const content = isCollapsed ? message.summary ?? '' : message.content

  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {isUser ? 'You' : agentLabel}
      </span>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-3',
          isUser
            ? 'bg-primary/10 text-foreground'
            : 'bg-muted/30 text-muted-foreground',
          isCollapsed ? 'border border-dashed border-border/60' : ''
        )}
      >
        {isUser ? (
          <p className="m-0 whitespace-pre-wrap text-sm leading-6">{content}</p>
        ) : (
          <MarkdownRenderer content={content} />
        )}
      </div>
    </div>
  )
}
