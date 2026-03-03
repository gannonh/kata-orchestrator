import { Button } from '../ui/button'

export type MessageAction<TActionId extends string = string> = {
  id: TActionId
  label: string
  variant: 'default' | 'secondary' | 'outline'
}

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
