import {
  ConversationMessageActions,
  type ConversationMessageAction
} from './primitives/ConversationMessageActions'

export type MessageAction<TActionId extends string = string> =
  ConversationMessageAction<TActionId>

type MessageActionRowProps<TActionId extends string = string> = {
  actions: Array<MessageAction<TActionId>>
  disabled?: boolean
  onAction: (actionId: TActionId) => void
}

export function MessageActionRow<TActionId extends string = string>({
  actions,
  disabled = false,
  onAction
}: MessageActionRowProps<TActionId>) {
  return (
    <ConversationMessageActions
      actions={actions}
      disabled={disabled}
      onAction={onAction}
    />
  )
}
