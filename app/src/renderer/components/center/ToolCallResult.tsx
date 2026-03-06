import { type ToolCallRecord } from '../../types/chat'
import { ConversationToolCallBlock } from './primitives/ConversationBlocks'

type ToolCallResultProps = {
  toolCall: ToolCallRecord
}

export function ToolCallResult({ toolCall }: ToolCallResultProps) {
  return <ConversationToolCallBlock toolCall={toolCall} />
}
