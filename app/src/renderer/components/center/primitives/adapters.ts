import type { ChatMessage } from '../../../types/chat'
import type {
  ConversationActivityPhase,
  ConversationMessage,
  ConversationRunState
} from '../../../types/session-conversation'
import type { SessionAgentRecord } from '../../../../shared/types/space'
import type {
  CoordinatorStatusBadgeState,
  PrimitiveMessage,
  PrimitiveRunState
} from './types'

const ACTIVE_COORDINATOR_STATUSES = new Set<SessionAgentRecord['status']>([
  'queued',
  'delegating',
  'running'
])

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

// Identity adapter — intentional contract seam between domain ConversationRunState
// and primitive PrimitiveRunState. Keeps consumers decoupled from the domain type
// and provides a single place to add mapping logic if the types ever diverge.
export function toPrimitiveRunState(
  runState: ConversationRunState
): PrimitiveRunState {
  return runState
}

export function toCoordinatorStatusBadgeState(input: {
  conversationRunState?: ConversationRunState
  activityPhase?: ConversationActivityPhase
  activeAgent?: SessionAgentRecord
}): CoordinatorStatusBadgeState {
  if (input.activeAgent?.status === 'failed') {
    return 'error'
  }

  if (
    input.activeAgent &&
    ACTIVE_COORDINATOR_STATUSES.has(input.activeAgent.status)
  ) {
    return 'running'
  }

  if (input.activityPhase === 'thinking') {
    return 'thinking'
  }

  if (input.activityPhase === 'drafting') {
    return 'drafting'
  }

  switch (input.conversationRunState) {
    case 'pending':
      return 'thinking'
    case 'idle':
      return 'stopped'
    case 'error':
      return 'error'
    case 'empty':
    default:
      return 'ready'
  }
}
