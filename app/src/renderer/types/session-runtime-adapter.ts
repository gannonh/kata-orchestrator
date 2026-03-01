import type { ConversationMessage, ConversationRunState } from './session-conversation'

type NonErrorConversationRunState = Exclude<ConversationRunState, 'error'>

export type ErrorRunStateChangedEvent = {
  type: 'run_state_changed'
  runState: 'error'
  errorMessage: string
}

export type NonErrorRunStateChangedEvent = {
  type: 'run_state_changed'
  runState: NonErrorConversationRunState
  errorMessage?: never
}

export type RunStateChangedEvent = ErrorRunStateChangedEvent | NonErrorRunStateChangedEvent

export type MessageAppendedEvent = {
  type: 'message_appended'
  message: ConversationMessage
}

export type SessionRuntimeEvent = RunStateChangedEvent | MessageAppendedEvent

export type SessionRuntimeAdapter = {
  subscribe: (onEvent: (event: SessionRuntimeEvent) => void) => () => void
  submitPrompt: (prompt: string) => Promise<void> | void
  retry: () => Promise<void> | void
}
