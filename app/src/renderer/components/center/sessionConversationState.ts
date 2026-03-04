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
      if (state.runState !== 'empty' && state.runState !== 'idle') {
        return state
      }

      return {
        runState: 'pending',
        messages: [...state.messages, createMessage(state, 'user', event.prompt)]
      }
    case 'RUN_STREAM_UPDATED': {
      if (state.runState !== 'pending' || !event.response) {
        return state
      }

      const lastMessage = state.messages[state.messages.length - 1]
      if (lastMessage?.role === 'agent') {
        return {
          ...state,
          messages: [
            ...state.messages.slice(0, -1),
            {
              ...lastMessage,
              content: event.response
            }
          ]
        }
      }

      return {
        ...state,
        messages: [...state.messages, createMessage(state, 'agent', event.response)]
      }
    }
    case 'RUN_SUCCEEDED': {
      if (state.runState !== 'pending') {
        return state
      }

      const lastMessage = state.messages[state.messages.length - 1]
      if (lastMessage?.role === 'agent') {
        return {
          ...state,
          runState: 'idle',
          messages: [
            ...state.messages.slice(0, -1),
            {
              ...lastMessage,
              content: event.response
            }
          ]
        }
      }

      return {
        ...state,
        runState: 'idle',
        messages: [...state.messages, createMessage(state, 'agent', event.response)]
      }
    }
    case 'RUN_FAILED':
      if (state.runState !== 'pending' && state.runState !== 'empty') {
        return state
      }

      return {
        ...state,
        runState: 'error',
        errorMessage: event.error
      }
    case 'APPEND_MESSAGE': {
      if (state.messages.some((message) => message.id === event.message.id)) {
        return {
          ...state,
          messages: state.messages.map((message) => (message.id === event.message.id ? event.message : message))
        }
      }

      return {
        ...state,
        messages: [...state.messages, event.message]
      }
    }
    case 'UPDATE_MESSAGE': {
      const existingMessageIndex = state.messages.findIndex((message) => message.id === event.message.id)
      if (existingMessageIndex < 0) {
        return state
      }

      return {
        ...state,
        messages: state.messages.map((message) => (message.id === event.message.id ? event.message : message))
      }
    }
    case 'RETRY_FROM_ERROR':
      if (state.runState !== 'error') {
        return state
      }

      return {
        ...state,
        runState: 'pending',
        errorMessage: undefined
      }
    case 'RUN_COMPLETED':
      if (state.runState !== 'pending') {
        return state
      }

      return {
        ...state,
        runState: 'idle'
      }
    case 'TASK_ACTIVITY_SNAPSHOT_RECEIVED':
      return {
        ...state,
        taskActivitySnapshot: event.snapshot
      }
    case 'RESET_CONVERSATION':
      return createInitialSessionConversationState()
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
    createdAt: new Date().toISOString()
  }
}
