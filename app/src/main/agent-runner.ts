import { Agent } from '@mariozechner/pi-agent-core'
import type { AgentEvent } from '@mariozechner/pi-agent-core'
import { getModel, streamSimple } from '@mariozechner/pi-ai'
import type { SessionRuntimeEvent } from '../renderer/types/session-runtime-adapter'

export type AgentRunnerConfig = {
  model: string
  provider: string
  apiKey: string
  systemPrompt: string
  onEvent: (event: SessionRuntimeEvent) => void
}

export type AgentRunner = {
  execute(prompt: string): Promise<void>
  abort(): void
}

function extractTextContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('')
}

export function createAgentRunner(config: AgentRunnerConfig): AgentRunner {
  let aborted = false

  const agent = new Agent({
    streamFn: (model, context, options) => {
      return streamSimple(model, context, { ...options, apiKey: config.apiKey })
    }
  })

  return {
    async execute(prompt) {
      // getModel is strongly typed with known provider/model combos.
      // At runtime the user picks arbitrary strings, so we cast through
      // the KnownProvider type and let getModel throw if invalid.
      const model = (getModel as (p: string, m: string) => ReturnType<typeof getModel>)(
        config.provider,
        config.model
      )

      agent.setSystemPrompt(config.systemPrompt)
      agent.setModel(model)

      config.onEvent({ type: 'run_state_changed', runState: 'pending' })

      agent.subscribe((event: AgentEvent) => {
        if (aborted) return

        if (event.type === 'message_end' && event.message) {
          const msg = event.message as {
            role: string
            content: Array<{ type: string; text?: string }>
          }
          if (msg.role === 'assistant') {
            const text = extractTextContent(msg.content)
            if (text) {
              config.onEvent({
                type: 'message_appended',
                message: {
                  id: `agent-${Date.now()}`,
                  role: 'agent',
                  content: text,
                  createdAt: new Date().toISOString()
                }
              })
            }
          }
        }

        if (event.type === 'agent_end') {
          config.onEvent({ type: 'run_state_changed', runState: 'idle' })
        }
      })

      try {
        await agent.prompt(prompt)
      } catch (error) {
        if (!aborted) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          config.onEvent({
            type: 'run_state_changed',
            runState: 'error',
            errorMessage: message
          })
        }
      }
    },

    abort() {
      aborted = true
      agent.abort()
    }
  }
}
