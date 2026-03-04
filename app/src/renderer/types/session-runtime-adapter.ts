import type { ConversationMessage, ConversationRunState } from './session-conversation'
import type { TaskActivitySnapshot } from '@shared/types/task-tracking'

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
  runId?: string
}

export type MessageUpdatedEvent = {
  type: 'message_updated'
  message: ConversationMessage
  runId?: string
}

export type TaskActivitySnapshotEvent = {
  type: 'task_activity_snapshot'
  snapshot: TaskActivitySnapshot
}

export type SessionRuntimeEvent =
  | RunStateChangedEvent
  | MessageAppendedEvent
  | MessageUpdatedEvent
  | TaskActivitySnapshotEvent

export type SessionRuntimeAdapter = {
  subscribe: (onEvent: (event: SessionRuntimeEvent) => void) => () => void
  submitPrompt: (prompt: string) => Promise<void> | void
  retry: () => Promise<void> | void
}

type ExpectedSessionRuntimeAdapterShape = {
  subscribe: (onEvent: (event: SessionRuntimeEvent) => void) => () => void
  submitPrompt: (prompt: string) => Promise<void> | void
  retry: () => Promise<void> | void
}

type AssertTrue<T extends true> = T

type AreMutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type SessionRuntimeAdapterMatchesExpectedShape = AssertTrue<
  AreMutuallyAssignable<SessionRuntimeAdapter, ExpectedSessionRuntimeAdapterShape>
>

type ExpectedShapeMatchesSessionRuntimeAdapter = AssertTrue<
  AreMutuallyAssignable<ExpectedSessionRuntimeAdapterShape, SessionRuntimeAdapter>
>
