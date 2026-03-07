import { CheckCircle2, Circle, LoaderCircle } from 'lucide-react'

type Step = {
  title: string
  description: string
  state: 'complete' | 'active' | 'upcoming'
}

type GenerationPhase = 'thinking' | 'drafting'

function buildSteps(phase: GenerationPhase): Step[] {
  return [
    {
      title: 'Thinking',
      description: 'The coordinator is shaping the initial spec approach and scope.',
      state: phase === 'thinking' ? 'active' : 'complete'
    },
    {
      title: 'Drafting',
      description: 'The live markdown spec artifact is being written into this panel.',
      state: phase === 'drafting' ? 'active' : 'upcoming'
    },
    {
      title: 'Implement',
      description:
        'Once the initial draft lands, review the markdown directly, refine it in place, and keep task progress current.',
      state: 'upcoming'
    },
    {
      title: 'Accept changes',
      description:
        'Comments and threads are intentionally deferred in this release; use the live spec artifact and task state as the current source of truth.',
      state: 'upcoming'
    }
  ]
}

export function SpecOnboardingState({ phase = 'thinking' }: { phase?: GenerationPhase }) {
  const steps = buildSteps(phase)

  return (
    <div className="grid gap-4">
      <div
        role="status"
        aria-live="polite"
        aria-label={phase === 'thinking' ? 'Thinking' : 'Drafting'}
        className="rounded-lg border border-primary/30 bg-primary/5 p-4"
      >
        <div className="flex items-center gap-3">
          <LoaderCircle
            data-testid="spec-generation-indicator"
            className="h-5 w-5 animate-spin text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {phase === 'thinking' ? 'Thinking' : 'Drafting'}
            </p>
            <p className="text-sm text-muted-foreground">
              {phase === 'thinking'
                ? 'Preparing the first version of the spec.'
                : 'Writing the live markdown spec document now.'}
            </p>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Spec generation in progress"
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/15"
        >
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
      {steps.map((step) => {
        const Icon =
          step.state === 'active' ? LoaderCircle : step.state === 'complete' ? CheckCircle2 : Circle

        return (
          <div
            key={step.title}
            className="flex gap-3 rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <Icon
              className={
                step.state === 'active'
                  ? 'mt-0.5 h-4 w-4 animate-spin text-primary'
                  : step.state === 'complete'
                    ? 'mt-0.5 h-4 w-4 text-status-done'
                    : 'mt-0.5 h-4 w-4 text-muted-foreground'
              }
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
