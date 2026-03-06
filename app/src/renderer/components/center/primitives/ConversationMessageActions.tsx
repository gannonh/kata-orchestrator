import { Button } from '../../ui/button'
import type { ActionVariant } from '../message-decision-parser'

export type ConversationMessageAction<TActionId extends string = string> = {
  id: TActionId
  label: string
  variant: ActionVariant
}

type ConversationMessageActionsProps<TActionId extends string = string> = {
  actions: Array<ConversationMessageAction<TActionId>>
  disabled?: boolean
  onAction: (actionId: TActionId) => void
}

export function ConversationMessageActions<TActionId extends string = string>({
  actions,
  disabled = false,
  onAction
}: ConversationMessageActionsProps<TActionId>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          size="sm"
          variant={action.variant}
          disabled={disabled}
          onClick={() => {
            onAction(action.id)
          }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}
