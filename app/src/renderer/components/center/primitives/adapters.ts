import type { ChatMessage } from '../../../types/chat'
import type {
  ConversationMessage,
  ConversationRunState
} from '../../../types/session-conversation'
import type { PrimitiveMessage, PrimitiveRunState } from './types'

export function toPrimitiveMessage(
  message: ConversationMessage | ChatMessage
): PrimitiveMessage {
  const role = message.role === 'assistant' ? 'agent' : message.role

  return {
    id: message.id,
    role,
    content: message.content,
    createdAt: 'createdAt' in message ? message.createdAt : undefined
  }
}

export function toPrimitiveRunState(
  runState: ConversationRunState
): PrimitiveRunState {
  return runState
}
