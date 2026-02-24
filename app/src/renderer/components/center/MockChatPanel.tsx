import { useMockChat } from '../../hooks/useMockChat'
import { ChatInput } from './ChatInput'
import { MessageBubble } from './MessageBubble'
import { MessageList } from './MessageList'
import { ToolCallResult } from './ToolCallResult'
import { deriveMockChatPresentation } from './mockChatPresentation'

export function MockChatPanel() {
  const { messages, isStreaming, sendMessage } = useMockChat()
  const presentation = deriveMockChatPresentation({ messages, isStreaming })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageList>
        {presentation.blocks.map((block) => {
          if (block.type === 'message') {
            return (
              <div
                key={block.id}
                className="space-y-2"
              >
                <MessageBubble message={block.message} />
              </div>
            )
          }

          if (block.type === 'toolCall') {
            return (
              <ToolCallResult
                key={block.id}
                toolCall={block.toolCall}
              />
            )
          }

          if (block.type === 'contextChipRow') {
            return (
              <div
                key={block.id}
                className="flex flex-wrap gap-2"
              >
                {block.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )
          }

          if (block.type === 'collapsedSummary') {
            return (
              <article
                key={block.id}
                className="flex flex-col gap-2 items-end"
              >
                <span className="text-xs uppercase tracking-wide text-muted-foreground">You</span>
                <div className="max-w-[85%] rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
                  {block.summary}
                </div>
              </article>
            )
          }

          if (block.type === 'statusBadge') {
            const isThinking = block.variant === 'thinking'
            return (
              <div
                key={block.id}
                data-testid={isThinking ? 'streaming-indicator' : undefined}
                className="inline-flex w-fit items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground"
              >
                <span className={isThinking ? 'inline-flex h-2 w-2 animate-pulse rounded-full bg-primary' : 'inline-flex h-2 w-2 rounded-full bg-muted-foreground'} />
                <span>{isThinking ? 'Thinking' : 'Stopped'}</span>
                {isThinking ? <span>Kata is streaming a response...</span> : null}
              </div>
            )
          }

          return null
        })}
      </MessageList>
      <ChatInput
        onSend={sendMessage}
        disabled={isStreaming}
      />
    </div>
  )
}
