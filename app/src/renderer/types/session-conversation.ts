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
  prompt: string
}

export type RunSucceededEvent = {
  type: 'RUN_SUCCEEDED'
  response: string
}

export type RunFailedEvent = {
  type: 'RUN_FAILED'
  error: string
}

export type RetryFromErrorEvent = {
  type: 'RETRY_FROM_ERROR'
}

export type SessionConversationEvent =
  | SubmitPromptEvent
  | RunSucceededEvent
  | RunFailedEvent
  | RetryFromErrorEvent
