import type { ConversationRunState } from '../../types/session-conversation'
import { ConversationStatusBadge, toPrimitiveRunState } from './primitives'

type RunStatusBadgeProps = {
  runState: ConversationRunState
}

export function RunStatusBadge({ runState }: RunStatusBadgeProps) {
  return <ConversationStatusBadge runState={toPrimitiveRunState(runState)} />
}
