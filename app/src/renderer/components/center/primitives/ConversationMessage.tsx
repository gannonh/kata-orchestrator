import { cn } from '../../../lib/cn'
import { MarkdownRenderer } from '../../shared/MarkdownRenderer'
import type { PrimitiveMessage, PrimitiveMessageVariant } from './types'

type ConversationMessageProps = {
  message: PrimitiveMessage
  variant?: PrimitiveMessageVariant
}

export function ConversationMessage({
  message,
  variant = 'default'
}: ConversationMessageProps) {
  const isUser = message.role === 'user'
  const isCollapsed = variant === 'collapsed' && Boolean(message.summary?.trim())
  const content = isCollapsed ? message.summary ?? '' : message.content

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
          <p className="m-0 whitespace-pre-wrap text-sm leading-6">{content}</p>
        ) : (
          <MarkdownRenderer content={content} />
        )}
      </div>
    </article>
  )
}
