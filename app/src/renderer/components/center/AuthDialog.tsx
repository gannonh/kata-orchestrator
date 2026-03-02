import { Button } from '../ui/button'

type AuthDialogProps = {
  open: boolean
  onClose: () => void
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  if (!open) return null

  const handleLogin = (provider: string) => {
    window.kata?.authLogin?.(provider)?.catch(() => {
      // Auth flow failed; keep UI stable.
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Connect Provider</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Choose a provider to authenticate with.
        </p>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => handleLogin('anthropic')}
          >
            Anthropic (Claude)
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => handleLogin('openai')}
          >
            OpenAI
          </Button>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
