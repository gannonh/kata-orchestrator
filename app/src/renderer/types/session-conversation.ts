export type ConversationRunState = 'empty' | 'pending' | 'error' | 'idle'

export type ConversationMessageRole = 'user' | 'agent'

export interface ConversationMessage {
  id: string
  role: ConversationMessageRole
  content: string
  createdAt: string
}

export interface SessionConversationState {
  runState: ConversationRunState
  messages: ConversationMessage[]
  errorMessage?: string
}

export type SubmitPromptEvent = {
  type: 'SUBMIT_PROMPT'
  message: ConversationMessage & { role: 'user' }
}

export type RunSucceededEvent = {
  type: 'RUN_SUCCEEDED'
  message: ConversationMessage & { role: 'agent' }
}

export type RunFailedEvent = {
  type: 'RUN_FAILED'
  errorMessage: string
}

export type RetryFromErrorEvent = {
  type: 'RETRY_FROM_ERROR'
}

export type SessionConversationEvent =
  | SubmitPromptEvent
  | RunSucceededEvent
  | RunFailedEvent
  | RetryFromErrorEvent
