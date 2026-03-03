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
    .map((block: { text?: string }) => block.text)
    .filter((text): text is string => typeof text === 'string')
    .join('')
}

export function createAgentRunner(config: AgentRunnerConfig): AgentRunner {
  let aborted = false
  let runFailed = false
  let executing = false
  let unsubscribe: (() => void) | null = null

  const agent = new Agent({
    streamFn: (model, context, options) => {
      return streamSimple(model, context, { ...options, apiKey: config.apiKey })
    }
  })

  return {
    async execute(prompt) {
      if (executing) throw new Error('AgentRunner: execute already in progress')
      executing = true
      aborted = false
      runFailed = false

      // getModel's generic signature constrains provider/model to known combos.
      // At runtime the user picks arbitrary strings, so we widen the function
      // signature to accept plain strings and let getModel throw if invalid.
      const model = (getModel as (p: string, m: string) => ReturnType<typeof getModel>)(
        config.provider,
        config.model
      )

      agent.setSystemPrompt(config.systemPrompt)
      agent.setModel(model)

      config.onEvent({ type: 'run_state_changed', runState: 'pending' })

      const emitRunFailure = (errorMessage: string) => {
        if (runFailed) return
        runFailed = true
        config.onEvent({
          type: 'run_state_changed',
          runState: 'error',
          errorMessage
        })
      }

      let activeAssistantMessageId: string | null = null
      let activeAssistantCreatedAt: string | null = null

      if (unsubscribe) unsubscribe()
      unsubscribe = agent.subscribe((event: AgentEvent) => {
        if (aborted) return

        if (event.type === 'message_start' && event.message) {
          const msg = event.message as {
            role: string
          }

          if (msg.role === 'assistant') {
            activeAssistantMessageId = `agent-${Date.now()}`
            activeAssistantCreatedAt = new Date().toISOString()
          }
        }

        if (event.type === 'message_update' && event.message) {
          const msg = event.message as {
            role: string
            content: Array<{ type: string; text?: string }>
          }

          if (msg.role === 'assistant' && activeAssistantMessageId && activeAssistantCreatedAt) {
            const partialText = extractTextContent(msg.content)
            if (partialText) {
              config.onEvent({
                type: 'message_updated',
                message: {
                  id: activeAssistantMessageId,
                  role: 'agent',
                  content: partialText,
                  createdAt: activeAssistantCreatedAt
                }
              })
            }
          }
        }

        if (event.type === 'message_end' && event.message) {
          const msg = event.message as {
            role: string
            content: Array<{ type: string; text?: string }>
            stopReason?: string
            errorMessage?: string
          }
          if (msg.role === 'assistant') {
            if (msg.stopReason === 'error') {
              emitRunFailure(msg.errorMessage || 'Unknown error')
              return
            }
            const text = extractTextContent(msg.content)
            if (text) {
              if (!activeAssistantMessageId || !activeAssistantCreatedAt) {
                activeAssistantMessageId = `agent-${Date.now()}`
                activeAssistantCreatedAt = new Date().toISOString()
              }
              config.onEvent({
                type: 'message_appended',
                message: {
                  id: activeAssistantMessageId,
                  role: 'agent',
                  content: text,
                  createdAt: activeAssistantCreatedAt
                }
              })
            }
            activeAssistantMessageId = null
            activeAssistantCreatedAt = null
          }
        }

        if (event.type === 'agent_end') {
          if (!runFailed) {
            config.onEvent({ type: 'run_state_changed', runState: 'idle' })
          }
          activeAssistantMessageId = null
          activeAssistantCreatedAt = null
          if (unsubscribe) {
            unsubscribe()
            unsubscribe = null
          }
        }
      })

      try {
        await agent.prompt(prompt)
      } catch (error) {
        if (!aborted) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          emitRunFailure(message)
        }
      } finally {
        executing = false
      }
    },

    abort() {
      aborted = true
      executing = false
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      agent.abort()
    }
  }
}
