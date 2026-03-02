import { CheckCircle2, Circle } from 'lucide-react'

type Step = {
  title: string
  description: string
  active?: boolean
}

const steps: Step[] = [
  {
    title: 'Creating Spec',
    description:
      'The coordinator is reviewing the latest run so you can apply an editable structured draft in this panel.',
    active: true
  },
  {
    title: 'Implement',
    description:
      'After the draft is applied, review the sections, adjust the markdown, and keep task progress current.'
  },
  {
    title: 'Accept changes',
    description:
      'Comments and threads are intentionally deferred in KAT-160; use the spec draft and task state as the current source of truth.'
  }
]

export function SpecOnboardingState() {
  return (
    <div className="grid gap-4">
      {steps.map((step) => {
        const Icon = step.active ? CheckCircle2 : Circle

        return (
          <div
            key={step.title}
            className="flex gap-3 rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <Icon
              className={step.active ? 'mt-0.5 h-4 w-4 text-status-done' : 'mt-0.5 h-4 w-4 text-muted-foreground'}
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
