import type { ConversationRunState } from '../../types/session-conversation'
import { toCoordinatorStatusBadgeState } from './primitives/adapters'
import { ConversationStatusBadge } from './primitives/ConversationStatusBadge'

type RunStatusBadgeProps = {
  runState: ConversationRunState
}

export function RunStatusBadge({ runState }: RunStatusBadgeProps) {
  return (
    <ConversationStatusBadge
      state={toCoordinatorStatusBadgeState({ conversationRunState: runState })}
    />
  )
}
