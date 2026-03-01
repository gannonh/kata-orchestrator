import type { ConversationMessage, ConversationRunState } from './session-conversation'

export type RunStateChangedEvent = {
  type: 'run_state_changed'
  runState: ConversationRunState
  errorMessage?: string
}

export type MessageAppendedEvent = {
  type: 'message_appended'
  message: ConversationMessage
}

export type SessionRuntimeEvent = RunStateChangedEvent | MessageAppendedEvent

type SessionRuntimeAdapter = {
  subscribe: (onEvent: (event: SessionRuntimeEvent) => void) => () => void
  submitPrompt: (prompt: string) => Promise<void> | void
  retry: () => Promise<void> | void
}

export default SessionRuntimeAdapter
