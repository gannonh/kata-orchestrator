import { describe, expect, it } from 'vitest'

import type {
  SessionRuntimeAdapter,
  SessionRuntimeEvent
} from '../../../../src/renderer/types/session-runtime-adapter'

describe('SessionRuntimeAdapter contract', () => {
  it('is defined in an importable runtime module', async () => {
    await expect(import('../../../../src/renderer/types/session-runtime-adapter')).resolves.toBeDefined()
  })

  it('enforces runtime execution checks for subscribe, submitPrompt, and retry', () => {
    let unsubscribed = false
    let submittedPrompt = ''
    let retryCount = 0
    const receivedEvents: SessionRuntimeEvent[] = []

    const adapter: SessionRuntimeAdapter = {
      subscribe(onEvent) {
        onEvent({
          type: 'run_state_changed',
          runState: 'pending'
        })
        onEvent({
          type: 'run_state_changed',
          runState: 'error',
          errorMessage: 'Network timeout'
        })
        onEvent({
          type: 'message_updated',
          message: {
            id: 'agent-1',
            role: 'agent',
            content: 'hel',
            createdAt: '1970-01-01T00:00:01.000Z'
          }
        })
        onEvent({
          type: 'message_appended',
          message: {
            id: 'agent-1',
            role: 'agent',
            content: 'hello',
            createdAt: '1970-01-01T00:00:01.000Z'
          }
        })

        return () => {
          unsubscribed = true
        }
      },
      submitPrompt(prompt: string) {
        submittedPrompt = prompt
      },
      retry() {
        retryCount += 1
      }
    }

    expect(adapter.subscribe.length).toBe(1)
    expect(adapter.submitPrompt.length).toBe(1)
    expect(adapter.retry.length).toBe(0)

    adapter.submitPrompt('Plan phase 2')
    adapter.retry()
    const unsubscribe: () => void = adapter.subscribe((event: SessionRuntimeEvent) => {
      receivedEvents.push(event)
    })

    expect(submittedPrompt).toBe('Plan phase 2')
    expect(retryCount).toBe(1)
    expect(typeof unsubscribe).toBe('function')

    expect(receivedEvents.map((event) => event.type)).toEqual([
      'run_state_changed',
      'run_state_changed',
      'message_updated',
      'message_appended'
    ])

    for (const event of receivedEvents) {
      if (event.type !== 'run_state_changed') {
        continue
      }

      if (event.runState === 'error') {
        expect(event.errorMessage).toBeTypeOf('string')
      } else {
        expect('errorMessage' in event).toBe(false)
      }
    }

    unsubscribe()
    expect(unsubscribed).toBe(true)
  })
})
