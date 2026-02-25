import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { cn } from '../../lib/cn'
import { type ChatMessage } from '../../types/chat'

type MessageBubbleProps = {
  message: ChatMessage
  variant?: 'default' | 'collapsed'
  summary?: string
}

export function MessageBubble({ message, variant = 'default', summary }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isCollapsed = variant === 'collapsed' && Boolean(summary?.trim())
  const displayContent = isCollapsed ? summary ?? '' : message.content

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
    </article>
  )
}
