import type { ConversationRunState } from '../../types/session-conversation'
import { toPrimitiveRunState } from './primitives/adapters'
import { ConversationStatusBadge } from './primitives/ConversationStatusBadge'

type RunStatusBadgeProps = {
  runState: ConversationRunState
}

export function RunStatusBadge({ runState }: RunStatusBadgeProps) {
  return <ConversationStatusBadge runState={toPrimitiveRunState(runState)} />
}
