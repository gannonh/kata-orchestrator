import type {
  ConversationMessage,
  ConversationMessageRole,
  SessionConversationEvent,
  SessionConversationState
} from '../../types/session-conversation'

export function createInitialSessionConversationState(): SessionConversationState {
  return {
    runState: 'empty',
    messages: []
  }
}

export function sessionConversationReducer(
  state: SessionConversationState,
  event: SessionConversationEvent
): SessionConversationState {
  switch (event.type) {
    case 'SUBMIT_PROMPT':
      return {
        runState: 'pending',
        messages: [...state.messages, createMessage(state, 'user', event.prompt)]
      }
    case 'RUN_SUCCEEDED':
      return {
        runState: 'idle',
        messages: [...state.messages, createMessage(state, 'agent', event.response)]
      }
    case 'RUN_FAILED':
      return {
        ...state,
        runState: 'error',
        errorMessage: event.error
      }
    case 'RETRY_FROM_ERROR':
      return {
        ...state,
        runState: 'pending',
        errorMessage: undefined
      }
    default:
      return state
  }
}

function createMessage(
  state: SessionConversationState,
  role: ConversationMessageRole,
  content: string
): ConversationMessage {
  const sequence = state.messages.length + 1

  return {
    id: `${role}-${sequence}`,
    role,
    content,
    createdAt: new Date(sequence * 1000).toISOString()
  }
}
