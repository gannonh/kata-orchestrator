import { useSessionConversation } from '../../hooks/useSessionConversation'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'
import { deriveMockChatPresentation } from './mockChatPresentation'
import { toCoordinatorStatusBadgeState } from './primitives/adapters'
import { ConversationBlocks } from './primitives/ConversationBlocks'
import { ConversationMessageCard } from './primitives/ConversationMessageCard'
import { ConversationStatusBadge } from './primitives/ConversationStatusBadge'

type MockChatPanelProps = {
  forceAnalyzing?: boolean
}

function getPastedContentFooter(content: string): string | undefined {
  const match = content.match(/pasted\s+(\d+)\s+lines/i)

  if (!match) {
    return undefined
  }

  return `Pasted ${match[1]} lines`
}

export function MockChatPanel({ forceAnalyzing = false }: MockChatPanelProps) {
  const { state, submitPrompt, retry } = useSessionConversation()
  const presentation = deriveMockChatPresentation({
    messages: state.messages,
    isStreaming: state.runState === 'pending',
    forceAnalyzing
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageList>
        {presentation.blocks
          .filter((block) => block.type !== 'statusBadge')
          .map((block) => {
            if (block.type === 'message') {
              const footerLabel = getPastedContentFooter(block.message.content)

              return (
                <div
                  key={block.id}
                  id={`message-${block.message.id}`}
                  data-message-id={block.message.id}
                >
                  <ConversationMessageCard
                    message={block.message}
                    timestampLabel={block.message.createdAt ? 'Just now' : undefined}
                    footer={footerLabel ? <span>{footerLabel}</span> : undefined}
                    onDismiss={footerLabel ? () => undefined : undefined}
                  />
                </div>
              )
            }

            if (block.type === 'collapsedSummary') {
              return (
                <div
                  key={block.id}
                  id={`message-${block.id}`}
                  data-message-id={block.id}
                >
                  <ConversationMessageCard
                    message={{
                      id: block.id,
                      role: 'user',
                      content: block.summary,
                      summary: block.summary
                    }}
                    variant="collapsed"
                    metadata={<span>Pasted content text</span>}
                  />
                </div>
              )
            }

            return (
              <ConversationBlocks
                key={block.id}
                blocks={[block]}
              />
            )
          })}
      </MessageList>
      <div className="shrink-0 px-4 py-2">
        <ConversationStatusBadge
          state={toCoordinatorStatusBadgeState({
            conversationRunState: state.runState
          })}
        />
      </div>
      <ChatInput
        onSend={submitPrompt}
        onRetry={retry}
        runState={state.runState}
      />
    </div>
  )
}
