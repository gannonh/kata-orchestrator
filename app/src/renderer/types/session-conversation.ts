import type { LatestRunDraft } from './spec-document'

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
  latestDraft?: LatestRunDraft
}

export type SubmitPromptEvent = {
  type: 'SUBMIT_PROMPT'
  prompt: string
}

export type RunSucceededEvent = {
  type: 'RUN_SUCCEEDED'
  response: string
}

export type RunStreamUpdatedEvent = {
  type: 'RUN_STREAM_UPDATED'
  response: string
}

export type RunFailedEvent = {
  type: 'RUN_FAILED'
  error: string
}

export type RetryFromErrorEvent = {
  type: 'RETRY_FROM_ERROR'
}

export type RunCompletedEvent = {
  type: 'RUN_COMPLETED'
}

export type ResetConversationEvent = {
  type: 'RESET_CONVERSATION'
}

export type SessionConversationEvent =
  | SubmitPromptEvent
  | RunStreamUpdatedEvent
  | RunSucceededEvent
  | RunFailedEvent
  | RetryFromErrorEvent
  | RunCompletedEvent
  | ResetConversationEvent
