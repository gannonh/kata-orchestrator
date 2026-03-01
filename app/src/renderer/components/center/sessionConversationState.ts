import type {
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
        messages: [...state.messages, event.message]
      }
    case 'RUN_SUCCEEDED':
      return {
        runState: 'idle',
        messages: [...state.messages, event.message]
      }
    case 'RUN_FAILED':
      return {
        ...state,
        runState: 'error',
        errorMessage: event.errorMessage
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
