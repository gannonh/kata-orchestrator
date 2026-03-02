import { useIpcSessionConversation } from '../../hooks/useIpcSessionConversation'
import { ChatInput } from './ChatInput'
import { MessageBubble } from './MessageBubble'
import { MessageList } from './MessageList'
import { RunStatusBadge } from './RunStatusBadge'

type ChatPanelProps = {
  sessionId: string | null
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const { state, submitPrompt, retry } = useIpcSessionConversation(sessionId)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageList>
        {state.messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
          />
        ))}
      </MessageList>
      <div className="shrink-0 px-4 py-2">
        <RunStatusBadge runState={state.runState} />
      </div>
      <ChatInput
        onSend={submitPrompt}
        onRetry={retry}
        runState={state.runState}
      />
    </div>
  )
}
