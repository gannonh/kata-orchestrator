import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button } from '../ui/button'

export type ModelInfo = {
  provider: string
  modelId: string
  name: string
  authStatus: string
}

type ModelSelectorProps = {
  currentModel: ModelInfo
  models: ModelInfo[]
  onModelChange: (model: ModelInfo) => void
  disabled?: boolean
}

export function ModelSelector({
  currentModel,
  models,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground"
        disabled={disabled}
        onClick={() => {
          setOpen(!open)
        }}
      >
        {currentModel.name}
        <ChevronDown className="h-3 w-3" />
      </Button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
          {models.map((model) => (
            <button
              key={`${model.provider}-${model.modelId}`}
              type="button"
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                if (model.authStatus !== 'none') {
                  onModelChange(model)
                  setOpen(false)
                }
              }}
              disabled={model.authStatus === 'none'}
            >
              <span
                className={model.authStatus === 'none' ? 'text-muted-foreground' : ''}
              >
                {model.name}
              </span>
              {model.authStatus === 'none' && (
                <span className="text-xs text-muted-foreground">Log in</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
