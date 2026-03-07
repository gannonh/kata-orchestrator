import { cn } from '../../../lib/cn'
import { MarkdownRenderer } from '../../shared/MarkdownRenderer'
import type { MarkdownRenderMode } from '../../shared/normalize-markdown-for-render'
import type { PrimitiveMessage, PrimitiveMessageVariant } from './types'

type ConversationMessageProps = {
  message: PrimitiveMessage
  variant?: PrimitiveMessageVariant
  agentLabel?: string
  renderMode?: MarkdownRenderMode
}

export function ConversationMessage({
  message,
  variant = 'default',
  agentLabel = 'Kata',
  renderMode = 'settled'
}: ConversationMessageProps) {
  const isUser = message.role === 'user'
  const isCollapsed = variant === 'collapsed' && Boolean(message.summary?.trim())
  const content = isCollapsed ? message.summary ?? '' : message.content

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {isUser ? 'You' : agentLabel}
      </span>
      <div
        className={cn(
          'w-full text-sm leading-6 text-foreground',
          isCollapsed ? 'opacity-80' : ''
        )}
      >
        {isUser ? (
          <p className="m-0 whitespace-pre-wrap text-sm leading-6">{content}</p>
        ) : (
          <MarkdownRenderer content={content} renderMode={renderMode} />
        )}
      </div>
    </div>
  )
}
