import type { LatestRunDraft } from './spec-document'
import type { TaskActivitySnapshot } from '@shared/types/task-tracking'

export type ConversationRunState = 'empty' | 'pending' | 'error' | 'idle'
export type ConversationActivityPhase = 'thinking' | 'drafting'

export type ConversationMessageRole = 'user' | 'agent'

export interface ConversationMessage {
  id: string
  role: ConversationMessageRole
  content: string
  createdAt: string
}

export interface SessionConversationState {
  runState: ConversationRunState
  activityPhase?: ConversationActivityPhase
  messages: ConversationMessage[]
  errorMessage?: string
  latestDraft?: LatestRunDraft
  taskActivitySnapshot?: TaskActivitySnapshot
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

export type AppendMessageEvent = {
  type: 'APPEND_MESSAGE'
  message: ConversationMessage
}

export type UpdateMessageEvent = {
  type: 'UPDATE_MESSAGE'
  message: ConversationMessage
}

export type RunFailedEvent = {
  type: 'RUN_FAILED'
  error: string
}

export type RetryFromErrorEvent = {
  type: 'RETRY_FROM_ERROR'
}

export type SetActivityPhaseEvent = {
  type: 'SET_ACTIVITY_PHASE'
  phase: ConversationActivityPhase
}

export type ClearActivityPhaseEvent = {
  type: 'CLEAR_ACTIVITY_PHASE'
}

export type RunCompletedEvent = {
  type: 'RUN_COMPLETED'
}

export type TaskActivitySnapshotReceivedEvent = {
  type: 'TASK_ACTIVITY_SNAPSHOT_RECEIVED'
  snapshot: TaskActivitySnapshot
}

export type ResetConversationEvent = {
  type: 'RESET_CONVERSATION'
}

export type SessionConversationEvent =
  | SubmitPromptEvent
  | RunStreamUpdatedEvent
  | RunSucceededEvent
  | AppendMessageEvent
  | UpdateMessageEvent
  | RunFailedEvent
  | RetryFromErrorEvent
  | SetActivityPhaseEvent
  | ClearActivityPhaseEvent
  | RunCompletedEvent
  | TaskActivitySnapshotReceivedEvent
  | ResetConversationEvent
