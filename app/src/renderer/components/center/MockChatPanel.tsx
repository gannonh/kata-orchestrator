import { useSessionConversation } from '../../hooks/useSessionConversation'
import { ChatInput } from './ChatInput'
import { formatRelativeTime } from './format-relative-time'
import { MessageList } from './MessageList'
import { deriveMockChatPresentation } from './mockChatPresentation'
import { getPastedContentFooter } from './pasted-content-utils'
import { toCoordinatorStatusBadgeState } from './primitives/adapters'
import { ConversationBlocks } from './primitives/ConversationBlocks'
import { ConversationMessageCard } from './primitives/ConversationMessageCard'
import { ConversationStatusBadge } from './primitives/ConversationStatusBadge'

type MockChatPanelProps = {
  forceAnalyzing?: boolean
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
                    timestampLabel={block.message.createdAt ? formatRelativeTime(block.message.createdAt) : undefined}
                    footer={footerLabel ? <span>{footerLabel}</span> : undefined}
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
